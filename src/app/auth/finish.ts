import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { SITE } from "@/lib/site";
import { errorQuery } from "@/lib/flash";
import { signInWithIdentity, type Identity, type Provider } from "@/lib/oauth";

/** The end of either provider's callback: an account, a session, and the
 * map; or back to the sign in screen saying what went wrong.
 *
 * 303 rather than the default 307: Apple's callback is a POST, and a 307
 * would repeat that POST against the home page. */
export async function finishSignIn(provider: Provider, identity: Identity | null) {
  const back = (error: string) =>
    NextResponse.redirect(`${SITE.url}/login?${errorQuery(error)}`, 303);

  if (!identity) return back("Sign in didn't work. Try again.");

  const result = await signInWithIdentity(provider, identity);
  if (!result.ok) return back(result.error);

  await createSession(result.user.id);
  return NextResponse.redirect(`${SITE.url}/`, 303);
}
