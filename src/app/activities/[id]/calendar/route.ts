import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { SITE } from "@/lib/site";

// "Add to calendar": the meetup as a calendar file, which iPhones, Macs,
// Outlook and most Android phones open straight into their calendar app.
// The calendar then does the reminding (an hour before, set below), which
// is the single most effective thing for people actually turning up.

/** Text as calendar files want it: commas, semicolons and newlines escaped. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${SITE.url}/login`);

  const { id } = await params;
  const prisma = await getPrisma();
  const a = await prisma.runActivity.findUnique({ where: { id } });
  if (!a || a.cancelledAt) return new NextResponse("This meetup isn't on any more.", { status: 404 });

  const end = new Date(a.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const url = `${SITE.url}/activities/${a.id}`;
  const details = [a.findUs ? `How to find us: ${a.findUs}` : null, a.description, url]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE.name}//Meetups//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@${SITE.domain}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(a.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(a.title)}`,
    `LOCATION:${esc(a.location)}`,
    `DESCRIPTION:${esc(details)}`,
    `URL:${url}`,
    ...(a.latitude != null && a.longitude != null ? [`GEO:${a.latitude};${a.longitude}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`${a.title} in an hour`)}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${SITE.name.toLowerCase()}-meetup.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
