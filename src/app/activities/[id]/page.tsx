import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryFor } from "@/lib/categories";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { isVerifiedMember, thumbsFor } from "@/lib/trust";
import Avatar from "@/components/Avatar";
import JoinedBurst from "@/components/JoinedBurst";
import LocalTime from "@/components/LocalTime";
import ShareButton from "@/components/ShareButton";
import SubmitButton from "@/components/SubmitButton";
import { SITE } from "@/lib/site";
import { readError } from "@/lib/flash";
import {
  cancelActivityAction,
  joinActivityAction,
  leaveActivityAction,
  reportUserAction,
  toggleThumbsUpAction,
} from "@/app/activities/actions";

const personSelect = {
  id: true,
  name: true,
  profilePhotoType: true,
  role: true,
  memberVerifiedAt: true,
} as const;

type Person = {
  id: string;
  name: string;
  profilePhotoType: string | null;
  role: string;
  memberVerifiedAt: Date | null;
};

/** "20261010T070000Z", the form calendar links want. */
function calStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sig?: string; reported?: string; joined?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error: rawError, sig, reported, joined: justJoined, saved } = await searchParams;
  const error = readError(rawError, sig);
  const prisma = await getPrisma();

  const activity = await prisma.runActivity.findUnique({
    where: { id },
    include: {
      host: { select: { ...personSelect, accountStatus: true } },
      participations: {
        where: { status: { in: ["JOINED", "WAITLIST"] } },
        include: { user: { select: personSelect } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  // A banned or suspended host's meetups are gone for everyone but the
  // admins, who may need to see what they were.
  if (!activity || (activity.host.accountStatus !== "ACTIVE" && user.role !== "ADMIN")) {
    notFound();
  }

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

  const thumbs = await thumbsFor(prisma, [activity.hostId, ...joined.map((p) => p.userId)]);
  const givenByMe = new Set(
    wasThere
      ? (
          await prisma.thumbsUp.findMany({
            where: { activityId: activity.id, fromId: user.id },
            select: { toId: true },
          })
        ).map((t) => t.toId)
      : []
  );

  const category = categoryFor(activity.category);
  const hasPin = activity.latitude != null && activity.longitude != null;
  const directions = hasPin
    ? `https://www.google.com/maps/dir/?api=1&destination=${activity.latitude},${activity.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`;
  const pageUrl = `${SITE.url}/activities/${activity.id}`;
  const end = new Date(activity.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const googleCalendar =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: activity.title,
      dates: `${calStamp(activity.startsAt)}/${calStamp(end)}`,
      location: activity.location,
      details: `${activity.findUs ? `How to find us: ${activity.findUs}\n\n` : ""}${pageUrl}`,
    });

  return (
    // Room at the bottom on a phone for the action bar pinned there.
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-36 sm:pb-10">
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-base px-4 py-3">
          {error}
        </p>
      )}
      {justJoined && <JoinedBurst label="You're in! 🙌" />}
      {justJoined && going && (
        // Right when they've said yes is when people act on a nudge: a
        // calendar entry is what reminds them on the day, and a face is
        // how the group knows who to look out for.
        <div className="card mb-4 !p-4">
          <p className="text-base font-bold text-slate-900">Don&apos;t miss it</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a href={`/activities/${activity.id}/calendar`} className="btn-primary min-h-12 flex-1 text-base">
              📆 Add to calendar
            </a>
            {!user.profilePhotoType && (
              <Link href="/profile#photo" className="btn-secondary min-h-12 flex-1 text-base">
                🙂 Add your photo
              </Link>
            )}
          </div>
        </div>
      )}
      {saved && (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-base px-4 py-3">
          ✓ Saved.
        </p>
      )}
      {reported && (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-base px-4 py-3">
          Thanks. A moderator will look.
        </p>
      )}

      <div className="card">
        <span className="badge-slate mb-2 inline-flex !text-sm">
          {category.emoji} {category.label}
        </span>
        <h1 className="text-2xl font-bold leading-tight">{activity.title}</h1>

        {/* The three things people come to a meetup page for, big and in
            this order: when, where, and how to spot the group. */}
        <dl className="mt-4 space-y-3 text-base">
          <div className="flex gap-3">
            <dt className="w-7 flex-none text-xl" aria-label="When">
              🗓️
            </dt>
            <dd className="font-semibold text-slate-900">
              <LocalTime iso={activity.startsAt.toISOString()} />
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-7 flex-none text-xl" aria-label="Where">
              📍
            </dt>
            <dd className="text-slate-800">{activity.location}</dd>
          </div>
          {activity.findUs && (
            <div className="flex gap-3">
              <dt className="w-7 flex-none text-xl" aria-label="How to find the group">
                👀
              </dt>
              <dd className="text-slate-800">
                <span className="font-semibold">How to find us: </span>
                {activity.findUs}
              </dd>
            </div>
          )}
          {activity.afterSpot && (
            <div className="flex gap-3">
              <dt className="w-7 flex-none text-xl" aria-label="Afterwards">
                🍻
              </dt>
              <dd className="text-slate-800">
                <span className="font-semibold">Afterwards: </span>
                {activity.afterSpot}
              </dd>
            </div>
          )}
          {(activity.distanceKm || activity.pace) && (
            <div className="flex gap-3">
              <dt className="w-7 flex-none text-xl" aria-label="Distance and pace">
                📏
              </dt>
              <dd className="text-slate-800">
                {[activity.distanceKm ? `${activity.distanceKm} km` : null, activity.pace ? `${activity.pace} pace` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
          )}
        </dl>

        {/* Big, labelled, and in thumb reach: the things people do with a
            meetup once they've decided to go. */}
        {upcoming && (
          <div className="tool-grid mt-5 grid grid-cols-3 gap-2">
            <a href={directions} target="_blank" rel="noopener noreferrer" className="tool-btn">
              <span aria-hidden="true">🧭</span>
              Directions
            </a>
            <a href={`/activities/${activity.id}/calendar`} className="tool-btn">
              <span aria-hidden="true">📆</span>
              Add to calendar
            </a>
            <ShareButton url={pageUrl} title={activity.title} />
          </div>
        )}
        {upcoming && (
          <p className="mt-2 text-sm text-slate-600">
            <a href={googleCalendar} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline">
              Or add to Google Calendar
            </a>
          </p>
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
            🧡 Route on Strava
          </a>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-base">
          <span className="text-slate-600">Host</span>
          <Avatar userId={activity.host.id} hasPhoto={!!activity.host.profilePhotoType} size={8} />
          <span className="font-semibold">{activity.host.name}</span>
          <TrustMarks person={activity.host} thumbs={thumbs.get(activity.host.id) ?? 0} />
        </div>

        {canManage && (
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <Link href={`/activities/${activity.id}/edit`} className="btn-secondary min-h-11">
              ✏️ Change details
            </Link>
            {/* Two taps: calling a meetup off can't be undone. */}
            <details>
              <summary className="btn-secondary min-h-11 cursor-pointer list-none !text-red-700">
                Cancel meetup
              </summary>
              <form action={cancelActivityAction} className="mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4">
                <input type="hidden" name="activityId" value={activity.id} />
                <p className="text-base text-slate-700 mb-3">
                  Everyone going will be told. You can&apos;t undo this.
                </p>
                <SubmitButton className="btn-danger w-full min-h-11" pending="Cancelling…">
                  Yes, cancel it
                </SubmitButton>
              </form>
            </details>
          </div>
        )}
      </div>

      {/* The one thing to do on this page, pinned to the bottom of a phone
          screen above the tab bar, so it's always in thumb's reach however
          far down you've scrolled. On a bigger screen it sits in the page. */}
      <div className="action-bar">
        {cancelled ? (
          <p className="action-bar-note text-red-700">❌ Cancelled</p>
        ) : happened ? (
          wasThere ? (
            <a href="#people" className="btn-primary w-full min-h-12 text-base">
              👍 Give thumbs up
            </a>
          ) : (
            <p className="action-bar-note">This meetup is over.</p>
          )
        ) : isHost ? (
          <p className="action-bar-note">You&apos;re the host. {joined.length - 1 > 0 ? `${joined.length - 1} going.` : "Share it!"}</p>
        ) : activity.host.accountStatus !== "ACTIVE" ? (
          <p className="action-bar-note">This host has been removed.</p>
        ) : !myParticipation ? (
          <form action={joinActivityAction} className="w-full">
            <input type="hidden" name="activityId" value={activity.id} />
            <SubmitButton className="btn-primary w-full min-h-12 text-lg" pending="Saving…">
              {full ? "Full: join waitlist" : "I'm in 🙌"}
            </SubmitButton>
            <p className="mt-1 text-center text-sm text-slate-600">
              Free · {joined.length > 0 ? `${joined.length} going` : "Be the first"}
            </p>
          </form>
        ) : going ? (
          <div className="flex w-full items-center gap-3">
            <p className="flex-1 text-base font-semibold text-brand-800">✓ You&apos;re going</p>
            <form action={leaveActivityAction}>
              <input type="hidden" name="activityId" value={activity.id} />
              <SubmitButton className="btn-secondary min-h-11" pending="Saving…">
                I can&apos;t go now
              </SubmitButton>
            </form>
          </div>
        ) : (
          <div className="flex w-full items-center gap-3">
            <p className="flex-1 text-base font-semibold text-amber-800">You&apos;re on the waitlist</p>
            <form action={leaveActivityAction}>
              <input type="hidden" name="activityId" value={activity.id} />
              <SubmitButton className="btn-secondary min-h-11" pending="Saving…">
                Leave waitlist
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      <div id="people" className="card mt-6 scroll-mt-20">
        <h2 className="text-lg font-bold mb-1">
          {happened ? "Who came" : "Who's going"} ({joined.length}
          {activity.maxParticipants && !happened ? ` of ${activity.maxParticipants}` : ""})
        </h2>
        <p className="text-sm text-slate-600 mb-4">✓ = been before · 👍 = thumbs up</p>
        <ul className="space-y-4">
          {joined.map((p) => (
            <ParticipantRow
              key={p.id}
              person={p.user}
              thumbs={thumbs.get(p.userId) ?? 0}
              activityId={activity.id}
              viewer={user.id}
              canThumb={wasThere && p.userId !== user.id}
              thumbed={givenByMe.has(p.userId)}
            />
          ))}
        </ul>

        {waitlist.length > 0 && !happened && (
          <>
            <h3 className="font-semibold mt-6 mb-3 text-base text-slate-700">
              Waitlist ({waitlist.length})
            </h3>
            <ul className="space-y-4">
              {waitlist.map((p) => (
                <ParticipantRow
                  key={p.id}
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

      {/* Meeting people you don't know yet: the few things worth doing,
          one tap away and out of the way otherwise. */}
      <details className="card mt-6">
        <summary className="cursor-pointer select-none text-base font-semibold text-slate-900 min-h-11 flex items-center">
          🛟 Staying safe
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-slate-700">
          <li>Stay in public.</li>
          <li>Tell a friend where you are.</li>
          <li>Get home your own way.</li>
          <li>Feels wrong? Leave.</li>
          <li>Someone rude? Tap <strong>Report</strong>.</li>
        </ul>
      </details>
    </div>
  );
}

/** The ✓ (been to a meetup) or "new", and the 👍 count. */
function TrustMarks({ person, thumbs }: { person: Person; thumbs: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {isVerifiedMember(person) ? (
        <span className="badge-green" title="Has been to a meetup before">
          ✓ Been before
        </span>
      ) : (
        <span className="badge-amber" title="Hasn't been to a meetup yet">
          New
        </span>
      )}
      <span className="font-semibold text-slate-700" title={`${thumbs} thumbs up`}>
        👍 {thumbs}
      </span>
    </span>
  );
}

function ParticipantRow({
  person,
  thumbs,
  activityId,
  viewer,
  canThumb,
  thumbed,
}: {
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
          <Avatar userId={person.id} hasPhoto={!!person.profilePhotoType} size={10} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {person.name}
              {person.id === viewer && <span className="text-slate-500 font-normal"> (you)</span>}
            </p>
            <TrustMarks person={person} thumbs={thumbs} />
          </div>
        </div>
        {canThumb && (
          <form action={toggleThumbsUpAction} className="flex-none">
            <input type="hidden" name="activityId" value={activityId} />
            <input type="hidden" name="toId" value={person.id} />
            <SubmitButton
              className={`thumb-btn ${thumbed ? "thumb-btn-on" : ""}`}
              pending="👍"
              title={thumbed ? "Take your thumbs up back" : `Give ${person.name} a thumbs up`}
            >
              {thumbed ? "👍 Given" : "👍 Thumbs up"}
            </SubmitButton>
          </form>
        )}
      </div>
      {person.id !== viewer && (
        <details className="mt-1 pl-[3.25rem]">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-slate-600 underline hover:text-red-700">
            🚩 Report {person.name}
          </summary>
          <form action={reportUserAction} className="mt-2 flex max-w-sm flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm text-slate-700">
              Only moderators see this. 3 reports = banned for life.
            </p>
            <input type="hidden" name="reportedUserId" value={person.id} />
            <input type="hidden" name="activityId" value={activityId} />
            <label htmlFor={`reason-${person.id}`} className="text-sm font-semibold text-slate-800">
              What happened?
            </label>
            <textarea
              id={`reason-${person.id}`}
              name="reason"
              className="input !text-base"
              rows={3}
              required
              minLength={5}
            />
            <SubmitButton className="btn-danger min-h-11" pending="Sending…">
              Send report
            </SubmitButton>
          </form>
        </details>
      )}
    </li>
  );
}
