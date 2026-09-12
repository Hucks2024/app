import { redirect } from "next/navigation";
import { requireUser, needsEmailCheck } from "@/lib/auth";
import { confirmEmailAction, resendCodeAction } from "@/app/verify-email/actions";
import LogoutButton from "@/components/LogoutButton";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const user = await requireUser();

  // Already done, or email checks aren't switched on: nothing to ask for.
  if (!needsEmailCheck(user)) redirect("/activities");

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold mb-2 text-white drop-shadow">Check your email</h1>
      <p className="text-sm text-white/85 mb-6">
        We sent a six-digit code to <strong className="text-white">{user.email}</strong>. Pop it in
        below and you&apos;re in.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </p>
      )}
      {sent && (
        <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-300">
          New code sent.
        </p>
      )}

      <form action={confirmEmailAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="code">
            Your code
          </label>
          <input
            className="input text-center text-2xl tracking-[0.4em] font-mono"
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
          />
          <p className="text-xs text-slate-500 mt-1">It expires in 15 minutes.</p>
        </div>
        <button type="submit" className="btn-primary w-full">
          Confirm
        </button>
      </form>

      <form action={resendCodeAction} className="mt-4 text-center">
        <button type="submit" className="text-sm text-white/85 underline">
          Didn&apos;t get it? Send another
        </button>
      </form>

      <div className="text-xs text-white/70 text-center mt-6 flex items-center justify-center gap-1">
        <span>Wrong address? Log out and sign up again.</span>
        <LogoutButton />
      </div>
    </div>
  );
}
