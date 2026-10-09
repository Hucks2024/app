import { redirect } from "next/navigation";
import { readError } from "@/lib/flash";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { refreshVerified } from "@/lib/trust";
import LocalTime from "@/components/LocalTime";
import MeetupForm from "@/components/MeetupForm";

export const metadata = { title: "Post a meetup" };

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sig?: string }>;
}) {
  const user = await requireUser();
  const { error: rawError, sig } = await searchParams;
  const error = readError(rawError, sig);
  const prisma = await getPrisma();

  // Not unlocked yet: say how, and if they're already going to something,
  // say that's the one that'll do it.
  if (!(await refreshVerified(prisma, user)).verified) {
    const next = await prisma.participation.findFirst({
      where: {
        userId: user.id,
        status: "JOINED",
        activity: { startsAt: { gt: new Date() }, cancelledAt: null },
      },
      orderBy: { activity: { startsAt: "asc" } },
      select: { activity: { select: { id: true, title: true, startsAt: true } } },
    });
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="card text-center">
          <p className="text-4xl" aria-hidden="true">
            🔓
          </p>
          <h1 className="mt-2 text-xl font-bold">Go to one meetup first</h1>
          <p className="mt-2 text-base text-slate-700">Any meetup, anywhere.</p>
          <p className="text-base text-slate-700">Then you can post your own.</p>
          {next ? (
            <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-base text-brand-800">
              You&apos;re going to{" "}
              <Link href={`/activities/${next.activity.id}`} className="font-semibold underline">
                {next.activity.title}
              </Link>{" "}
              (<LocalTime iso={next.activity.startsAt.toISOString()} style="short" />). After
              that, you can post.
            </p>
          ) : (
            <ol className="mt-4 space-y-1 text-left text-base text-slate-700 inline-block">
              <li>1. Pick a meetup</li>
              <li>2. Tap <strong>I&apos;m in</strong></li>
              <li>3. Go</li>
            </ol>
          )}
          <div className="mt-6">
            <Link href="/" className="btn-primary">
              Find a meetup
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Hosts are who people look for first, so a photo comes before posting.
  if (!user.profilePhotoType) redirect("/photo?next=/activities/new");

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1 text-white drop-shadow">Post a meetup</h1>
      <p className="text-base text-white mb-6">
        4 quick questions.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}

      <MeetupForm />
    </div>
  );
}
