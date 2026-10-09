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
    <header className="border-b border-white/15 bg-violet-700/85 backdrop-blur sticky top-0 z-[1400]">
      {/* A fixed 56px, so the full-screen map knows exactly where it starts. */}
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="font-bold text-lg text-white flex items-center gap-2 min-w-0 shrink"
          aria-label={`${SITE.name}, home`}
        >
          <span className="nav-mark">
            {/* White variant, same reason as the hero: the gradient mark
                dissolves into a purple background. */}
            <Logo variant="white" size={32} />
          </span>
          {/* translate="no": a phone translating the page would otherwise
              turn the name into "pack mates" in somebody else's words. */}
          <span translate="no" className="font-wordmark font-semibold text-[22px] min-[375px]:text-2xl lowercase truncate">
            {SITE.name}
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-base font-medium text-white shrink-0" aria-label="Top">
          {user ? (
            <>
              {/* On a phone the bottom bar carries these, within thumb's
                  reach; up here they're for bigger screens. */}
              <Link href="/" className="nav-link hidden sm:inline-flex">
                Map
              </Link>
              <Link href="/activities/new" className="nav-link hidden sm:inline-flex">
                Post a meetup
              </Link>
              <Link href="/profile" className="nav-link hidden sm:inline-flex">
                Me
              </Link>
              <Link href="/info" className="nav-link hidden sm:inline-flex">
                Info
              </Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="nav-link font-bold">
                  Admin
                </Link>
              )}
              <span className="hidden sm:inline-flex">
                <LogoutButton />
              </span>
            </>
          ) : (
            <>
              <Link href="/info" className="nav-link">
                Info
              </Link>
              {/* One button, because there's one way in: new and returning
                  members both start here, and the screen works out which. */}
              <Link href="/login" className="nav-signin">
                Sign in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
