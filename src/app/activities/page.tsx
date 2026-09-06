import Link from "next/link";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import Avatar from "@/components/Avatar";

export default async function ActivitiesPage() {
  const user = await requireUser();
  const prisma = await getPrisma();

  const activities = await prisma.runActivity.findMany({
    where: { startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: {
      host: { select: { id: true, name: true, profilePhoto: true } },
      participations: { where: { status: "JOINED" } },
    },
  });

  const isVerified = user.verificationStatus === "APPROVED";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Upcoming runs</h1>
        {isVerified && (
          <Link href="/activities/new" className="btn-primary">
            + Post a run
          </Link>
        )}
      </div>

      {!isVerified && (
        <div className="card bg-amber-50 border-amber-200 mb-6">
          <p className="text-sm text-amber-800">
            You can browse runs, but you&apos;ll need to{" "}
            <Link href="/verify" className="underline font-medium">
              get verified
            </Link>{" "}
            before you can join one or post your own.
          </p>
        </div>
      )}

      {activities.length === 0 && (
        <p className="text-slate-600">No upcoming runs yet. Be the first to post one!</p>
      )}

      <ul className="space-y-4">
        {activities.map((a) => (
          <li key={a.id}>
            <Link href={`/activities/${a.id}`} className="card block hover:border-brand-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-lg">{a.title}</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {format(a.startsAt, "EEE, MMM d · h:mm a")} · {a.location}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {a.distanceKm ? `${a.distanceKm} km` : null}
                    {a.distanceKm && a.pace ? " · " : null}
                    {a.pace ? `${a.pace} pace` : null}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Avatar userId={a.host.id} hasPhoto={!!a.host.profilePhoto} size={6} />
                    {a.host.name}
                  </div>
                  <span className="badge-slate">
                    {a.participations.length}
                    {a.maxParticipants ? ` / ${a.maxParticipants}` : ""} joined
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
