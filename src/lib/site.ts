// Single place to change the app's name/domain/tagline.
//
// This is the parent: the name on the domain, the browser tab and the
// home-screen icon, which can only be one thing. The two clubs that live
// inside it are in src/lib/clubs.ts, and one of them shares this name.
export const SITE = {
  name: "Pacemates",
  domain: "doyoulikepizza.com",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://doyoulikepizza.com",
  tagline: "Two highly exclusive clubs. Sport on one side, the road on the other.",
  description:
    "Two highly exclusive clubs on one map: Pacemates for running and sport, Packmates for backpacking and travel. Both are members only, and both are by referral.",
};
