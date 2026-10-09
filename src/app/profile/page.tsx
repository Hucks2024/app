import Link from "next/link";
import { hasOwnPassword, requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { ensureMemberNumber, formatMemberNumber } from "@/lib/member";
import { refreshVerified, thumbsFor } from "@/lib/trust";
import { categoryFor } from "@/lib/categories";
import { SITE } from "@/lib/site";
import { readError } from "@/lib/flash";
import {
  deleteAccountAction,
  unblockUserAction,
  updateProfileAction,
} from "@/app/profile/actions";
import Avatar from "@/components/Avatar";
import CopyableField from "@/components/CopyableField";
import LocalTime from "@/components/LocalTime";
import SubmitButton from "@/components/SubmitButton";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import InstallHint from "@/components/InstallHint";
import { inApp } from "@/lib/in-app";
import StoreBadges, { storeLinks } from "@/components/StoreBadges";
import LogoutButton from "@/components/LogoutButton";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sig?: string; saved?: string; blocked?: string }>;
}) {
  const { error: rawError, sig, saved, blocked: justBlocked } = await searchParams;
  const error = readError(rawError, sig);
  const user = await requireUser();

  const prisma = await getPrisma();
  const memberNumber = await ensureMemberNumber(prisma, user.id);
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
  // In the App Store app: no "get the app" card.
  const app = await inApp();
  const blocks = await prisma.block.findMany({
    where: { blockerId: user.id },
    orderBy: { createdAt: "desc" },
    select: { blocked: { select: { id: true, name: true, profilePhotoType: true } } },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="flex items-center gap-4 mb-6">
        {/* Tap the face to change it: the one photo screen, shared with joining. */}
        <Link href="/photo" aria-label="Change your photo" className="relative flex-none">
          <Avatar userId={user.id} hasPhoto={!!user.profilePhotoType} size={16} />
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow" aria-hidden="true">
            📷
          </span>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white drop-shadow truncate">{user.name}</h1>
          <p className="text-sm text-white">Member #{formatMemberNumber(memberNumber)}</p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2">
          ✓ Saved.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card !p-4 text-center">
          <p className="text-3xl font-bold text-slate-900">👍 {thumbs}</p>
          <p className="text-sm text-slate-500 mt-1">thumbs up</p>
        </div>
        <div className="card !p-4 text-center">
          {verified ? (
            <>
              <p className="text-3xl font-bold text-brand-700">✓</p>
              <p className="text-sm text-slate-500 mt-1">You can post</p>
            </>
          ) : (
            <>
              <p className="text-3xl" aria-hidden="true">
                🌱
              </p>
              <p className="text-sm text-slate-500 mt-1">Go to 1 meetup to post</p>
            </>
          )}
        </div>
      </div>

      {/* The real app once it's in the stores; until then, how to put the
          site on the home screen. */}
      {app ? null : Object.values(storeLinks()).some(Boolean) ? (
        <div className="card mb-4">
          <p className="mb-3 font-semibold">Get the app</p>
          <StoreBadges />
        </div>
      ) : (
        <InstallHint />
      )}

      <div className="card mb-4">
        <p className="font-semibold mb-3">Your meetups</p>
        {upcoming.length === 0 && past.length === 0 ? (
          <p className="text-sm text-slate-600">
            None yet.{" "}
            <Link href="/" className="font-medium text-brand-700 underline">
              Find one →
            </Link>
          </p>
        ) : (
          <div className="space-y-4">
            {upcoming.length > 0 && <MeetupLinks label="Coming up" rows={upcoming} />}
            {past.length > 0 && (
              <MeetupLinks label="Been to" rows={past} toPeople />
            )}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <p className="font-semibold mb-1">Bring a friend 🎒</p>
        <p className="text-sm text-slate-600 mb-3">Send them this link.</p>
        <CopyableField value={SITE.url} shown={SITE.domain} />
      </div>

      <form action={updateProfileAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input className="input" id="name" name="name" defaultValue={user.name} required />
        </div>
        <SubmitButton className="btn-primary w-full" pending="Saving…">
          Save
        </SubmitButton>
      </form>

      <div className="card mt-4">
        <p className="font-semibold mb-3">
          {hasOwnPassword(user) ? "Change password" : "Set a password"}
        </p>
        <ChangePasswordForm needsCurrent={hasOwnPassword(user)} />
      </div>


      {(blocks.length > 0 || justBlocked) && (
        <div id="blocked" className="card mt-4 scroll-mt-20">
          <p className="mb-1 font-semibold">Blocked</p>
          <p className="mb-3 text-sm text-slate-600">You don&apos;t see each other&apos;s meetups.</p>
          {justBlocked && (
            <p role="status" className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-base text-brand-800">
              Blocked.
            </p>
          )}
          <ul className="space-y-3">
            {blocks.map(({ blocked }) => (
              <li key={blocked.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar userId={blocked.id} hasPhoto={!!blocked.profilePhotoType} size={10} />
                  <span className="truncate text-base font-semibold">{blocked.name}</span>
                </span>
                <form action={unblockUserAction}>
                  <input type="hidden" name="blockedId" value={blocked.id} />
                  <SubmitButton className="btn-secondary min-h-11 px-4" pending="…">
                    Unblock
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stacked, not side by side: a long email address pushed the
          button off the card. */}
      <div className="card mt-4">
        <p className="text-base text-slate-700">Signed in as</p>
        <p className="mb-3 break-all text-base font-semibold text-slate-900">{user.email}</p>
        <LogoutButton className="btn-secondary min-h-12 w-full" />
      </div>

      {/* Folded away and two taps deep: it's for good, and it should take
          meaning to do. */}
      <details className="card mt-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-red-700">
          Delete my account
        </summary>
        <p className="text-base text-slate-700 mt-3">Deletes everything. You can&apos;t undo it.</p>
        <form action={deleteAccountAction} className="mt-3">
          <SubmitButton className="btn-danger w-full" pending="Deleting…">
            Yes, delete it
          </SubmitButton>
        </form>
      </details>

      <p className="mt-6 text-center text-sm text-white">
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <a href={`mailto:${SITE.contactEmail}`} className="underline">
          {SITE.contactEmail}
        </a>
      </p>
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
                <span className="block text-sm text-slate-500">
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
