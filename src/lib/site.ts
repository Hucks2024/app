// Single place to change the app's name/domain/tagline.
//
// This is the parent: the name on the domain, the browser tab and the
// home-screen icon, which can only be one thing. The two clubs that live
// inside it are in src/lib/clubs.ts, and one of them shares this name.
export const SITE = {
  name: "Packmates",
  domain: "doyoulikepizza.com",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://doyoulikepizza.com",
  tagline: "A highly exclusive club. Sport on one side, the road on the other.",
  description:
    "Packmates is a highly exclusive club for people all over the world to train, travel and meet up. Members only, by referral, and free while it's small.",
};
