import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/site";
import LogoutButton from "@/components/LogoutButton";
import Logo from "@/components/Logo";
import { getT } from "@/i18n/server";
import { fill } from "@/i18n/format";

export default async function Nav() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);

  return (
    // Violet-700 is the exact top stop of the body gradient (globals.css),
    // so the bar reads as the top of the page rather than a separate strip
    // sitting on it, and white text/marks have something to sit on.
    // Padded down past the clock and notch in the app (0 everywhere else).
    <header className="border-b border-white/15 bg-violet-700/85 backdrop-blur sticky top-0 z-[1400] pt-[env(safe-area-inset-top)]">
      {/* A fixed 56px, so the full-screen map knows exactly where it starts. */}
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="font-bold text-lg text-white flex items-center gap-2 min-w-0 shrink"
          aria-label={fill(t.common.home, { site: SITE.name })}
        >
          <span className="nav-mark">
            {/* White variant, same reason as the hero: the gradient mark
                dissolves into a purple background. */}
            <Logo variant="white" size={32} />
          </span>
          {/* translate="no": a phone translating the page would otherwise
              turn the name into "pack mates" in somebody else's words. */}
          <span translate="no" className="font-wordmark font-semibold text-[20px] min-[360px]:text-[22px] min-[375px]:text-2xl lowercase truncate">
            {SITE.name}
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-base font-medium text-white shrink-0" aria-label="Top">
          {user ? (
            <>
              {/* On a phone the bottom bar carries these, within thumb's
                  reach; up here they're for bigger screens. */}
              <Link href="/" className="nav-link hidden sm:inline-flex">
                {t.common.map}
              </Link>
              <Link href="/activities/new" className="nav-link hidden sm:inline-flex">
                {t.common.postMeetup}
              </Link>
              <Link href="/profile" className="nav-link hidden sm:inline-flex">
                {t.common.me}
              </Link>
              <Link href="/info" className="nav-link hidden sm:inline-flex">
                {t.common.info}
              </Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="nav-link font-bold">
                  {t.common.admin}
                </Link>
              )}
              <span className="hidden sm:inline-flex">
                <LogoutButton />
              </span>
            </>
          ) : (
            <>
              {/* An icon on a narrow phone, so a longer word for Sign up
                  (Spanish, French, Hindi) never squeezes the name. */}
              <Link href="/info" className="nav-link max-[419px]:!px-1.5" aria-label={t.common.info}>
                <svg
                  viewBox="0 0 24 24"
                  width="26"
                  height="26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="min-[420px]:hidden"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6" />
                  <circle cx="12" cy="7.5" r="0.6" fill="currentColor" />
                </svg>
                <span className="hidden min-[420px]:inline">{t.common.info}</span>
              </Link>
              {/* One button, because there's one way in: new and returning
                  members both start here, and the screen works out which.
                  Worded for the newcomer. */}
              <Link href="/login" className="nav-signin">
                {t.common.signUp}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
