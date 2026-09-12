// Sending email through Resend, chosen for being genuinely free at this
// scale (3,000 a month, 100 a day) with no card and no server to run. It's
// one fetch to one endpoint, so swapping to Postmark, SES or anything else
// later means rewriting this file and nothing above it.
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Whether outbound email is configured at all.
 *
 * When it isn't, the app doesn't break and doesn't strand anyone: signup
 * stamps new accounts as verified on the spot and never asks for a code.
 * Setting RESEND_API_KEY is the whole switch. */
export function emailVerificationEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  // Resend only accepts a from-address on a domain you've verified with
  // them, with onboarding@resend.dev as the exception for testing.
  return process.env.EMAIL_FROM ?? "Pacemates <onboarding@resend.dev>";
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
