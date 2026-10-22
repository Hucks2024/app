// Men-only, women-only and T-Rex-only meetups, and mixed ones. Everyone
// says which they are when they join (and can change it on Me); a host can
// keep a meetup to their own group or open it to everyone. A meetup for
// another group isn't on your map at all, and can't be joined.

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

/** Whether somebody can go: a mixed meetup, anyone; the rest, the group
 * it's for. Somebody who hasn't said which they are, mixed ones only. */
export function canGo(forWho: string, gender: string | null | undefined): boolean {
  return forWho === "ALL" || forWho === gender;
}

/** Who a host can keep a meetup to: everyone, or their own group. */
export function forWhoChoices(gender: string | null | undefined): ForWho[] {
  return isGender(gender) ? ["ALL", gender] : ["ALL"];
}

/** The meetups somebody sees, as a database filter. */
export function meetupsFor(gender: string | null | undefined) {
  return { forWho: { in: forWhoChoices(gender) } };
}
