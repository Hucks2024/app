// Single place to change the app's name/domain/tagline.
//
// The name on the domain, the browser tab and the home-screen icon.
const DOMAIN = "packmates.live";

export const SITE = {
  name: "Packmates",
  domain: DOMAIN,
  // The address in every link the app makes: emails, shared meetups,
  // calendar files. Set here rather than from NEXT_PUBLIC_SITE_URL,
  // because that variable in Vercel still names the old domain and would
  // quietly win. It's honoured only for an http:// address, which is to
  // say a computer running the app locally.
  url: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http://")
    ? process.env.NEXT_PUBLIC_SITE_URL
    : `https://${DOMAIN}`,
  tagline: "We all belong in a pack… mate",
  description: "We all belong in a pack… mate. A free map of meetups: run, walk, coffee, pint.",
};
