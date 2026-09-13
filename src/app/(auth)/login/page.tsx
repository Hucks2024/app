import Link from "next/link";
import { loginAction } from "@/app/(auth)/actions";
import { CLUBS, DEFAULT_CLUB, clubBySlug } from "@/lib/clubs";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; club?: string }>;
}) {
  const { error, club: clubSlug } = await searchParams;
  // Arriving from a club's front door pre-picks that club; arriving at
  // /login cold falls back to the bigger of the two rather than making the
  // first thing anyone does be answer a question.
  const preselected = clubBySlug(clubSlug)?.key ?? DEFAULT_CLUB;

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-6 text-white drop-shadow">Log in</h1>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </p>
      )}
      <form action={loginAction} className="card space-y-4">
        {/* The two clubs are separate memberships, so an address alone no
            longer says which account this is: the same person can hold one
            on each side. Radios rather than a select, because with two
            options it's one tap instead of two and both names stay
            visible. */}
        <fieldset>
          <legend className="label">Which club?</legend>
          <div className="grid grid-cols-2 gap-2">
            {CLUBS.map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950"
              >
                <input
                  type="radio"
                  name="club"
                  value={c.key}
                  defaultChecked={c.key === preselected}
                  className="accent-brand-600"
                />
                <span aria-hidden="true">{c.emoji}</span>
                <span className="font-medium">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input className="input" id="password" name="password" type="password" required />
        </div>
        <button type="submit" className="btn-primary w-full">
          Log in
        </button>
      </form>
      <p className="mt-6 text-sm text-white/85">
        New here?{" "}
        <Link href="/signup" className="underline font-medium text-white">
          Create an account
        </Link>
      </p>
    </div>
  );
}
