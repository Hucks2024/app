import { readError } from "@/lib/flash";
import { redirect } from "next/navigation";
import { requireUser, needsEmailCheck, safeNext } from "@/lib/auth";
import { confirmEmailAction, resendCodeAction } from "@/app/verify-email/actions";
import LogoutButton from "@/components/LogoutButton";
import CodeInput from "@/components/CodeInput";

export const metadata = { title: "Check your email" };

// The one extra step after joining, when email is switched on. Kept to a
// single box and a single button, with the two things that go wrong
// (the email is slow, or in spam; the address was mistyped) answered
// right there rather than on a help page.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sig?: string; sent?: string; next?: string }>;
}) {
  const { error: rawError, sig, sent, next: rawNext } = await searchParams;
  const error = readError(rawError, sig);
  const user = await requireUser();
  const next = safeNext(rawNext);

  // Already done, or email checks aren't switched on: nothing to ask for.
  if (!needsEmailCheck(user)) redirect(next);

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <p className="text-center text-5xl" aria-hidden="true">
        📬
      </p>
      <h1 className="mt-3 text-center text-3xl font-bold text-white drop-shadow">Check your email</h1>
      <p className="mt-3 text-center text-lg text-white">
        We sent a code to
        <br />
        <strong className="break-all">{user.email}</strong>
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-base font-medium text-red-800">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="mt-5 rounded-2xl bg-white px-4 py-3 text-base font-medium text-brand-800">
          ✓ New code sent.
        </p>
      )}

      <form action={confirmEmailAction} className="mt-6 space-y-3">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="code" className="field-label">
          Code from the email
        </label>
        <CodeInput describedBy="code-hint" />
        <p id="code-hint" className="field-hint">
          Not there? Check spam.
        </p>
        <button type="submit" className="pill-btn pill-black">
          Continue
        </button>
      </form>

      <form action={resendCodeAction} className="mt-6 text-center">
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="min-h-11 text-base font-medium text-white underline underline-offset-2">
          Send a new code
        </button>
      </form>

      <div className="mt-4 text-center text-base text-white">
        <p>Wrong email?</p>
        <LogoutButton className="min-h-11 font-medium underline underline-offset-2" />
      </div>
    </div>
  );
}
