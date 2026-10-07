import tzlookup from "@photostructure/tz-lookup";
import type { PrismaClient } from "@prisma/client";
import { emailVerificationEnabled, sendEmail } from "@/lib/email";
import { SITE } from "@/lib/site";

// The emails that stop people turning up to nothing: a reminder the day
// before, and word straight away when a meetup they're going to moves or
// is called off, or when a place opens up for them off the waitlist.
//
// Free meetups lose a third or more of the people who said yes, and a
// reminder is the most reliable fix there is. All of it is quiet when
// email isn't set up (no RESEND_API_KEY), and nobody gets these once
// they've switched them off on the Me page.

type Meetup = {
  id: string;
  title: string;
  location: string;
  findUs: string | null;
  startsAt: Date;
  latitude: number | null;
  longitude: number | null;
};

/** "Saturday 10 October, 7:00 am" in the meetup's own time zone: the
 * people going will be there, so that's the time that matters. Worked out
 * from the pin; London when there isn't one. */
export function whenAtMeetup(m: Pick<Meetup, "startsAt" | "latitude" | "longitude">): string {
  let zone = "Europe/London";
  try {
    if (m.latitude != null && m.longitude != null) zone = tzlookup(m.latitude, m.longitude);
  } catch {
    // Out at sea or similar: London will do.
  }
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(m.startsAt);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(m.startsAt)
    .replace(/\s?(am|pm)$/i, (x) => ` ${x.trim().toLowerCase()}`);
  return `${day}, ${time}`;
}

function link(m: { id: string }) {
  return `${SITE.url}/activities/${m.id}`;
}

const FOOTER = ["", "—", `Stop these emails: ${SITE.url}/profile`].join("\n");

type Person = { id: string; email: string; name: string };

/** Who should hear about a meetup: everyone going or waiting, still a
 * member, who hasn't switched emails off. */
async function audience(prisma: PrismaClient, activityId: string, exceptUserId?: string): Promise<Person[]> {
  const rows = await prisma.participation.findMany({
    where: {
      activityId,
      status: { in: ["JOINED", "WAITLIST"] },
      user: { accountStatus: "ACTIVE", emailReminders: true },
      ...(exceptUserId ? { userId: { not: exceptUserId } } : {}),
    },
    select: { user: { select: { id: true, email: true, name: true } } },
  });
  return rows.map((r) => r.user);
}

async function sendAll(people: Person[], subject: string, body: (p: Person) => string) {
  if (!emailVerificationEnabled()) return;
  for (const p of people) {
    const sent = await sendEmail({ to: p.email, subject, text: body(p) + "\n" + FOOTER });
    if (!sent.ok) console.error(`Email "${subject}" to ${p.id} failed:`, sent.error);
  }
}

export async function emailCancelled(prisma: PrismaClient, m: Meetup, byUserId: string) {
  const people = await audience(prisma, m.id, byUserId);
  await sendAll(people, `Cancelled: ${m.title}`, (p) =>
    [
      `Hi ${p.name},`,
      ``,
      `Sorry, ${m.title} is cancelled.`,
      `It was on ${whenAtMeetup(m)}.`,
      ``,
      `Find another: ${SITE.url}/`,
    ].join("\n")
  );
}

export async function emailChanged(prisma: PrismaClient, m: Meetup, byUserId: string) {
  const people = await audience(prisma, m.id, byUserId);
  await sendAll(people, `Changed: ${m.title}`, (p) =>
    [
      `Hi ${p.name},`,
      ``,
      `${m.title} has changed.`,
      ``,
      `When:  ${whenAtMeetup(m)}`,
      `Where: ${m.location}`,
      ...(m.findUs ? [`How to find us: ${m.findUs}`] : []),
      ``,
      `See it: ${link(m)}`,
      `Can't go? Open it and tap "I can't go now".`,
    ].join("\n")
  );
}

export async function emailGotAPlace(prisma: PrismaClient, m: Meetup, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, accountStatus: "ACTIVE", emailReminders: true },
    select: { id: true, email: true, name: true },
  });
  if (!user) return;
  await sendAll([user], `You've got a place: ${m.title}`, (p) =>
    [
      `Hi ${p.name},`,
      ``,
      `Good news: you're in!`,
      ``,
      `${m.title}`,
      `When:  ${whenAtMeetup(m)}`,
      `Where: ${m.location}`,
      ``,
      `See it: ${link(m)}`,
      `Can't go? Open it and tap "I can't go now".`,
    ].join("\n")
  );
}

/** The day-before reminders. Run once a day (vercel.json); safe to run
 * more often, or twice by accident, because each person's reminder for
 * each meetup is marked as sent and never goes again. */
export async function sendReminders(prisma: PrismaClient, limit = 80): Promise<{ sent: number; failed: number }> {
  if (!emailVerificationEnabled()) return { sent: 0, failed: 0 };
  const now = new Date();
  const due = await prisma.participation.findMany({
    where: {
      status: "JOINED",
      reminderSentAt: null,
      user: { accountStatus: "ACTIVE", emailReminders: true },
      activity: {
        cancelledAt: null,
        startsAt: { gt: now, lte: new Date(now.getTime() + 30 * 60 * 60 * 1000) },
        host: { accountStatus: "ACTIVE" },
      },
    },
    orderBy: { activity: { startsAt: "asc" } },
    take: limit,
    select: {
      id: true,
      user: { select: { id: true, email: true, name: true } },
      activity: {
        select: { id: true, title: true, location: true, findUs: true, startsAt: true, latitude: true, longitude: true },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  for (const row of due) {
    const m = row.activity;
    const directions =
      m.latitude != null && m.longitude != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.location)}`;
    const result = await sendEmail({
      to: row.user.email,
      subject: `Reminder: ${m.title}`,
      text:
        [
          `Hi ${row.user.name},`,
          ``,
          `You're going to ${m.title}.`,
          ``,
          `When:  ${whenAtMeetup(m)}`,
          `Where: ${m.location}`,
          ...(m.findUs ? [`How to find us: ${m.findUs}`] : []),
          ``,
          `Directions: ${directions}`,
          `See it: ${link(m)}`,
          ``,
          `Can't go? Open it and tap "I can't go now".`,
        ].join("\n") +
        "\n" +
        FOOTER,
    });
    if (result.ok) {
      sent++;
      await prisma.participation.update({ where: { id: row.id }, data: { reminderSentAt: new Date() } });
    } else {
      failed++;
      console.error(`Reminder to ${row.user.id} failed:`, result.error);
    }
  }
  return { sent, failed };
}
