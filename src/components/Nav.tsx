import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/site";
import LogoutButton from "@/components/LogoutButton";

export default async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg text-brand-700 flex items-center gap-2">
          <span aria-hidden className="nav-runner">
            🏃
          </span>{" "}
          {SITE.name}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link href="/activities" className="hover:text-brand-700">
                Runs
              </Link>
              <Link href="/profile" className="hover:text-brand-700">
                Profile
              </Link>
              {user.verificationStatus !== "APPROVED" && (
                <Link href="/verify" className="badge-amber">
                  Get verified
                </Link>
              )}
              {user.role === "ADMIN" && (
                <Link href="/admin" className="hover:text-brand-700 font-semibold">
                  Admin
                </Link>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-brand-700">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary !px-3 !py-1.5">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
      {!user && (
        <div className="mx-auto max-w-5xl px-4 pb-2 -mt-1">
          <p className="text-xs text-slate-500">Built around runs · Easy to report</p>
        </div>
      )}
    </header>
  );
}
