import Link from "next/link";
import { hasOwnPassword, requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { ensureMembership, formatMemberNumber } from "@/lib/invite";
import { refreshVerified, thumbsFor } from "@/lib/trust";
import { categoryFor } from "@/lib/categories";
import { SITE } from "@/lib/site";
import { deleteAccountAction, updateProfileAction } from "@/app/profile/actions";
import Avatar from "@/components/Avatar";
import CopyableField from "@/components/CopyableField";
import LocalTime from "@/components/LocalTime";
import SubmitButton from "@/components/SubmitButton";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import PhotoInput from "@/components/PhotoInput";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const user = await requireUser();

  const prisma = await getPrisma();
  const { memberNumber } = await ensureMembership(prisma, user.id);
  const { verified } = await refreshVerified(prisma, user);
  const thumbs = (await thumbsFor(prisma, [user.id])).get(user.id) ?? 0;

  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.participation.findMany({
      where: { userId: user.id, status: "JOINED", activity: { startsAt: { gt: now } } },
      orderBy: { activity: { startsAt: "asc" } },
      take: 5,
      select: {
        activity: { select: { id: true, title: true, startsAt: true, category: true, cancelledAt: true } },
      },
    }),
    prisma.participation.findMany({
      // Called-off ones didn't happen, so they're not somewhere you've been.
      where: {
        userId: user.id,
        status: "JOINED",
        activity: { startsAt: { lte: now }, cancelledAt: null },
      },
      orderBy: { activity: { startsAt: "desc" } },
      take: 5,
      select: {
        activity: { select: { id: true, title: true, startsAt: true, category: true, cancelledAt: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="flex items-center gap-4 mb-6">
        <Avatar userId={user.id} hasPhoto={!!user.profilePhotoType} size={16} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white drop-shadow truncate">{user.name}</h1>
          <p className="text-sm text-white/80">Member #{formatMemberNumber(memberNumber)}</p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2">
          Profile saved.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card !p-4 text-center">
          <p className="text-3xl font-bold text-slate-900">👍 {thumbs}</p>
          <p className="text-xs text-slate-500 mt-1">
            thumbs up from people you&apos;ve met
          </p>
        </div>
        <div className="card !p-4 text-center">
          {verified ? (
            <>
              <p className="text-3xl font-bold text-brand-700">✓</p>
              <p className="text-xs text-slate-500 mt-1">Verified. You can post meetups.</p>
            </>
          ) : (
            <>
              <p className="text-3xl" aria-hidden="true">
                🌱
              </p>
              <p className="text-xs text-slate-500 mt-1">
                New member. Go to one meetup to unlock posting.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="card mb-4">
        <p className="font-semibold mb-3">Your meetups</p>
        {upcoming.length === 0 && past.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nothing yet.{" "}
            <Link href="/" className="font-medium text-brand-700 underline">
              Find one on the map →
            </Link>
          </p>
        ) : (
          <div className="space-y-4">
            {upcoming.length > 0 && <MeetupLinks label="Coming up" rows={upcoming} />}
            {past.length > 0 && (
              <MeetupLinks label="Been to (give your 👍 here)" rows={past} toPeople />
            )}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <p className="font-semibold mb-1">Bring a friend 🎒</p>
        <p className="text-sm text-slate-600 mb-3">
          It&apos;s free and there&apos;s no invite code. Send them this.
        </p>
        <CopyableField value={SITE.url} />
      </div>

      <form action={updateProfileAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input className="input" id="name" name="name" defaultValue={user.name} required />
        </div>
        <div>
          <label className="label" htmlFor="city">
            City / area
          </label>
          <input className="input" id="city" name="city" defaultValue={user.city ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="pace">
            Typical pace
          </label>
          <input
            className="input"
            id="pace"
            name="pace"
            placeholder="e.g. 5:30 / km, easy conversational"
            defaultValue={user.pace ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="bio">
            Bio
          </label>
          <textarea
            className="input"
            id="bio"
            name="bio"
            rows={3}
            defaultValue={user.bio ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="profilePhoto">
            Profile photo
          </label>
          <PhotoInput />
        </div>
        <SubmitButton className="btn-primary w-full" pending="Saving…">
          Save
        </SubmitButton>
      </form>

      <div className="card mt-4">
        <p className="font-semibold mb-1">
          {hasOwnPassword(user) ? "Change your password" : "Set a password"}
        </p>
        <p className="text-sm text-slate-600 mb-4">
          {hasOwnPassword(user)
            ? "Changing it signs you out everywhere else."
            : "So you can also sign in with your email."}
        </p>
        <ChangePasswordForm needsCurrent={hasOwnPassword(user)} />
      </div>

      {/* Folded away and two taps deep: it's for good, and it should take
          meaning to do. */}
      <details className="card mt-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-red-700">
          Delete my account
        </summary>
        <p className="text-sm text-slate-600 mt-3">
          This deletes your account for good: your profile, your thumbs up, your places on
          meetups, and any meetups you&apos;re hosting. It can&apos;t be undone.
        </p>
        <form action={deleteAccountAction} className="mt-3">
          <SubmitButton className="btn-danger w-full" pending="Deleting…">
            Yes, delete my account for good
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}

type MeetupRow = {
  activity: { id: string; title: string; startsAt: Date; category: string; cancelledAt: Date | null };
};

function MeetupLinks({
  label,
  rows,
  toPeople = false,
}: {
  label: string;
  rows: MeetupRow[];
  // Straight down to the people (and their thumbs up buttons) for ones
  // that have happened.
  toPeople?: boolean;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <ul className="divide-y divide-slate-100">
        {rows.map(({ activity: a }) => (
          <li key={a.id}>
            <Link
              href={`/activities/${a.id}${toPeople ? "#people" : ""}`}
              className="flex items-center gap-3 py-2 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
            >
              <span className="text-xl" aria-hidden="true">
                {categoryFor(a.category).emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">{a.title}</span>
                <span className="block text-xs text-slate-500">
                  <LocalTime iso={a.startsAt.toISOString()} style="short" />
                  {a.cancelledAt && <span className="ml-1.5 font-semibold text-red-700">Cancelled</span>}
                </span>
              </span>
              <span className="text-slate-400" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
