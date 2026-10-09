import { createHmac, timingSafeEqual } from "crypto";

// Keeping bots from signing up, and adverts and nastiness off the map. The
// front door (turning away crawlers and scripts) is in src/proxy.ts.

// --- Signup ticket -------------------------------------------------------
//
// Handed out when somebody types an email we don't know, and needed to
// create the account. It proves the form was loaded and filled in by
// hand: a person takes a few seconds to type a name and a password; a
// script posting straight to the form doesn't wait.

const FASTEST_HUMAN_MS = 3_000;
const TICKET_LIFE_MS = 24 * 60 * 60 * 1000;

function signTicket(email: string, issuedAt: number): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(`signup:${email}:${issuedAt}`)
    .digest("base64url")
    .slice(0, 22);
}

export function issueSignupTicket(email: string): string {
  const issuedAt = Date.now();
  return `${issuedAt}.${signTicket(email, issuedAt)}`;
}

export function signupTicketOk(ticket: string, email: string): boolean {
  const [time, sig] = ticket.split(".");
  const issuedAt = Number(time);
  if (!Number.isSafeInteger(issuedAt) || !sig) return false;
  const expected = Buffer.from(signTicket(email, issuedAt));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const age = Date.now() - issuedAt;
  return age >= FASTEST_HUMAN_MS && age <= TICKET_LIFE_MS;
}

// --- Throwaway email addresses ---------------------------------------------

const THROWAWAY_DOMAINS = new Set([
  "10minutemail.com", "burnermail.io", "discard.email", "dispostable.com",
  "emailondeck.com", "fakeinbox.com", "getnada.com", "guerrillamail.com",
  "guerrillamail.net", "guerrillamail.org", "inboxkitten.com", "mail.gw",
  "mail.tm", "maildrop.cc", "mailinator.com", "mailnesia.com", "mintemail.com",
  "mohmal.com", "moakt.com", "mytemp.email", "sharklasers.com",
  "spamgourmet.com", "tempail.com", "temp-mail.io", "temp-mail.org",
  "tempmail.com", "tempmailo.com", "throwawaymail.com", "tmpmail.net",
  "tmpmail.org", "trashmail.com", "yopmail.com",
]);

export function isThrowawayEmail(email: string): boolean {
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  for (const d of THROWAWAY_DOMAINS) {
    if (domain === d || domain.endsWith(`.${d}`)) return true;
  }
  return false;
}

// --- No adverts ------------------------------------------------------------
//
// Meetups and names can't carry links, email addresses or phone numbers.
// That's what every advert needs, and members have no reason to share
// them: there are no messages here, you just turn up.

const LINK = /https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|co|uk|me|app|xyz|info|biz|shop|store|online|site|link|live|ly|gg|tv|ru|cn|top|click|club|vip)\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /\+?\d(?:[\s().-]*\d){9,}/;

export const NO_ADS = "No links, emails or phone numbers.";

export function looksLikeAdvert(text: string): boolean {
  return LINK.test(text) || EMAIL.test(text) || PHONE.test(text);
}

// --- Nothing offensive -----------------------------------------------------
//
// Names and everything typed into a meetup are refused if they swear, use
// a slur or are about sex or hard drugs. Whole words only, so Scunthorpe
// and "cocktail" are fine; a few common disguises (f*ck, sh1t, $lut) are
// undone first. It's a first line: what gets past it, people report.

// Each of these as a whole word, or with an ordinary ending (s, ed, er,
// ing, y...).
const OFFENSIVE_STEMS = [
  // Swearing
  "fuck", "fck", "fuk", "motherfuck", "shit", "cunt", "twat", "wank", "bitch", "dickhead", "prick",
  "pussy", "slut", "whore", "bastard", "arsehole", "asshole", "bollock",
  // Slurs
  "nigger", "nigga", "faggot", "tranny", "retard", "spic", "chink", "kike", "paki", "gook", "wetback",
  "coon", "raghead", "towelhead", "golliwog", "spastic",
  // Sex. Not "nude" or "naked": life drawing has a nude model.
  "porn", "porno", "nudes", "nsfw", "onlyfans", "hookup", "milf", "dtf", "horny", "blowjob", "handjob",
  "orgy", "fetish", "bdsm", "erotic", "camgirl", "sexting", "rapist",
  // Hard drugs
  "cocaine", "ketamine", "mdma", "heroin", "meth",
];
// Left out on purpose, being places, pubs and plain English as often as
// not: dyke (Offa's Dyke), cock (the Cock Inn), dick (Moby Dick), fag (a
// fag break), rape (oilseed rape), escort.
const OFFENSIVE_PHRASES = [
  "sugar daddy", "sugar baby", "friends with benefits", "send nudes", "escort service", "kill yourself",
  "sieg heil", "heil hitler",
];
const ENDINGS = "(s|es|ed|er|ers|ing|in|y|ty|ties|head|heads|face)?";
const OFFENSIVE_WORD = new RegExp(`^(${OFFENSIVE_STEMS.join("|")})${ENDINGS}$`);

/** Lower case, the usual stand-ins put back (0 for o, $ for s, * for a
 * vowel left out), and anything else that isn't a letter as a space. */
function plainWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0@4]/g, (c) => ({ "0": "o", "@": "a", "4": "a" })[c]!)
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/(\w)\*+(\w)/g, "$1u$2")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export const NOT_NICE = "Keep it friendly: no swearing, slurs or adult stuff.";

export function looksOffensive(text: string): boolean {
  const plain = plainWords(text);
  if (!plain) return false;
  if (plain.split(" ").some((w) => OFFENSIVE_WORD.test(w))) return true;
  const padded = ` ${plain} `;
  return OFFENSIVE_PHRASES.some((p) => padded.includes(` ${p} `));
}
