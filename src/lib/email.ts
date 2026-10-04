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

export function fromAddress(): string {
  // Resend only accepts a from-address on a domain you've verified with
  // them, with onboarding@resend.dev as the exception for testing.
  return process.env.EMAIL_FROM ?? "Packmates <onboarding@resend.dev>";
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

/** What a failed send means, in words an admin can act on without anyone
 * to ask. Resend's own message is kept underneath for the rest. */
export function explainEmailError(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("api key is invalid") || e.includes("returned 401")) {
    return "Resend doesn't recognise the API key. Copy it again from resend.com → API Keys into RESEND_API_KEY in Vercel, then redeploy.";
  }
  if (e.includes("domain is not verified") || e.includes("not verified")) {
    return "The sending domain isn't verified in Resend yet. On resend.com → Domains, check doyoulikepizza.com says Verified. DNS changes can take a few hours to show up.";
  }
  if (e.includes("only send testing emails") || e.includes("testing emails to your own")) {
    return "Resend is still in testing mode, so it only sends to your own address. Verify doyoulikepizza.com on resend.com → Domains, and set EMAIL_FROM to an address on it, e.g. Packmates <hello@doyoulikepizza.com>, then redeploy.";
  }
  if (e.includes("invalid `from`") || e.includes("invalid from")) {
    return 'EMAIL_FROM isn\'t in a form Resend accepts. Set it to exactly: Packmates <hello@doyoulikepizza.com>, then redeploy.';
  }
  if (e.includes("restricted") || e.includes("returned 403")) {
    return "Resend refused this key for sending from this address. Check the key has sending access for doyoulikepizza.com on resend.com → API Keys, and the domain shows Verified.";
  }
  if (e.includes("returned 429")) {
    return "Resend's sending limit was hit (100 a day on the free plan). It resets within a day.";
  }
  if (e.includes("fetch failed") || e.includes("timeout") || e.includes("network")) {
    return "Couldn't reach Resend at all. Usually a blip on their side: try again in a few minutes.";
  }
  return "Resend said no, for the reason below.";
}
