import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { currentClub } from "@/lib/club-context";
import { clubFor } from "@/lib/clubs";
import { SITE } from "@/lib/site";
import LogoutButton from "@/components/LogoutButton";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Nav() {
  const user = await getCurrentUser();
  const club = await currentClub(user);

  // The bar carries whichever club you're in, and the site's own name only
  // on the pages that belong to neither (the chooser, logging in). Home is
  // the club's front door when you're in one, so the mark doesn't bounce
  // you back out to the chooser.
  const name = club?.name ?? SITE.name;
  const home = user ? "/activities" : club ? `/${club.slug}` : "/";
  const noun = user ? clubFor(user.club).noun : null;

  return (
    // Violet-700 is the exact top stop of the body gradient (globals.css),
    // so the bar reads as the top of the page rather than a separate strip
    // sitting on it, and white text/marks have something to sit on.
    <header className="border-b border-white/15 dark:border-slate-200 bg-violet-700/85 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link
          href={home}
          className="font-bold text-lg text-white flex items-center gap-2 min-w-0 shrink"
        >
          <span className="nav-mark">
            {/* White variant, same reason as the hero: the gradient mark
                dissolves into a purple background. */}
            <Logo variant="white" />
          </span>
          <span className="truncate">{name}</span>
        </Link>
        {/* Tighter gaps on a phone: an admin's row (club name + four links
            + the theme toggle) is wider than a 390px screen at the
            roomier desktop spacing. */}
        <nav className="flex items-center gap-3 sm:gap-4 text-sm text-white/90 shrink-0">
          {user ? (
            <>
              <Link href="/activities" className="hover:text-white capitalize">
                {noun!.many}
              </Link>
              <Link href="/profile" className="hover:text-white">
                Profile
              </Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="hover:text-white font-semibold">
                  Admin
                </Link>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href={club ? `/login?club=${club.slug}` : "/login"}
                className="hover:text-white"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-primary !px-3 !py-1.5">
                Sign up
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
