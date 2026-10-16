import { SITE } from "@/lib/site";

// Sending email through Resend, chosen for being genuinely free at this
// scale (3,000 a month, 100 a day) with no card and no server to run. It's
// one fetch to one endpoint, so swapping to Postmark, SES or anything else
// later means rewriting this file and nothing above it.
// Overridable only so the emails can be tested against a stand-in; in
// real use it's always Resend's own address.
const RESEND_ENDPOINT = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

/** Whether the app can send email at all. It only ever sends one kind:
 * the code for resetting a forgotten password. Without it, "Forgot your
 * password?" says to ask an admin instead. RESEND_API_KEY is the switch. */
export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function fromAddress(): string {
  // Resend only sends from a domain that's verified with them, so this is
  // an address on the site's own domain: verifying it (the steps on
  // /admin) is the whole setup, with nothing else to set.
  // EMAIL_FROM still wins if it's set.
  return process.env.EMAIL_FROM || `${SITE.name} <noreply@${SITE.domain}>`;
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Email isn't configured" };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      // Resend puts the useful part in the body, e.g. an unverified domain
      // or a malformed from-address; the status alone doesn't say which.
      const body = await res.text();
      return { ok: false, error: `Resend returned ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** A failure that's worth trying again in a minute (the network, a busy
 * or rate-limited Resend), as opposed to one that will keep failing until
 * something's set up. */
export function isTemporaryEmailError(error: string): boolean {
  return /returned (5\d\d|429)|fetch failed|timeout|timed out|network|aborted|ECONN/i.test(error);
}
