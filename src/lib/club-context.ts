import { headers } from "next/headers";
import { PATHNAME_HEADER } from "@/lib/headers";
import { CLUBS, clubBySlug, clubFor, type Club } from "@/lib/clubs";
import type { User } from "@prisma/client";

/** Which club the page being rendered belongs to, or null if it belongs to
 *  neither.
 *
 * A logged-in member is always in their own club: the account decides, not
 * the URL, so there's nothing to switch to and no way to wander into the
 * other club's pages by typing a path. Logged out, it's whichever front
 * door they're standing at, and null on the pages the two clubs share (the
 * chooser, and logging in before a side is picked).
 */
export async function currentClub(user: User | null): Promise<Club | null> {
  if (user) return clubFor(user.club);

  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "";
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  return clubBySlug(first);
}

/** Every club, for the chooser. */
export function allClubs(): readonly Club[] {
  return CLUBS;
}
