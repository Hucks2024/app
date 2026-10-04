import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import MeetupForm from "@/components/MeetupForm";

export const metadata = { title: "Edit meetup" };

// The host (or an admin) fixing a meetup: a wrong time, a better meeting
// point, a cap. Only before it starts, and not once it's been called off.
export default async function EditMeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireMember();
  const { id } = await params;
  const prisma = await getPrisma();
  const a = await prisma.runActivity.findUnique({ where: { id } });
  if (!a || (a.hostId !== user.id && user.role !== "ADMIN")) notFound();
  if (a.cancelledAt || a.startsAt <= new Date()) redirect(`/activities/${id}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-1 text-white drop-shadow">Edit meetup</h1>
      <p className="text-sm text-white/85 mb-6">
        Everyone going sees the change straight away on the meetup.
      </p>
      <MeetupForm
        initial={{
          id: a.id,
          title: a.title,
          category: a.category,
          location: a.location,
          startsAt: a.startsAt.toISOString(),
          afterSpot: a.afterSpot,
          distanceKm: a.distanceKm,
          pace: a.pace,
          maxParticipants: a.maxParticipants,
          description: a.description,
          stravaUrl: a.stravaUrl,
        }}
      />
    </div>
  );
}
