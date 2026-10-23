// Cloudflare Turnstile: the "are you a person?" check on joining. Free,
// and most people never see it: it watches how the page is used and only
// asks for a tap when it isn't sure. A bot that gets past everything in
// src/lib/bots.ts (a phone's name, a human-speed form, a real inbox) still
// has to get past this.
//
// Switched on by two GitHub secrets, TURNSTILE_SITE_KEY and
// TURNSTILE_SECRET_KEY, from Cloudflare → Turnstile. With either missing,
// joining works as it did without it.

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY : null;
}

// Only ever pointed elsewhere by the tests.
const VERIFY_URL = process.env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Whether Cloudflare says the token came from a person, just now, on this
 * site. Each token works once. No answer from Cloudflare counts as no: a
 * bot could otherwise wait for an outage. */
export async function passedPersonCheck(token: string, ip: string | null): Promise<boolean> {
  if (!turnstileSiteKey()) return true;
  if (!token) return false;
  try {
    const body = new FormData();
    body.set("secret", process.env.TURNSTILE_SECRET_KEY ?? "");
    body.set("response", token);
    if (ip) body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.error("Turnstile check failed:", e);
    return false;
  }
}
