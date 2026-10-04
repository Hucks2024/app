import { notFound } from "next/navigation";
import { categoryFor } from "@/lib/categories";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { isVerifiedMember, thumbsFor } from "@/lib/trust";
import Avatar from "@/components/Avatar";
import JoinedBurst from "@/components/JoinedBurst";
import LocalTime from "@/components/LocalTime";
import SubmitButton from "@/components/SubmitButton";
import {
  joinActivityAction,
  leaveActivityAction,
  reportUserAction,
  toggleThumbsUpAction,
} from "@/app/activities/actions";

const personSelect = {
  id: true,
  name: true,
  profilePhoto: true,
  role: true,
  memberVerifiedAt: true,
} as const;

type Person = {
  id: string;
  name: string;
  profilePhoto: Uint8Array | null;
  role: string;
  memberVerifiedAt: Date | null;
};

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; reported?: string; joined?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error, reported, joined: justJoined } = await searchParams;
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
  const happened = activity.startsAt <= new Date();
  // Whether this viewer can hand out thumbs here: they were going, and
  // it's started.
  const wasThere = happened && myParticipation?.status === "JOINED";

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}
      {justJoined && <JoinedBurst label="You're in! See you there 🙌" />}
      {reported && (
        <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2">
          Thanks for telling us. A moderator will look at it, and three red flags from different
          people means a lifetime ban.
        </p>
      )}

      <div className="card">
        <span className="badge-slate mb-2 inline-flex">
          {category.emoji} {category.label}
        </span>
        <h1 className="text-2xl font-bold">{activity.title}</h1>
        <p className="text-slate-600 mt-1 font-medium">
          <LocalTime iso={activity.startsAt.toISOString()} />
        </p>
        <p className="text-slate-600">
          {activity.latitude != null && activity.longitude != null ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${activity.latitude},${activity.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-brand-700"
            >
              📍 {activity.location} ↗
            </a>
          ) : (
            <>📍 {activity.location}</>
          )}
        </p>
        {activity.afterSpot && (
          <p className="text-slate-600 mt-1">🍻 Afterwards: {activity.afterSpot}</p>
        )}
        {(activity.distanceKm || activity.pace) && (
          <p className="text-slate-500 text-sm mt-1">
            {[activity.distanceKm ? `${activity.distanceKm} km` : null, activity.pace ? `${activity.pace} pace` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {activity.description && (
          <p className="mt-4 whitespace-pre-wrap text-slate-700">{activity.description}</p>
        )}
        {activity.stravaUrl && (
          <a
            href={activity.stravaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            🧡 View route on Strava
          </a>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-slate-500">Hosted by</span>
          <Avatar userId={activity.host.id} hasPhoto={!!activity.host.profilePhoto} size={6} />
          <span className="font-medium">{activity.host.name}</span>
          <TrustMarks person={activity.host} thumbs={thumbs.get(activity.host.id) ?? 0} />
        </div>

        <div className="mt-6">
          {happened ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {wasThere
                ? "This one's happened. Give a 👍 to the people you met, below."
                : "This one's already happened."}
            </p>
          ) : isHost ? (
            <p className="text-sm text-slate-500">You&apos;re hosting this one.</p>
          ) : !myParticipation ? (
            <form action={joinActivityAction}>
              <input type="hidden" name="activityId" value={activity.id} />
              <SubmitButton className="btn-primary w-full sm:w-auto !py-3 !px-8 text-base" pending="Saving your spot…">
                I&apos;m in 🙌
              </SubmitButton>
            </form>
          ) : myParticipation.status === "JOINED" ? (
            <div className="flex items-center gap-3">
              <span className="badge-green !text-sm !py-1">You&apos;re in ✓</span>
              <form action={leaveActivityAction}>
                <input type="hidden" name="activityId" value={activity.id} />
                <SubmitButton className="btn-secondary !py-1.5 text-sm" pending="Leaving…">
                  Can&apos;t make it
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="badge-amber">You&apos;re on the waitlist</span>
              <form action={leaveActivityAction}>
                <input type="hidden" name="activityId" value={activity.id} />
                <SubmitButton className="btn-secondary !py-1.5 text-sm" pending="Leaving…">
                  Leave waitlist
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      </div>

      <div id="people" className="card mt-6 scroll-mt-20">
        <h2 className="font-semibold mb-1">
          {happened ? "Who came" : "Who's going"} ({joined.length}
          {activity.maxParticipants && !happened ? ` / ${activity.maxParticipants}` : ""})
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          ✓ means they&apos;ve been to a meetup before. 👍 is how many thumbs up they&apos;ve had
          from people they met.
        </p>
        <ul className="space-y-3">
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
            <h3 className="font-semibold mt-5 mb-3 text-sm text-slate-600">
              Waitlist ({waitlist.length})
            </h3>
            <ul className="space-y-3">
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

        {/* Said plainly, because it's the reason people pick an app like
            this: there's no inbox here for anyone to pester you through. */}
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          There are no messages on packmates, on purpose. Everything you need is up top: when,
          where and who&apos;s coming. If somebody&apos;s out of line, give them a 🚩: three from
          different people and they&apos;re banned for life.
        </p>
      </div>
    </div>
  );
}

/** The ✓ (been to a meetup) or "new", and the 👍 count. */
function TrustMarks({ person, thumbs }: { person: Person; thumbs: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {isVerifiedMember(person) ? (
        <span className="badge-green !px-1.5" title="Verified: has been to a meetup">
          ✓
        </span>
      ) : (
        <span className="badge-amber" title="Hasn't been to a meetup yet">
          new
        </span>
      )}
      <span className="font-semibold text-slate-600" title={`${thumbs} thumbs up`}>
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
    <li className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar userId={person.id} hasPhoto={!!person.profilePhoto} size={9} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {person.name}
            {person.id === viewer && <span className="text-slate-400 font-normal"> (you)</span>}
          </p>
          <TrustMarks person={person} thumbs={thumbs} />
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        {canThumb && (
          <form action={toggleThumbsUpAction}>
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
        {person.id !== viewer && (
          <details className="relative text-sm">
            <summary
              className="cursor-pointer list-none rounded-full px-2 py-1 text-slate-400 hover:text-red-600"
              title={`Red-flag ${person.name}`}
            >
              🚩
            </summary>
            <form
              action={reportUserAction}
              className="absolute right-0 z-10 mt-2 flex w-60 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
            >
              <p className="text-xs text-slate-500">
                Red flags are private: only moderators see them. Three from different people
                who&apos;ve met {person.name} at meetups is a lifetime ban.
              </p>
              <input type="hidden" name="reportedUserId" value={person.id} />
              <input type="hidden" name="activityId" value={activityId} />
              <textarea
                name="reason"
                className="input"
                rows={2}
                placeholder="What happened?"
                required
                minLength={5}
              />
              <SubmitButton className="btn-danger !py-1 !text-xs" pending="Sending…">
                🚩 Red-flag {person.name}
              </SubmitButton>
            </form>
          </details>
        )}
      </div>
    </li>
  );
}
