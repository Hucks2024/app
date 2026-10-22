// Men-only, women-only and T-Rex-only meetups, and ones for all. Everyone
// says which they are when they join, for good; a host
// picks who a meetup is for. A meetup for another group isn't on your map
// at all, and can't be joined.

export const GENDERS = ["MALE", "FEMALE", "TREX"] as const;
export type Gender = (typeof GENDERS)[number];

export function isGender(value: unknown): value is Gender {
  return GENDERS.includes(value as Gender);
}

export const GENDER_EMOJI: Record<Gender, string> = { MALE: "👨", FEMALE: "👩", TREX: "🦖" };

/** Who a meetup is for: everyone, or one group. */
export type ForWho = "ALL" | Gender;
export const FOR_WHO_EMOJI: Record<ForWho, string> = { ALL: "👥", ...GENDER_EMOJI };

export function isForWho(value: unknown): value is ForWho {
  return value === "ALL" || isGender(value);
}

/** What a host picks from, in this order; "ALL" unless they say. */
export const FOR_WHO_PICKS: ForWho[] = ["MALE", "FEMALE", "TREX", "ALL"];

/** Whether somebody can go: one for all, anyone; the rest, the group
 * it's for. Somebody who hasn't said which they are, ones for all only. */
export function canGo(forWho: string, gender: string | null | undefined): boolean {
  return forWho === "ALL" || forWho === gender;
}

/** The meetups somebody sees, as a database filter: ones for all, ones
 * for their group, and any they're hosting themselves. */
export function meetupsFor(user: { id: string; gender: string | null }) {
  return {
    OR: [{ forWho: { in: isGender(user.gender) ? ["ALL", user.gender] : ["ALL"] } }, { hostId: user.id }],
  };
}
