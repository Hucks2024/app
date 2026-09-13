import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, isPaidUp, needsEmailCheck } from "@/lib/auth";
import { CLUBS, clubBySlug } from "@/lib/clubs";
import ClubLanding from "@/components/ClubLanding";

// One route for both front doors, so adding a club is an entry in
// src/lib/clubs.ts rather than another folder. Anything that isn't a club
// slug falls through to a 404, which is what an unknown path should be.
export async function generateStaticParams() {
  return CLUBS.map((c) => ({ club: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ club: string }>;
}): Promise<Metadata> {
  const club = clubBySlug((await params).club);
  if (!club) return {};
  return {
    title: club.name,
    description: `${club.name} is a highly exclusive club for ${club.purpose.toLowerCase()}. ${club.blurb} Membership is by referral only.`,
  };
}

export default async function ClubPage({ params }: { params: Promise<{ club: string }> }) {
  const club = clubBySlug((await params).club);
  if (!club) notFound();

  // A member's club is decided by their account, not the address bar, so
  // there's nothing here for someone already logged in: send them to their
  // own club's map, whichever door they came through.
  const user = await getCurrentUser();
  if (user) {
    if (needsEmailCheck(user)) redirect("/verify-email");
    if (!isPaidUp(user)) redirect("/subscribe");
    redirect("/activities");
  }

  return <ClubLanding club={club} />;
}
