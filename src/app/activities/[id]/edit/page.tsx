import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import MeetupForm from "@/components/MeetupForm";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).post.editMeetup };
}

// The host (or an admin) fixing a meetup: a wrong time, a better meeting
// point, a cap. Only before it starts, and not once it's been called off.
export default async function EditMeetupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [prisma, t] = await Promise.all([getPrisma(), getT()]);
  const a = await prisma.runActivity.findUnique({ where: { id } });
  if (!a || (a.hostId !== user.id && user.role !== "ADMIN")) notFound();
  if (a.cancelledAt || a.startsAt <= new Date()) redirect(`/activities/${id}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-6 text-white drop-shadow">{t.post.editMeetup}</h1>
      <MeetupForm
        initial={{
          id: a.id,
          title: a.title,
          category: a.category,
          location: a.location,
          latitude: a.latitude,
          longitude: a.longitude,
          findUs: a.findUs,
          startsAt: a.startsAt.toISOString(),
          pace: a.pace,
          description: a.description,
          emoji: a.emoji,
        }}
      />
    </div>
  );
}
