// Men-only, women-only and T-Rex-only meetups, and ones for all. Everyone
// says which they are when they join, for good; a host keeps a meetup to
// their own group or opens it to all. A meetup for another group isn't on
// your map at all, and can't be joined.
import type { Messages } from "@/i18n/messages/en";

export const GENDERS = ["MALE", "FEMALE", "TREX"] as const;
export type Gender = (typeof GENDERS)[number];

export function isGender(value: unknown): value is Gender {
  return GENDERS.includes(value as Gender);
}

export const GENDER_EMOJI: Record<Gender, string> = { MALE: "👨", FEMALE: "👩", TREX: "🦖" };

/** Who a meetup is for: everyone, or one group. */
export type ForWho = "ALL" | Gender;
// All of them, for all.
export const FOR_WHO_EMOJI: Record<ForWho, string> = { ALL: "👨👩🦖", ...GENDER_EMOJI };

export function isForWho(value: unknown): value is ForWho {
  return value === "ALL" || isGender(value);
}

/** What a host sees to pick from, in this order; "ALL" unless they say.
 * Only their own group's and "ALL" can be picked (see forWhoChoices). */
export const FOR_WHO_PICKS: ForWho[] = ["MALE", "FEMALE", "TREX", "ALL"];

/** Who a host can keep a meetup to: all, or their own group. A man can't
 * post a women-only meetup. */
export function forWhoChoices(gender: string | null | undefined): ForWho[] {
  return isGender(gender) ? ["ALL", gender] : ["ALL"];
}

/** Who a meetup is for, for its ticket: the emoji, and words for screen
 * readers. */
export function whoFor(t: Messages, forWho: string): { emoji: string; label: string } {
  const f = isForWho(forWho) ? forWho : "ALL";
  return { emoji: FOR_WHO_EMOJI[f], label: f === "ALL" ? t.forWho.forAll : t.forWho[f] };
}

/** Whether somebody can go: one for all, anyone; the rest, the group
 * it's for. Somebody who hasn't said which they are, ones for all only. */
export function canGo(forWho: string, gender: string | null | undefined): boolean {
  return forWho === "ALL" || forWho === gender;
}

/** The meetups somebody sees, as a database filter: ones for all, ones
 * for their group, and any they're hosting themselves. */
export function meetupsFor(user: { id: string; gender: string | null }) {
  return {
    OR: [{ forWho: { in: forWhoChoices(user.gender) } }, { hostId: user.id }],
  };
}
