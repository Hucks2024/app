import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ensureMembership } from "@/lib/invite";
import { SITE } from "@/lib/site";
import type { User } from "@prisma/client";

// "Continue with Apple" and "Continue with Google": the one-tap sign in.
//
// Each button only appears once its keys are in the environment, so this
// whole file is dormant until then and the email sign in carries on
// regardless:
//
//   Apple   APPLE_CLIENT_ID       the Services ID, e.g. com.doyoulikepizza.web
//   Google  GOOGLE_CLIENT_ID      from Google Cloud → APIs & Services → Credentials
//           GOOGLE_CLIENT_SECRET
//
// with these registered as the return URLs on the provider's side:
//   https://doyoulikepizza.com/auth/apple/callback
//   https://doyoulikepizza.com/auth/google/callback
//
// Apple needs no secret here: it posts the signed ID token straight back,
// and that token is checked against Apple's published keys, which is all
// the proof a sign in needs.

export type Provider = "apple" | "google";

export function enabledProviders(): Record<Provider, boolean> {
  return {
    apple: Boolean(process.env.APPLE_CLIENT_ID),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}

export function isProvider(value: string): value is Provider {
  return value === "apple" || value === "google";
}

const APPLE_ISSUER = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

// Holds the state and nonce between leaving for the provider and coming
// back. SameSite=None because Apple returns by POSTing a form from its own
// domain, and a Lax cookie is never sent on a cross-site POST, so the
// callback would always look like a forgery. Signed and ten minutes long,
// and scoped to /auth so nothing else ever sees it.
const FLOW_COOKIE = "pm_oauth";
const FLOW_SECONDS = 600;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set.");
  return new TextEncoder().encode(s);
}

function random() {
  return randomBytes(24).toString("base64url");
}

export function callbackUrl(provider: Provider) {
  return `${SITE.url}/auth/${provider}/callback`;
}

/** Where to send the browser to start signing in, with the flow cookie set. */
export async function authorizeUrl(provider: Provider): Promise<string> {
  const state = random();
  const nonce = random();
  const token = await new SignJWT({ provider, state, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${FLOW_SECONDS}s`)
    .sign(secret());
  (await cookies()).set(FLOW_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/auth",
    maxAge: FLOW_SECONDS,
  });

  if (provider === "apple") {
    const params = new URLSearchParams({
      client_id: process.env.APPLE_CLIENT_ID!,
      redirect_uri: callbackUrl("apple"),
      // The ID token comes back with the code, so there's no code exchange
      // and no client secret to rotate every six months.
      response_type: "code id_token",
      // Apple insists on form_post whenever name or email is asked for.
      response_mode: "form_post",
      scope: "name email",
      state,
      nonce,
    });
    return `${APPLE_ISSUER}/auth/authorize?${params}`;
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl("google"),
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
    nonce,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** The nonce for this sign in, if the state that came back is the one we
 * sent from this browser. Single use: the cookie goes either way. */
async function takeFlow(provider: Provider, state: string | null): Promise<string | null> {
  const store = await cookies();
  const token = store.get(FLOW_COOKIE)?.value;
  store.delete({ name: FLOW_COOKIE, path: "/auth" });
  if (!token || !state) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.provider !== provider || payload.state !== state) return null;
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch {
    return null;
  }
}

export type Identity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

function verifiedFlag(payload: JWTPayload): boolean {
  // Apple sends "true" as a string, Google as a boolean.
  return payload.email_verified === true || payload.email_verified === "true";
}

/** Apple's form post, checked: our state, Apple's signature, our nonce. */
export async function appleIdentity(form: FormData): Promise<Identity | null> {
  const nonce = await takeFlow("apple", form.get("state") as string | null);
  const idToken = form.get("id_token");
  if (!nonce || typeof idToken !== "string") return null;

  const { payload } = await jwtVerify(idToken, appleKeys, {
    issuer: APPLE_ISSUER,
    audience: process.env.APPLE_CLIENT_ID!,
  });
  if (payload.nonce !== nonce || !payload.sub) return null;

  // Apple sends the person's name once, on their very first sign in, as a
  // separate JSON field rather than in the token.
  let name: string | null = null;
  try {
    const user = JSON.parse(String(form.get("user") ?? "null"));
    name = [user?.name?.firstName, user?.name?.lastName].filter(Boolean).join(" ") || null;
  } catch {
    name = null;
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: verifiedFlag(payload),
    name,
  };
}

/** Google's redirect, checked: our state, then the code swapped for an ID
 * token, which is checked against Google's keys and our nonce. */
export async function googleIdentity(params: URLSearchParams): Promise<Identity | null> {
  const nonce = await takeFlow("google", params.get("state"));
  const code = params.get("code");
  if (!nonce || !code) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl("google"),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) return null;

  const { payload } = await jwtVerify(idToken, googleKeys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID!,
  });
  if (payload.nonce !== nonce || !payload.sub) return null;

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: verifiedFlag(payload),
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

export type SignInResult = { ok: true; user: User } | { ok: false; error: string };

/** Finds or creates the account for a provider identity.
 *
 * An address that already has a password account is not quietly joined
 * onto it. Email isn't confirmed at signup while Resend is switched off,
 * so the password account could be somebody else's squat on that address,
 * and merging would hand the real owner an account a stranger can also
 * get into. They're told to use their password instead. */
export async function signInWithIdentity(provider: Provider, id: Identity): Promise<SignInResult> {
  const prisma = await getPrisma();
  const where = provider === "apple" ? { appleSub: id.sub } : { googleSub: id.sub };
  const label = provider === "apple" ? "Apple" : "Google";

  let user = await prisma.user.findUnique({ where });

  if (!user) {
    if (!id.email || !id.emailVerified) {
      return { ok: false, error: `${label} didn't share a confirmed email address, so we can't make an account from it.` };
    }
    const email = id.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        ok: false,
        error: "You already have an account with that email. Continue with email and use your password.",
      };
    }
    user = await prisma.user.create({
      data: {
        ...where,
        email,
        name: id.name?.trim().slice(0, 80) || "New member",
        // Never used: there's no password for this account, only a hash
        // nobody knows, so the email-and-password route can't open it.
        passwordHash: await hashPassword(random()),
        emailVerifiedAt: new Date(),
      },
    });
    await ensureMembership(prisma, user.id);
  }

  if (user.accountStatus === "BANNED") {
    return { ok: false, error: "This account has been banned for good after three red flags." };
  }
  if (user.accountStatus !== "ACTIVE") {
    return { ok: false, error: "This account has been suspended." };
  }
  return { ok: true, user };
}
