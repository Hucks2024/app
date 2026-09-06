import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Photos are only visible to logged-in members, not the open internet.
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePhoto: true, profilePhotoType: true },
  });

  if (!user?.profilePhoto || !user.profilePhotoType) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(user.profilePhoto), {
    headers: {
      "Content-Type": user.profilePhotoType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
