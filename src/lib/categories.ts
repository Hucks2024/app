import type { ClubKey } from "@/lib/clubs";

// Every kind of meetup the app carries, across both clubs.
//
// One master list rather than one per club, because a stored category has
// to keep resolving to a label and a pin emoji no matter which club is
// reading it, and no matter which club the row was written by. `clubs` says
// where each one is offered when somebody is posting.
//
// The emoji here is what the map pin shows, so a pin tells you what the
// meetup actually is at a glance.
export const CATEGORIES = [
  // Pacemates: the training ones.
  { value: "RUN", label: "Run", emoji: "🏃", sport: true, clubs: ["PACE"] },
  { value: "CYCLE", label: "Cycle", emoji: "🚲", sport: true, clubs: ["PACE", "PACK"] },
  { value: "SWIM", label: "Swim", emoji: "🏊", sport: true, clubs: ["PACE", "PACK"] },
  { value: "GYM", label: "Gym / class", emoji: "🏋️", sport: true, clubs: ["PACE"] },
  { value: "SPORT", label: "Other sport", emoji: "⚽", sport: true, clubs: ["PACE"] },
  // A walk is a training session to one club and a day out to the other,
  // and it's the same thing on a map either way.
  { value: "WALK", label: "Walk / hike", emoji: "🥾", sport: true, clubs: ["PACE", "PACK"] },
  // Packmates: the road ones.
  { value: "TREK", label: "Trek / multi-day", emoji: "⛰️", sport: true, clubs: ["PACK"] },
  { value: "TRIP", label: "Travel day", emoji: "🎒", sport: false, clubs: ["PACK"] },
  { value: "SIGHTS", label: "Sightseeing", emoji: "🗺️", sport: false, clubs: ["PACK"] },
  { value: "HOSTEL", label: "Hostel hangout", emoji: "🛏️", sport: false, clubs: ["PACK"] },
  // The pint after is the same pint in either club.
  { value: "COFFEE", label: "Coffee", emoji: "☕", sport: false, clubs: ["PACE", "PACK"] },
  { value: "FOOD", label: "Food", emoji: "🍽️", sport: false, clubs: ["PACE", "PACK"] },
  { value: "DRINKS", label: "Drinks / pub", emoji: "🍻", sport: false, clubs: ["PACE", "PACK"] },
  { value: "SOCIAL", label: "Something else", emoji: "🎉", sport: false, clubs: ["PACE", "PACK"] },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as readonly string[];

const FALLBACK = CATEGORIES[0];

export function categoryFor(value: string | null | undefined) {
  return CATEGORIES.find((c) => c.value === value) ?? FALLBACK;
}

/** What this club offers when somebody posts, in the order shown. */
export function categoriesForClub(club: ClubKey) {
  return CATEGORIES.filter((c) => (c.clubs as readonly string[]).includes(club));
}

/** The one pre-selected on the post form: each club's own first option. */
export function defaultCategoryFor(club: ClubKey): string {
  return categoriesForClub(club)[0]?.value ?? FALLBACK.value;
}

/** True for the categories where distance and pace are worth asking about. */
export function isSport(value: string | null | undefined): boolean {
  return categoryFor(value).sport;
}
