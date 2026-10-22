import Link from "next/link";
import { notFound } from "next/navigation";
import { emojiFor } from "@/lib/categories";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { isVerifiedMember, thumbsFor } from "@/lib/trust";
import { blockedEitherWay } from "@/lib/blocks";
import Avatar from "@/components/Avatar";
import JoinedBurst from "@/components/JoinedBurst";
import LocalTime from "@/components/LocalTime";
import ShareButton from "@/components/ShareButton";
import SubmitButton from "@/components/SubmitButton";
import { SITE } from "@/lib/site";
import { readError } from "@/lib/flash";
import {
  blockUserAction,
  cancelActivityAction,
  joinActivityAction,
  leaveActivityAction,
  reportUserAction,
  toggleThumbsUpAction,
} from "@/app/activities/actions";
import { getLocale, getT } from "@/i18n/server";
import { fill, howLong, plural, rich, typeName } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import { TicketHead } from "@/components/Ticket";
import { FOR_WHO_EMOJI, canGo, isForWho } from "@/lib/gender";

const personSelect = {
  id: true,
  name: true,
  profilePhotoType: true,
  photoUpdatedAt: true,
  role: true,
  memberVerifiedAt: true,
} as const;

type Person = {
  id: string;
  name: string;
  profilePhotoType: string | null;
  photoUpdatedAt: Date | null;
  role: string;
  memberVerifiedAt: Date | null;
};

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    sig?: string;
    reported?: string;
    blocked?: string;
    joined?: string;
    saved?: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error: rawError, sig, reported, blocked: justBlocked, joined: justJoined, saved } = await searchParams;
  const error = readError(rawError, sig);
  const [prisma, t, lang] = await Promise.all([getPrisma(), getT(), getLocale()]);

  // Blocked either way: their meetups are gone for you, and they're left
  // off the list of who's going on anyone else's. Asked for alongside the
  // meetup, since neither waits on the other.
  const [activity, blocked] = await Promise.all([
    prisma.runActivity.findUnique({
      where: { id },
      include: {
        host: { select: { ...personSelect, accountStatus: true } },
        participations: {
          where: { status: { in: ["JOINED", "WAITLIST"] } },
          include: { user: { select: personSelect } },
          orderBy: { joinedAt: "asc" },
        },
      },
    }),
    blockedEitherWay(prisma, user.id),
  ]);

  // A banned or suspended host's meetups are gone for everyone but the
  // admins, who may need to see what they were.
  if (!activity || (activity.host.accountStatus !== "ACTIVE" && user.role !== "ADMIN")) {
    notFound();
  }
  if (blocked.has(activity.hostId) && user.role !== "ADMIN") notFound();
  const unblocked = <T extends { userId: string }>(list: T[]) => list.filter((p) => !blocked.has(p.userId));

  const myParticipation = activity.participations.find((p) => p.userId === user.id);
  const isHost = activity.hostId === user.id;
  const joined = activity.participations.filter((p) => p.status === "JOINED");
  const waitlist = activity.participations.filter((p) => p.status === "WAITLIST");
  const cancelled = activity.cancelledAt != null;
  const happened = !cancelled && activity.startsAt <= new Date();
  const full = activity.maxParticipants != null && joined.length >= activity.maxParticipants;
  const going = myParticipation?.status === "JOINED";
  // Whether this viewer can hand out thumbs here: they were going, and
  // it's started.
  const wasThere = happened && going;
  // The host, or an admin tidying up: they can change it or call it off
  // until it starts.
  const canManage = (isHost || user.role === "ADMIN") && !cancelled && !happened;
  const upcoming = !cancelled && !happened;
  // Men only, women only or T-Rex only; null for one for all.
  const forWho = isForWho(activity.forWho) && activity.forWho !== "ALL" ? activity.forWho : null;

  // Somebody else's group's meetup, reached by a link: what kind it is and
  // who it's for, and nothing about where, when or who's going. The host,
  // the admins and anybody already on it see it all.
  if (forWho && !canGo(forWho, user.gender) && !isHost && user.role !== "ADMIN" && !myParticipation) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-10">
        <div className="ticket">
          <TicketHead
            emoji={emojiFor(activity)}
            kind={activity.category === "SOCIAL" ? undefined : typeName(t, activity.category)}
          >
            <h1 className="ticket-title ticket-title-lg">
              {FOR_WHO_EMOJI[forWho]} {t.forWho[forWho]}
            </h1>
          </TicketHead>
          <div className="ticket-body p-6">
            <p className="text-base text-slate-800">{t.errors.notForYou}</p>
            <Link href="/" className="btn-primary mt-4 min-h-12 w-full text-base">
              {t.post.findMeetup}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [thumbs, givenByMe] = await Promise.all([
    thumbsFor(prisma, [activity.hostId, ...joined.map((p) => p.userId)]),
    wasThere
      ? prisma.thumbsUp
          .findMany({ where: { activityId: activity.id, fromId: user.id }, select: { toId: true } })
          .then((rows) => new Set(rows.map((t) => t.toId)))
      : new Set<string>(),
  ]);

  const hasPin = activity.latitude != null && activity.longitude != null;
  // Just the spot on Google Maps, not a route to it: a route starts from
  // wherever you are now, which is rarely where you'll set off from.
  const directions = `https://www.google.com/maps/search/?api=1&query=${
    hasPin ? `${activity.latitude},${activity.longitude}` : encodeURIComponent(activity.location)
  }`;
  const pageUrl = `${SITE.url}/activities/${activity.id}`;

  return (
    // Room at the bottom on a phone for the action bar pinned there.
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-36 sm:pb-10">
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-base px-4 py-3">
          {error}
        </p>
      )}
      {justJoined && <JoinedBurst label={`${t.meetup.youreIn} 🙌`} />}
      {saved && (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-base px-4 py-3">
          ✓ {t.meetup.saved}
        </p>
      )}
      {reported && (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-base px-4 py-3">
          {t.meetup.reported}
        </p>
      )}
      {justBlocked && (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-base px-4 py-3">
          {rich(t.meetup.blocked, {
            me: (
              <Link href="/profile#blocked" className="underline">
                {t.common.me}
              </Link>
            ),
          })}
        </p>
      )}

      <div className="ticket">
        <TicketHead
          emoji={emojiFor(activity)}
          // "Something else" says nothing the title doesn't.
          kind={activity.category === "SOCIAL" ? undefined : typeName(t, activity.category)}
          off={cancelled}
        >
          <h1 className="ticket-title ticket-title-lg">{activity.title}</h1>
        </TicketHead>
        <div className="ticket-body p-6">
          {/* The three things people come to a meetup page for, big and in
              this order: when, where, and how to spot the group. */}
          <dl className="space-y-3 text-base">
            <div className="flex gap-3">
              <dt className="w-7 flex-none text-xl" aria-label={t.meetup.whenLabel}>
                🗓️
              </dt>
              <dd className="font-semibold text-slate-900">
                <LocalTime iso={activity.startsAt.toISOString()} />
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-7 flex-none text-xl" aria-label={t.meetup.whereLabel}>
                📍
              </dt>
              <dd className="text-slate-800">{activity.location}</dd>
            </div>
            {forWho && (
              <div className="flex gap-3">
                <dt className="w-7 flex-none text-xl" aria-label={t.forWho.label}>
                  {FOR_WHO_EMOJI[forWho]}
                </dt>
                <dd className="font-semibold text-slate-900">{t.forWho[forWho]}</dd>
              </div>
            )}
            {activity.findUs && (
              <div className="flex gap-3">
                <dt className="w-7 flex-none text-xl" aria-label={t.meetup.findGroupLabel}>
                  👀
                </dt>
                <dd className="text-slate-800">
                  <span className="font-semibold">{t.meetup.findUs} </span>
                  {activity.findUs}
                </dd>
              </div>
            )}
            {activity.afterSpot && (
              <div className="flex gap-3">
                <dt className="w-7 flex-none text-xl" aria-label={t.meetup.afterwardsLabel}>
                  🍻
                </dt>
                <dd className="text-slate-800">
                  <span className="font-semibold">{t.meetup.afterwards} </span>
                  {activity.afterSpot}
                </dd>
              </div>
            )}
            {(activity.distanceKm || activity.pace) && (
              <div className="flex gap-3">
                <dt className="w-7 flex-none text-xl" aria-label={t.meetup.distancePaceLabel}>
                  📏
                </dt>
                <dd className="text-slate-800">
                  {[activity.distanceKm ? `${activity.distanceKm} km` : null, activity.pace ? fill(t.meetup.pace, { pace: activity.pace }) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            )}
            {activity.durationMins && (
              <div className="flex gap-3">
                <dt className="w-7 flex-none text-xl" aria-label={t.meetup.howLongLabel}>
                  ⏱️
                </dt>
                <dd className="text-slate-800">
                  {fill(t.meetup.takes, { time: howLong(t, activity.durationMins, lang) })}
                </dd>
              </div>
            )}
          </dl>

          {/* Big, labelled, and in thumb reach: the things people do with a
              meetup once they've decided to go. */}
          {upcoming && (
            <div className="tool-grid mt-5 grid grid-cols-2 gap-2">
              <a href={directions} target="_blank" rel="noopener noreferrer" className="tool-btn">
                <span aria-hidden="true">🧭</span>
                {t.meetup.directions}
              </a>
              <ShareButton url={pageUrl} title={activity.title} />
            </div>
          )}

          {activity.description && (
            <p className="mt-5 whitespace-pre-wrap text-base text-slate-800">{activity.description}</p>
          )}
          {activity.stravaUrl && (
            <a
              href={activity.stravaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center gap-1 text-base font-medium text-orange-700 underline"
            >
              🧡 {t.meetup.strava}
            </a>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-base">
            <span className="text-slate-600">{t.meetup.host}</span>
            <Avatar userId={activity.host.id} hasPhoto={!!activity.host.profilePhotoType} version={activity.host.photoUpdatedAt} size={8} />
            <span className="font-semibold">{activity.host.name}</span>
            <TrustMarks t={t} person={activity.host} thumbs={thumbs.get(activity.host.id) ?? 0} />
          </div>

          {canManage && (
            <div className="mt-4 flex flex-wrap items-start gap-3">
              <Link href={`/activities/${activity.id}/edit`} className="btn-secondary min-h-11">
                ✏️ {t.meetup.change}
              </Link>
              {/* Two taps: calling a meetup off can't be undone. */}
              <details>
                <summary className="btn-secondary min-h-11 cursor-pointer list-none !text-red-700">
                  {t.meetup.cancel}
                </summary>
                <form action={cancelActivityAction} className="mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4">
                  <input type="hidden" name="activityId" value={activity.id} />
                  <p className="text-base text-slate-700 mb-3">
                    {t.meetup.cancelWarning}
                  </p>
                  <SubmitButton className="btn-danger w-full min-h-11" pending={t.meetup.cancelling}>
                    {t.meetup.yesCancel}
                  </SubmitButton>
                </form>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* The one thing to do on this page, pinned to the bottom of a phone
          screen above the tab bar, so it's always in thumb's reach however
          far down you've scrolled. On a bigger screen it sits in the page. */}
      <div className="action-bar">
        {cancelled ? (
          <p className="action-bar-note text-red-700">❌ {t.meetup.cancelled}</p>
        ) : happened ? (
          wasThere ? (
            <a href="#people" className="btn-primary w-full min-h-12 text-base">
              👍 {t.notice.giveThumbs}
            </a>
          ) : (
            <p className="action-bar-note">{t.meetup.over}</p>
          )
        ) : isHost ? (
          <p className="action-bar-note">
            {t.meetup.youreHost} {joined.length - 1 > 0 ? `${plural(t.list.going, joined.length - 1, lang)}.` : t.meetup.shareIt}
          </p>
        ) : activity.host.accountStatus !== "ACTIVE" ? (
          <p className="action-bar-note">{t.meetup.hostRemoved}</p>
        ) : !myParticipation ? (
          <form action={joinActivityAction} className="w-full">
            <input type="hidden" name="activityId" value={activity.id} />
            <SubmitButton className="btn-primary w-full min-h-12 text-lg" pending={t.meetup.saving}>
              {full ? t.meetup.joinWaitlist : `${t.meetup.imIn} 🙌`}
            </SubmitButton>
            <p className="mt-1 text-center text-sm text-slate-600">
              {user.profilePhotoType
                ? `${t.meetup.free} · ${joined.length > 0 ? plural(t.list.going, joined.length, lang) : t.list.beFirst}`
                : `${t.meetup.free} · ${t.meetup.photoFirst}`}
            </p>
          </form>
        ) : going ? (
          <div className="flex w-full items-center gap-3">
            <p className="flex-1 text-base font-semibold text-brand-800">✓ {t.meetup.youreGoing}</p>
            <form action={leaveActivityAction}>
              <input type="hidden" name="activityId" value={activity.id} />
              <SubmitButton className="btn-secondary min-h-11" pending={t.meetup.saving}>
                {t.meetup.cantGo}
              </SubmitButton>
            </form>
          </div>
        ) : (
          <div className="flex w-full items-center gap-3">
            <p className="flex-1 text-base font-semibold text-amber-800">{t.meetup.onWaitlist}</p>
            <form action={leaveActivityAction}>
              <input type="hidden" name="activityId" value={activity.id} />
              <SubmitButton className="btn-secondary min-h-11" pending={t.meetup.saving}>
                {t.meetup.leaveWaitlist}
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      <div id="people" className="card mt-6 scroll-mt-20">
        <h2 className="text-lg font-bold">
          {happened ? t.meetup.whoCame : t.meetup.whosGoing} (
          {activity.maxParticipants && !happened
            ? fill(t.board.nOfTotal, { n: unblocked(joined).length, total: activity.maxParticipants })
            : unblocked(joined).length}
          )
        </h2>
        <ul className="mt-3 space-y-4">
          {unblocked(joined).map((p) => (
            <ParticipantRow
              key={p.id}
              t={t}
              person={p.user}
              thumbs={thumbs.get(p.userId) ?? 0}
              activityId={activity.id}
              viewer={user.id}
              canThumb={wasThere && p.userId !== user.id}
              thumbed={givenByMe.has(p.userId)}
            />
          ))}
        </ul>

        {unblocked(waitlist).length > 0 && !happened && (
          <>
            <h3 className="font-semibold mt-6 mb-3 text-base text-slate-700">
              {t.meetup.waitlist} ({unblocked(waitlist).length})
            </h3>
            <ul className="space-y-4">
              {unblocked(waitlist).map((p) => (
                <ParticipantRow
                  key={p.id}
                  t={t}
                  person={p.user}
                  thumbs={thumbs.get(p.userId) ?? 0}
                  activityId={activity.id}
                  viewer={user.id}
                  canThumb={false}
                  thumbed={false}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Safety in one place, folded away: the few things worth doing when
          meeting people you don't know yet, and reporting the meetup. */}
      <details className="card mt-6">
        <summary className="flex min-h-11 cursor-pointer select-none items-center text-base font-semibold text-slate-900">
          🛟 {t.meetup.staySafe}
          {!isHost && ` · 🚩 ${t.meetup.report}`}
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-slate-700">
          <li>{t.meetup.safe1}</li>
          <li>{t.meetup.safe2}</li>
          <li>{t.meetup.safe3}</li>
          <li>{rich(t.meetup.safe4, { report: <strong>🚩 {t.meetup.reportOrBlock}</strong> })}</li>
        </ul>
        {!isHost && (
          <>
            <p className="mt-4 text-base font-semibold text-slate-900">🚩 {t.meetup.reportMeetup}</p>
            <ReportForm t={t} personId={activity.hostId} activityId={activity.id} fieldId="meetup" />
          </>
        )}
      </details>
    </div>
  );
}

/** The ✓ (been to a meetup) or "new", and the 👍 count. */
function TrustMarks({ t, person, thumbs }: { t: Messages; person: Person; thumbs: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {isVerifiedMember(person) ? (
        <span className="badge-green" title={t.meetup.beenBeforeTitle}>
          ✓ {t.meetup.beenBefore}
        </span>
      ) : (
        <span className="badge-amber" title={t.meetup.newTitle}>
          {t.meetup.new}
        </span>
      )}
      <span className="font-semibold text-slate-700" title={fill(t.meetup.thumbsTitle, { n: thumbs })}>
        👍 {thumbs}
      </span>
    </span>
  );
}

function ParticipantRow({
  t,
  person,
  thumbs,
  activityId,
  viewer,
  canThumb,
  thumbed,
}: {
  t: Messages;
  person: Person;
  thumbs: number;
  activityId: string;
  viewer: string;
  canThumb: boolean;
  thumbed: boolean;
}) {
  return (
    <li>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar userId={person.id} hasPhoto={!!person.profilePhotoType} version={person.photoUpdatedAt} size={10} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {person.name}
              {person.id === viewer && <span className="text-slate-500 font-normal"> ({t.meetup.you})</span>}
            </p>
            <TrustMarks t={t} person={person} thumbs={thumbs} />
          </div>
        </div>
        {canThumb && (
          <form action={toggleThumbsUpAction} className="flex-none">
            <input type="hidden" name="activityId" value={activityId} />
            <input type="hidden" name="toId" value={person.id} />
            <SubmitButton
              className={`thumb-btn ${thumbed ? "thumb-btn-on" : ""}`}
              pending="👍"
              title={thumbed ? t.meetup.takeBack : fill(t.meetup.giveTo, { name: person.name })}
            >
              {thumbed ? `👍 ${t.meetup.given}` : `👍 ${t.meetup.thumbsUp}`}
            </SubmitButton>
          </form>
        )}
      </div>
      {person.id !== viewer && (
        <details className="mt-1 pl-[3.25rem]">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-slate-600 underline hover:text-red-700">
            🚩 {t.meetup.reportOrBlock}
          </summary>
          <ReportForm t={t} personId={person.id} activityId={activityId} fieldId={person.id} />
          <form action={blockUserAction} className="mt-2 flex max-w-sm flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm text-slate-700">{fill(t.meetup.blockQuestion, { name: person.name })}</p>
            <input type="hidden" name="blockedId" value={person.id} />
            <input type="hidden" name="activityId" value={activityId} />
            <SubmitButton className="btn-secondary min-h-11" pending={t.meetup.blocking}>
              🚫 {fill(t.meetup.block, { name: person.name })}
            </SubmitButton>
          </form>
        </details>
      )}
    </li>
  );
}

/** "What happened?", sent to the moderators. About a person, or about a
 * meetup, which is a report about its host. */
function ReportForm({ t, personId, activityId, fieldId }: { t: Messages; personId: string; activityId: string; fieldId: string }) {
  return (
    <form action={reportUserAction} className="mt-2 flex max-w-sm flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm text-slate-700">
        {t.meetup.reportNote}
      </p>
      <input type="hidden" name="reportedUserId" value={personId} />
      <input type="hidden" name="activityId" value={activityId} />
      <label htmlFor={`reason-${fieldId}`} className="text-sm font-semibold text-slate-800">
        {t.meetup.whatHappened}
      </label>
      <textarea id={`reason-${fieldId}`} name="reason" className="input !text-base" rows={3} required minLength={5} />
      <SubmitButton className="btn-danger min-h-11" pending={t.signIn.sending}>
        {t.meetup.sendReport}
      </SubmitButton>
    </form>
  );
}
