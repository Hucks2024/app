import { NextResponse, type NextRequest } from "next/server";
import { getPrisma } from "@/lib/db";
import { sendReminders } from "@/lib/notify";

// The day-before reminder emails. Vercel calls this once a day (see
// vercel.json). When CRON_SECRET is set in Vercel, it sends that as a
// bearer token and anything else is turned away; without it the route is
// still harmless to call, because a reminder only ever goes once.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not allowed", { status: 401 });
  }
  const prisma = await getPrisma();
  const result = await sendReminders(prisma);
  return NextResponse.json(result);
}
