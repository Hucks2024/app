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
  { value: "RUN", label: "Run", emoji: "🏃" },
  { value: "WALK", label: "Walk / hike", emoji: "🥾" },
  { value: "CYCLE", label: "Cycle", emoji: "🚲" },
  { value: "SWIM", label: "Swim", emoji: "🏊" },
  { value: "GYM", label: "Gym / class", emoji: "🏋️" },
  { value: "SPORT", label: "Other sport", emoji: "⚽" },
  { value: "TREK", label: "Trek / multi-day", emoji: "⛰️" },
  { value: "TRIP", label: "Travel day", emoji: "🎒" },
  { value: "SIGHTS", label: "Sightseeing", emoji: "🗺️" },
  { value: "HOSTEL", label: "Hostel hangout", emoji: "🛏️" },
  { value: "COFFEE", label: "Coffee", emoji: "☕" },
  { value: "FOOD", label: "Food", emoji: "🍽️" },
  { value: "DRINKS", label: "Drinks / pub", emoji: "🍻" },
  { value: "SOCIAL", label: "Something else", emoji: "🎉" },
] as const;

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as readonly string[];

const FALLBACK = CATEGORIES[0];

export function categoryFor(value: string | null | undefined) {
  return CATEGORIES.find((c) => c.value === value) ?? FALLBACK;
}
