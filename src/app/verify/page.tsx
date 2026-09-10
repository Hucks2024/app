import Link from "next/link";
import { requirePaidUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { submitVerificationAction } from "@/app/verify/actions";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { error, submitted } = await searchParams;
  // Pay first, then verify, requirePaidUser sends anyone without a paid-up
  // membership to /subscribe before they ever see this page.
  const user = await requirePaidUser();
  const prisma = await getPrisma();
  const verification = await prisma.verificationRequest.findUnique({
    where: { userId: user.id },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-2 text-white drop-shadow">Get verified</h1>
      <p className="text-sm text-white/85 mb-6">
        To keep this a space for real runners, not creeps hiding behind a fake profile, we
        check a selfie against a photo ID before you can join or host a run. A person reviews
        every submission; nothing is auto-approved. Your ID photo is deleted from our database
        as soon as it&apos;s reviewed; we only keep the decision, not the image.
      </p>

      {user.verificationStatus === "APPROVED" && (
        <div className="card bg-brand-50 border-brand-200 dark:bg-brand-950 dark:border-brand-800">
          <p className="font-semibold text-brand-800 dark:text-brand-300">You&apos;re verified ✅</p>
          <p className="text-sm text-brand-700 dark:text-brand-300 mt-1">
            <Link href="/activities" className="underline">
              Head to the runs feed →
            </Link>
          </p>
        </div>
      )}

      {user.verificationStatus === "PENDING" && (
        <div className="card bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <p className="font-semibold text-amber-800 dark:text-amber-300">Your verification is under review</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Submitted {verification?.submittedAt.toLocaleString()}. This is usually reviewed
            within a day. You&apos;ll be able to join and host runs as soon as it&apos;s approved.
          </p>
        </div>
      )}

      {(user.verificationStatus === "UNSUBMITTED" || user.verificationStatus === "REJECTED") && (
        <>
          {user.verificationStatus === "REJECTED" && (
            <div className="card bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800 mb-4">
              <p className="font-semibold text-red-800 dark:text-red-300">Your last submission wasn&apos;t approved</p>
              {verification?.reviewerNote && (
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">Note: {verification.reviewerNote}</p>
              )}
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                You can submit new photos below and we&apos;ll take another look.
              </p>
            </div>
          )}

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
              {error}
            </p>
          )}
          {submitted && (
            <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-300">
              Submitted! We&apos;ll email/notify you once it&apos;s reviewed.
            </p>
          )}

          <form action={submitVerificationAction} className="card space-y-5">
            <div>
              <label className="label" htmlFor="selfie">
                A clear selfie (just you, face visible)
              </label>
              <input
                className="input"
                id="selfie"
                name="selfie"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="idPhoto">
                Photo of a government-issued ID (driver&apos;s license, passport, etc.)
              </label>
              <input
                className="input"
                id="idPhoto"
                name="idPhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Only used once to confirm you&apos;re a real person matching your selfie, then
                permanently deleted. Never shown on your public profile.
              </p>
            </div>
            <button type="submit" className="btn-primary w-full">
              Submit for review
            </button>
          </form>
        </>
      )}
    </div>
  );
}
