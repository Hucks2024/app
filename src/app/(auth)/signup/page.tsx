import Link from "next/link";
import { signupAction } from "@/app/(auth)/actions";
import { CLUBS } from "@/lib/clubs";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  // Members share a link with their code already in it
  // (/signup?code=ABCD1234), so most people never type it by hand.
  const { error, code } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-2 text-white drop-shadow">Create your account</h1>
      <p className="text-sm text-white/85 mb-6">
        Both clubs are invite only, and stay that way on purpose. You need a code from a member,
        and their name stays attached to yours, which is why the people here are worth turning up
        for. Free to join, and free to stay while we&apos;re small.
      </p>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </p>
      )}
      {/* In a card rather than straight on the gradient: the field labels
          are slate, which is all but unreadable on purple. */}
      <form action={signupAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="inviteCode">
            Invite code
          </label>
          <input
            className="input uppercase tracking-widest font-mono"
            id="inviteCode"
            name="inviteCode"
            defaultValue={code ?? ""}
            placeholder="ABCD1234"
            required
            autoFocus={!code}
          />
          {/* There's no club picker on this form on purpose: the code
              already decides, and asking as well would invite people to
              pick the side their code doesn't open. */}
          <p className="text-xs text-slate-500 mt-1">
            Your code decides which club you join, {CLUBS.map((c) => c.name).join(" or ")}. A code
            only opens the one it came from.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input className="input" id="name" name="name" required autoFocus={!!code} />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
          />
          <p className="text-xs text-slate-500 mt-1">At least 8 characters.</p>
        </div>
        <button type="submit" className="btn-primary w-full">
          Sign up
        </button>
      </form>
      <p className="mt-6 text-sm text-white/85">
        Already have an account?{" "}
        <Link href="/login" className="underline font-medium text-white">
          Log in
        </Link>
      </p>
    </div>
  );
}
