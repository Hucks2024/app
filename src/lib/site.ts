// Single place to change the app's name/domain/tagline.
//
// The name on the domain, the browser tab and the home-screen icon.
const DOMAIN = "packmates.live";

export const SITE = {
  name: "Packmates",
  domain: DOMAIN,
  // The address in every link the app makes: emails and shared meetups.
  // Set here rather than from NEXT_PUBLIC_SITE_URL,
  // because that variable (once set in Vercel) named an old domain and would
  // quietly win. It's honoured only for an http:// address, which is to
  // say a computer running the app locally.
  url: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://")
    ? process.env.NEXT_PUBLIC_SITE_URL
    : `https://${DOMAIN}`,
  // Where people reach us, at this domain: shown on Info, Terms, Privacy
  // and Me by src/components/ContactEmail.tsx, which keeps it from spam
  // bots. Only the name here, so the whole address is never in the code.
  contactName: "hello",
  // Who can join. In the Terms, and asked for at sign up.
  minimumAge: 18,
  // Who it's made for: a recommendation shown around the site, not a
  // rule. Anyone the minimum age or over can still join.
  recommendedAges: "18-35",
  tagline: "We all belong in a pack… mate",
  description: "We all belong in a pack… mate. A free map of meetups for 18-35s: paint, walk, run, coffee, anything.",
};
