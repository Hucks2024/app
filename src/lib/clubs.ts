// The two clubs that share this site.
//
// They are separate memberships, not two views of one: a Pacemate and a
// Packmate are different accounts, with their own member numbers, their own
// invite codes and their own referral chains. The only things they share
// are the code running them and the domain they sit on. The same person can
// hold both, which is why email is unique per club rather than globally
// (see the @@unique on User in prisma/schema.prisma).
//
// Everything a club renames — its name, what it calls a meetup, the copy on
// its front door — lives here rather than being typed into pages, so adding
// a third club later is a matter of adding an entry.

export type ClubKey = "PACE" | "PACK";

export type Club = {
  key: ClubKey;
  /** The URL segment: /pacemates, /packmates. */
  slug: string;
  name: string;
  /** One line for the chooser and for headings. */
  purpose: string;
  /** The front-door sentence. */
  blurb: string;
  emoji: string;
  /** What this club calls the thing you post, so Pacemates says "run" and
   *  Packmates doesn't have to pretend a hostel night out is one. */
  noun: { one: string; many: string };
};

export const CLUBS: readonly Club[] = [
  {
    key: "PACE",
    slug: "pacemates",
    name: "Pacemates",
    purpose: "Running and sport",
    blurb:
      "For people who train. Runs, rides, swims, gym sessions, and whoever's still standing afterwards.",
    emoji: "🏃",
    noun: { one: "run", many: "runs" },
  },
  {
    key: "PACK",
    slug: "packmates",
    name: "Packmates",
    purpose: "Backpacking and travel",
    blurb:
      "For people on the road. Treks, travel days, hostel nights and the city you've both just landed in.",
    emoji: "🎒",
    noun: { one: "meetup", many: "meetups" },
  },
] as const;

/** New accounts and anything written before the split belong here: the app
 *  was Pacemates-shaped long before Packmates existed. */
export const DEFAULT_CLUB: ClubKey = "PACE";

export const CLUB_KEYS = CLUBS.map((c) => c.key) as readonly string[];

export function clubFor(key: string | null | undefined): Club {
  return CLUBS.find((c) => c.key === key) ?? CLUBS[0];
}

export function clubBySlug(slug: string | null | undefined): Club | null {
  return CLUBS.find((c) => c.slug === slug) ?? null;
}

/** The other one. There are two, and several pages want to offer it. */
export function otherClub(key: ClubKey): Club {
  return CLUBS.find((c) => c.key !== key) ?? CLUBS[0];
}
