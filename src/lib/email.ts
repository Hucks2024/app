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
  // /admin) is the whole setup, with nothing else to set in Vercel.
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

/** What a failed send means, in words an admin can act on without anyone
 * to ask. Resend's own message is kept underneath for the rest. */
export function explainEmailError(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("api key is invalid") || e.includes("returned 401")) {
    return "Resend doesn't recognise the API key. Copy it again from resend.com → API Keys into RESEND_API_KEY in Vercel, then redeploy.";
  }
  if (e.includes("domain is not verified") || e.includes("not verified")) {
    return "The domain isn't verified in Resend yet. Follow the Email steps at the top of the admin page. New DNS records can take a few hours to show.";
  }
  if (e.includes("only send testing emails") || e.includes("testing emails to your own")) {
    return "Resend is still in testing mode, so it only sends to your own address. Follow the Email steps at the top of the admin page to verify the domain.";
  }
  if (e.includes("invalid `from`") || e.includes("invalid from")) {
    return `EMAIL_FROM isn't in a form Resend accepts. Remove it in Vercel (the app picks noreply@${SITE.domain} itself), then redeploy.`;
  }
  if (e.includes("restricted") || e.includes("returned 403")) {
    return `Resend refused this key for sending from this address. Check the key has sending access for ${SITE.domain} on resend.com → API Keys, and the domain shows Verified.`;
  }
  if (e.includes("returned 429")) {
    return "Resend's sending limit was hit (100 a day on the free plan). It resets within a day.";
  }
  if (e.includes("fetch failed") || e.includes("timeout") || e.includes("network")) {
    return "Couldn't reach Resend at all. Usually a blip on their side: try again in a few minutes.";
  }
  return "Resend said no, for the reason below.";
}
