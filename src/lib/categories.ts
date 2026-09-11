// Every kind of meetup the app carries. Running is first and is the
// default, that's still what this is for, but a run that ends in the pub
// and a meetup that's only the pub are the same shape of thing, so they
// share the same machinery rather than getting a parallel feature.
//
// The emoji here replaces the old random landmark pin on the map: a pin
// now tells you what the meetup actually is at a glance.
export const CATEGORIES = [
  { value: "RUN", label: "Run", emoji: "🏃", sport: true },
  { value: "WALK", label: "Walk / hike", emoji: "🥾", sport: true },
  { value: "CYCLE", label: "Cycle", emoji: "🚲", sport: true },
  { value: "SWIM", label: "Swim", emoji: "🏊", sport: true },
  { value: "GYM", label: "Gym / class", emoji: "🏋️", sport: true },
  { value: "SPORT", label: "Other sport", emoji: "⚽", sport: true },
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
