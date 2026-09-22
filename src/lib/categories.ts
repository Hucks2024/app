// Every kind of meetup the app carries.
//
// Running is first and is the default, that's still the heart of it, but a
// run that ends in the pub, a trek, a travel day and a meetup that's only
// the pub are the same shape of thing, so they share the same machinery
// rather than getting a parallel feature.
//
// The emoji here is what the map pin shows, so a pin tells you what the
// meetup actually is at a glance.
export const CATEGORIES = [
  { value: "RUN", label: "Run", emoji: "🏃", sport: true },
  { value: "WALK", label: "Walk / hike", emoji: "🥾", sport: true },
  { value: "CYCLE", label: "Cycle", emoji: "🚲", sport: true },
  { value: "SWIM", label: "Swim", emoji: "🏊", sport: true },
  { value: "GYM", label: "Gym / class", emoji: "🏋️", sport: true },
  { value: "SPORT", label: "Other sport", emoji: "⚽", sport: true },
  { value: "TREK", label: "Trek / multi-day", emoji: "⛰️", sport: true },
  { value: "TRIP", label: "Travel day", emoji: "🎒", sport: false },
  { value: "SIGHTS", label: "Sightseeing", emoji: "🗺️", sport: false },
  { value: "HOSTEL", label: "Hostel hangout", emoji: "🛏️", sport: false },
  { value: "COFFEE", label: "Coffee", emoji: "☕", sport: false },
  { value: "FOOD", label: "Food", emoji: "🍽️", sport: false },
  { value: "DRINKS", label: "Drinks / pub", emoji: "🍻", sport: false },
  { value: "SOCIAL", label: "Something else", emoji: "🎉", sport: false },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as readonly string[];

const FALLBACK = CATEGORIES[0];

export function categoryFor(value: string | null | undefined) {
  return CATEGORIES.find((c) => c.value === value) ?? FALLBACK;
}

/** True for the categories where distance and pace are worth asking about. */
export function isSport(value: string | null | undefined): boolean {
  return categoryFor(value).sport;
}
