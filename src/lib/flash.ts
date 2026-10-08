import { createHmac, timingSafeEqual } from "crypto";

// Error messages carried to the next page in its web address
// (?error=…&sig=…), signed, so a page only ever shows a message this app
// wrote. Without the signature anyone could send a link that puts their
// own words on our page ("Your account is locked, call …").

function sign(message: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(`flash:${message}`)
    .digest("base64url")
    .slice(0, 22);
}

/** "error=…&sig=…", ready to put after ? or &. */
export function errorQuery(message: string): string {
  return `error=${encodeURIComponent(message)}&sig=${sign(message)}`;
}

/** The message, if this app signed it; otherwise nothing. */
export function readError(error: string | undefined, sig: string | undefined): string | null {
  if (!error || !sig || error.length > 300) return null;
  const expected = Buffer.from(sign(error));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return error;
}
