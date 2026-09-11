import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import Avatar from "@/components/Avatar";
import {
  joinActivityAction,
  leaveActivityAction,
  postCommentAction,
  reportUserAction,
} from "@/app/activities/actions";

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; reported?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error, reported } = await searchParams;
  const prisma = await getPrisma();

  const activity = await prisma.runActivity.findUnique({
    where: { id },
    include: {
      host: true,
      participations: {
        where: { status: { in: ["JOINED", "WAITLIST"] } },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
      comments: {
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!activity) notFound();

  const myParticipation = activity.participations.find((p) => p.userId === user.id);
  const isHost = activity.hostId === user.id;
  const joined = activity.participations.filter((p) => p.status === "JOINED");
  const waitlist = activity.participations.filter((p) => p.status === "WAITLIST");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
          {error}
        </p>
      )}
      {reported && (
        <p className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-sm px-3 py-2 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-300">
          Thanks, a moderator will look into this.
        </p>
      )}

      <div className="card">
        <h1 className="text-2xl font-bold">{activity.title}</h1>
        <p className="text-slate-600 mt-1">
          {format(activity.startsAt, "EEEE, MMMM d, yyyy · h:mm a")}
        </p>
        <p className="text-slate-600">
          {activity.latitude != null && activity.longitude != null ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${activity.latitude},${activity.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-brand-700"
            >
              {activity.location} ↗
            </a>
          ) : (
            activity.location
          )}
        </p>
        <p className="text-slate-500 text-sm mt-1">
          {activity.distanceKm ? `${activity.distanceKm} km` : null}
          {activity.distanceKm && activity.pace ? " · " : null}
          {activity.pace ? `${activity.pace} pace` : null}
        </p>
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
        </div>

        <div className="mt-6">
          {isHost && <p className="text-sm text-slate-500">You&apos;re hosting this run.</p>}
          {!isHost && !myParticipation && (
            <form action={joinActivityAction}>
              <input type="hidden" name="activityId" value={activity.id} />
              <button type="submit" className="btn-primary">
                Join this run
              </button>
            </form>
          )}
          {!isHost && myParticipation?.status === "JOINED" && (
            <form action={leaveActivityAction}>
              <input type="hidden" name="activityId" value={activity.id} />
              <button type="submit" className="btn-secondary">
                Leave
              </button>
            </form>
          )}
          {!isHost && myParticipation?.status === "WAITLIST" && (
            <div className="flex items-center gap-3">
              <span className="badge-amber">You&apos;re on the waitlist</span>
              <form action={leaveActivityAction}>
                <input type="hidden" name="activityId" value={activity.id} />
                <button type="submit" className="btn-secondary">
                  Leave waitlist
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">
          Runners joined ({joined.length}
          {activity.maxParticipants ? ` / ${activity.maxParticipants}` : ""})
        </h2>
        <ul className="space-y-3">
          {joined.map((p) => (
            <ParticipantRow key={p.id} user={p.user} activityId={activity.id} viewer={user.id} />
          ))}
        </ul>

        {waitlist.length > 0 && (
          <>
            <h3 className="font-semibold mt-5 mb-3 text-sm text-slate-600">
              Waitlist ({waitlist.length})
            </h3>
            <ul className="space-y-3">
              {waitlist.map((p) => (
                <ParticipantRow
                  key={p.id}
                  user={p.user}
                  activityId={activity.id}
                  viewer={user.id}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">Discussion</h2>
        <ul className="space-y-3 mb-4">
          {activity.comments.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <Avatar userId={c.author.id} hasPhoto={!!c.author.profilePhoto} size={8} />
              <div>
                <p className="text-sm">
                  <span className="font-medium">{c.author.name}</span>{" "}
                  <span className="text-slate-400 text-xs">
                    {format(c.createdAt, "MMM d, h:mm a")}
                  </span>
                </p>
                <p className="text-sm text-slate-700">{c.body}</p>
              </div>
            </li>
          ))}
          {activity.comments.length === 0 && (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
        </ul>

        <form action={postCommentAction} className="flex gap-2">
          <input type="hidden" name="activityId" value={activity.id} />
          <input
            className="input"
            name="body"
            placeholder="Coordinate meeting details, ask a question…"
            required
            maxLength={1000}
          />
          <button type="submit" className="btn-primary shrink-0">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function ParticipantRow({
  user,
  activityId,
  viewer,
}: {
  user: { id: string; name: string; profilePhoto: Uint8Array | null };
  activityId: string;
  viewer: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Avatar userId={user.id} hasPhoto={!!user.profilePhoto} size={8} />
        <span className="text-sm font-medium">{user.name}</span>
      </div>
      {user.id !== viewer && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-400 hover:text-red-600 list-none">
            🚩 Report
          </summary>
          <form action={reportUserAction} className="mt-2 flex flex-col gap-2 w-56">
            <input type="hidden" name="reportedUserId" value={user.id} />
            <input type="hidden" name="activityId" value={activityId} />
            <textarea
              name="reason"
              className="input"
              rows={2}
              placeholder="What happened?"
              required
              minLength={5}
            />
            <button type="submit" className="btn-danger !py-1 !text-xs">
              Submit report
            </button>
          </form>
        </details>
      )}
    </li>
  );
}
