// Every kind of meetup the app carries: moving, making things, hanging
// out, travelling. They're all the same shape of thing (a time, a place,
// people turning up), so they share the same machinery rather than each
// getting a feature of its own.
//
// The emoji here is what the map pin shows, so a pin tells you what the
// meetup actually is at a glance. The values are stored with each meetup,
// so they never change; only labels, emoji and order do.
//
// "route" marks the ones with a distance, a pace and a Strava route; the
// rest don't ask for them.
export const CATEGORY_GROUPS = ["Move", "Create", "Hang out", "Travel"] as const;

export const CATEGORIES = [
  { value: "RUN", label: "Run", emoji: "🏃", group: "Move", route: true },
  { value: "WALK", label: "Walk / hike", emoji: "🥾", group: "Move", route: true },
  { value: "CYCLE", label: "Cycle", emoji: "🚲", group: "Move", route: true },
  { value: "SWIM", label: "Swim", emoji: "🏊", group: "Move", route: true },
  { value: "GYM", label: "Gym / class", emoji: "🏋️", group: "Move", route: false },
  { value: "YOGA", label: "Yoga", emoji: "🧘", group: "Move", route: false },
  { value: "CLIMB", label: "Climb", emoji: "🧗", group: "Move", route: false },
  { value: "DANCE", label: "Dance", emoji: "💃", group: "Move", route: false },
  { value: "SPORT", label: "Other sport", emoji: "⚽", group: "Move", route: false },
  { value: "PAINT", label: "Paint", emoji: "🎨", group: "Create", route: false },
  { value: "SKETCH", label: "Sketch / draw", emoji: "✏️", group: "Create", route: false },
  { value: "PHOTO", label: "Photography", emoji: "📷", group: "Create", route: false },
  { value: "CRAFT", label: "Crafts / knit", emoji: "🧶", group: "Create", route: false },
  { value: "MUSIC", label: "Music / jam", emoji: "🎸", group: "Create", route: false },
  { value: "WRITE", label: "Write", emoji: "📝", group: "Create", route: false },
  { value: "COFFEE", label: "Coffee", emoji: "☕", group: "Hang out", route: false },
  { value: "FOOD", label: "Food", emoji: "🍽️", group: "Hang out", route: false },
  { value: "DRINKS", label: "Drinks / pub", emoji: "🍻", group: "Hang out", route: false },
  { value: "BOOKS", label: "Book club", emoji: "📚", group: "Hang out", route: false },
  { value: "GAMES", label: "Board games", emoji: "🎲", group: "Hang out", route: false },
  { value: "LANGUAGE", label: "Language swap", emoji: "🗣️", group: "Hang out", route: false },
  { value: "VOLUNTEER", label: "Volunteer", emoji: "🤝", group: "Hang out", route: false },
  { value: "TREK", label: "Trek / multi-day", emoji: "⛰️", group: "Travel", route: true },
  { value: "TRIP", label: "Travel day", emoji: "🎒", group: "Travel", route: false },
  { value: "SIGHTS", label: "Sightseeing", emoji: "🗺️", group: "Travel", route: false },
  { value: "HOSTEL", label: "Hostel hangout", emoji: "🛏️", group: "Travel", route: false },
  // Last, under all the groups, for whatever none of them covers.
  { value: "SOCIAL", label: "Something else", emoji: "🎉", group: null, route: false },
] as const satisfies readonly {
  value: string;
  label: string;
  emoji: string;
  group: (typeof CATEGORY_GROUPS)[number] | null;
  route: boolean;
}[];

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as readonly string[];

// "Something else", for a value that isn't in the list.
const FALLBACK = CATEGORIES.find((c) => c.value === "SOCIAL")!;

export function categoryFor(value: string | null | undefined) {
  return CATEGORIES.find((c) => c.value === value) ?? FALLBACK;
}
