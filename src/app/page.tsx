import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isPaidUp, needsEmailCheck } from "@/lib/auth";
import { CLUBS } from "@/lib/clubs";
import { SITE } from "@/lib/site";
import RunsScreen from "@/components/RunsScreen";
import Logo from "@/components/Logo";

export default async function HomePage() {
  const user = await getCurrentUser();

  // Logged-in members see their own club's map right here on "/", no
  // marketing copy, no extra click, and no chooser: their account already
  // decides which club they're in.
  if (user) {
    if (needsEmailCheck(user)) redirect("/verify-email");
    if (!isPaidUp(user)) redirect("/subscribe");
    return <RunsScreen user={user} />;
  }

  // Logged out, the root is the doorway rather than a club: two clubs share
  // this address, and which one you want decides everything that follows,
  // including which invite code will work.
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-12 text-center">
      <div className="flex justify-center mb-4">
        <Logo size={112} variant="white" className="h-20 sm:h-24 w-auto" />
      </div>
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white drop-shadow">
        {SITE.name}
      </h1>
      <p className="text-sm text-white/85 mt-4 max-w-md mx-auto">
        Two highly exclusive clubs, one map. Both are members only, and both are by referral.
      </p>

      <div className="mt-8 space-y-4 text-left">
        {CLUBS.map((club) => (
          <Link
            key={club.key}
            href={`/${club.slug}`}
            className="card block hover:border-brand-400 transition-colors"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-xl leading-none" aria-hidden="true">
                {club.emoji}
              </span>
              <h2 className="text-lg font-bold text-slate-900">{club.name}</h2>
              <span className="text-xs text-slate-500">{club.purpose}</span>
            </div>
            <p className="text-sm text-slate-600 mt-2">{club.blurb}</p>
          </Link>
        ))}
      </div>

      <p className="text-xs text-white/70 mt-8">
        Separate clubs, separate memberships. An invite code only opens the club it came from.
      </p>
    </div>
  );
}
