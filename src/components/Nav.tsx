import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/site";
import LogoutButton from "@/components/LogoutButton";
import Logo from "@/components/Logo";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    // Violet-700 is the exact top stop of the body gradient (globals.css),
    // so the bar reads as the top of the page rather than a separate strip
    // sitting on it, and white text/marks have something to sit on.
    <header className="border-b border-white/15 bg-violet-700/85 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-lg text-white flex items-center gap-2 min-w-0 shrink"
        >
          <span className="nav-mark">
            {/* White variant, same reason as the hero: the gradient mark
                dissolves into a purple background. */}
            <Logo variant="white" size={32} />
          </span>
          <span className="font-wordmark font-semibold text-[22px] min-[375px]:text-2xl truncate">
            {SITE.name}
          </span>
        </Link>
        {/* Tighter gaps on a phone: an admin's row (the name + four
            links) is wider than a 390px screen at the roomier desktop
            spacing. */}
        <nav className="flex items-center gap-3 sm:gap-4 text-sm text-white/90 shrink-0">
          {user ? (
            <>
              {/* Not on a phone: it's the same map the name already opens,
                  and the name needs the room more than a second way in. */}
              <Link href="/activities" className="hidden sm:inline hover:text-white">
                Meetups
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
              <Link href="/login" className="hover:text-white">
                Log in
              </Link>
              {/* Not "Sign up": there is no open signup, and a button
                  promising one sends people to a form they can't finish.
                  This says the price of entry up front. */}
              <Link href="/signup" className="btn-primary !px-3 !py-1.5">
                I have a code
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
