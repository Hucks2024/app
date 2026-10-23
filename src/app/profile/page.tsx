import Link from "next/link";
import { hasOwnPassword, requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { ensureMemberNumber, formatMemberNumber } from "@/lib/member";
import { refreshVerified, thumbsFor } from "@/lib/trust";
import { emojiFor } from "@/lib/categories";
import ContactEmail from "@/components/ContactEmail";
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
import { TicketRow } from "@/components/Ticket";
import SubmitButton from "@/components/SubmitButton";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import InstallHint from "@/components/InstallHint";
import { inApp } from "@/lib/in-app";
import StoreBadges, { storeLinks } from "@/components/StoreBadges";
import LogoutButton from "@/components/LogoutButton";
import LanguagePicker from "@/components/LanguagePicker";
import { CAN_PICK_LANGUAGE } from "@/i18n/config";
import { getT } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";
import PickOne from "@/components/PickOne";
import { GENDERS, GENDER_EMOJI, isGender, whoFor } from "@/lib/gender";

export async function generateMetadata() {
  return { title: (await getT()).common.me };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sig?: string; saved?: string; blocked?: string }>;
}) {
  const { error: rawError, sig, saved, blocked: justBlocked } = await searchParams;
  const error = readError(rawError, sig);
  const user = await requireUser();

  const [prisma, t] = await Promise.all([getPrisma(), getT()]);
  const now = new Date();
  const meetup = {
    select: { id: true, title: true, startsAt: true, category: true, emoji: true, forWho: true, cancelledAt: true },
  };

  // None of these wait on each other, so they're all asked for at once.
  const [memberNumber, { verified }, thumbs, upcoming, past, blocks, app] = await Promise.all([
    // Given out the first time someone opens Me, and kept from then on.
    user.memberNumber ?? ensureMemberNumber(prisma, user.id),
    refreshVerified(prisma, user),
    thumbsFor(prisma, [user.id]).then((all) => all.get(user.id) ?? 0),
    prisma.participation.findMany({
      where: { userId: user.id, status: "JOINED", activity: { startsAt: { gt: now } } },
      orderBy: { activity: { startsAt: "asc" } },
      take: 5,
      select: { activity: meetup },
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
      select: { activity: meetup },
    }),
    prisma.block.findMany({
      where: { blockerId: user.id },
      orderBy: { createdAt: "desc" },
      select: { blocked: { select: { id: true, name: true, profilePhotoType: true, photoUpdatedAt: true } } },
    }),
    // In the App Store app: no "get the app" card.
    inApp(),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="flex items-center gap-4 mb-6">
        {/* Tap the face to change it: the one photo screen, shared with joining. */}
        <Link href="/photo" aria-label={t.me.changePhoto} className="relative flex-none">
          <Avatar userId={user.id} hasPhoto={!!user.profilePhotoType} version={user.photoUpdatedAt} size={16} />
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow" aria-hidden="true">
            📷
          </span>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white drop-shadow truncate">{user.name}</h1>
          {/* Everyone's Diamond+: one membership, the same for all. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white">
            <Link href="/info#diamond" className="diamond-badge">
              <span aria-hidden="true">💎</span> {t.me.diamond}
            </Link>
            <span className="tabular-nums">#{formatMemberNumber(memberNumber)}</span>
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2">
          ✓ {t.meetup.saved}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card !p-4 text-center">
          <p className="text-3xl font-bold text-slate-900">👍 {thumbs}</p>
          <p className="text-sm text-slate-500 mt-1">{t.me.thumbsUp}</p>
        </div>
        <div className="card !p-4 text-center">
          {verified ? (
            <>
              <p className="text-3xl font-bold text-brand-700">✓</p>
              <p className="text-sm text-slate-500 mt-1">{t.me.canPost}</p>
            </>
          ) : (
            <>
              <p className="text-3xl" aria-hidden="true">
                🌱
              </p>
              <p className="text-sm text-slate-500 mt-1">{t.me.goToPost}</p>
            </>
          )}
        </div>
      </div>

      {/* The real app once it's in the stores; until then, how to put the
          site on the home screen. */}
      {app ? null : Object.values(storeLinks()).some(Boolean) ? (
        <div className="card mb-4">
          <p className="mb-3 font-semibold">{t.install.getApp}</p>
          <StoreBadges />
        </div>
      ) : (
        <InstallHint />
      )}

      <div className="card mb-4">
        <p className="font-semibold mb-3">{t.me.yourMeetups}</p>
        {upcoming.length === 0 && past.length === 0 ? (
          <p className="text-sm text-slate-600">
            {t.me.noneYet}{" "}
            <Link href="/" className="font-medium text-brand-700 underline">
              {t.me.findOne} →
            </Link>
          </p>
        ) : (
          <div className="space-y-4">
            {upcoming.length > 0 && <MeetupLinks t={t} label={t.board.comingUp} rows={upcoming} />}
            {past.length > 0 && <MeetupLinks t={t} label={t.me.beenTo} rows={past} toPeople />}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <p className="font-semibold mb-1">{t.me.bringFriend} 🎒</p>
        <p className="text-sm text-slate-600 mb-3">{t.me.sendLink}</p>
        <CopyableField value={SITE.url} shown={SITE.domain} />
      </div>

      {CAN_PICK_LANGUAGE && (
        <div className="card !p-4">
          <LanguagePicker />
        </div>
      )}

      {(blocks.length > 0 || justBlocked) && (
        <div id="blocked" className="card mt-4 scroll-mt-20">
          <p className="mb-1 font-semibold">{t.me.blocked}</p>
          <p className="mb-3 text-sm text-slate-600">{t.me.blockedNote}</p>
          {justBlocked && (
            <p role="status" className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-base text-brand-800">
              {t.me.blockedDone}
            </p>
          )}
          <ul className="space-y-3">
            {blocks.map(({ blocked }) => (
              <li key={blocked.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar userId={blocked.id} hasPhoto={!!blocked.profilePhotoType} version={blocked.photoUpdatedAt} size={10} />
                  <span className="truncate text-base font-semibold">{blocked.name}</span>
                </span>
                <form action={unblockUserAction}>
                  <input type="hidden" name="blockedId" value={blocked.id} />
                  <SubmitButton className="btn-secondary min-h-11 px-4" pending="…">
                    {t.me.unblock}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Everything that's set once and rarely touched, folded into one
          tap, so the page is just you and your meetups. Open after a save
          or an error, so the message is in view. */}
      <details id="settings" className="card mt-4 help-item scroll-mt-20" open={Boolean(saved || error) || undefined}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-lg font-semibold text-slate-900">
          ⚙️ {t.me.settings}
          <span className="help-chevron text-2xl text-brand-700" aria-hidden="true">
            +
          </span>
        </summary>
        <div className="mt-4 space-y-6">
          <form action={updateProfileAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="name">
                {t.form.name}
              </label>
              <input className="input" id="name" name="name" defaultValue={user.name} required />
            </div>
            {/* Set for good at sign up (see updateProfileAction): shown, not
                changed. Only somebody with none yet gets to pick. */}
            {isGender(user.gender) ? (
              <div>
                <p className="label">{t.gender.iAm}</p>
                <p className="text-base font-semibold text-slate-900">
                  {GENDER_EMOJI[user.gender]} {t.gender[user.gender]}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">{t.me.genderSet}</p>
              </div>
            ) : (
              <fieldset>
                <legend className="label">{t.gender.iAm}</legend>
                <PickOne
                  name="gender"
                  options={GENDERS.map((g) => ({ value: g, emoji: GENDER_EMOJI[g], label: t.gender[g] }))}
                />
              </fieldset>
            )}
            <SubmitButton className="btn-primary w-full" pending={t.meetup.saving}>
              {t.me.save}
            </SubmitButton>
          </form>

          <div>
            <p className="font-semibold mb-3">{hasOwnPassword(user) ? t.me.changePassword : t.me.setPassword}</p>
            <ChangePasswordForm needsCurrent={hasOwnPassword(user)} />
          </div>

          {/* Stacked, not side by side: a long email address pushed the
              button off the card. */}
          <div>
            <p className="text-base text-slate-700">{t.me.signedInAs}</p>
            <p className="mb-3 break-all text-base font-semibold text-slate-900">{user.email}</p>
            <LogoutButton className="btn-secondary min-h-12 w-full" />
          </div>

          {/* Folded away again: it's for good, and it should take meaning
              to do. */}
          <details>
            <summary className="cursor-pointer select-none text-sm font-medium text-red-700">
              {t.me.deleteAccount}
            </summary>
            <p className="text-base text-slate-700 mt-3">{t.me.deleteWarning}</p>
            <form action={deleteAccountAction} className="mt-3">
              <SubmitButton className="btn-danger w-full" pending={t.me.deleting}>
                {t.me.yesDelete}
              </SubmitButton>
            </form>
          </details>
        </div>
      </details>

      <p className="mt-6 text-center text-sm text-white">
        <Link href="/terms" className="underline">
          {t.common.terms}
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          {t.common.privacy}
        </Link>{" "}
        ·{" "}
        <ContactEmail className="underline" />
      </p>
    </div>
  );
}

type MeetupRow = {
  activity: {
    id: string;
    title: string;
    startsAt: Date;
    category: string;
    emoji: string | null;
    forWho: string;
    cancelledAt: Date | null;
  };
};

function MeetupLinks({
  t,
  label,
  rows,
  toPeople = false,
}: {
  t: Messages;
  label: string;
  rows: MeetupRow[];
  // Straight down to the people (and their thumbs up buttons) for ones
  // that have happened.
  toPeople?: boolean;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <ul className="space-y-2">
        {rows.map(({ activity: a }) => (
          <li key={a.id}>
            <Link href={`/activities/${a.id}${toPeople ? "#people" : ""}`} className="ticket ticket-sm">
              <TicketRow emoji={emojiFor(a)} off={a.cancelledAt != null} small who={whoFor(t, a.forWho)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{a.title}</span>
                  <span className="block text-sm text-slate-500">
                    <LocalTime iso={a.startsAt.toISOString()} style="short" />
                    {a.cancelledAt && <span className="ml-1.5 font-semibold text-red-700">{t.meetup.cancelled}</span>}
                  </span>
                </span>
                <span className="self-center text-slate-400" aria-hidden="true">
                  ›
                </span>
              </TicketRow>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
