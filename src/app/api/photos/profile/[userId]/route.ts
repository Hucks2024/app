import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Photos are only visible to logged-in members, not the open internet.
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });

  const { userId } = await params;
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePhoto: true, profilePhotoType: true },
  });

  if (!user?.profilePhoto || !user.profilePhotoType) {
    return new NextResponse("Not found", { status: 404 });
  }

  // A link with the photo's version in it (?v=) always means the same
  // photo, so the phone keeps it for good; a new photo gets a new link.
  // Private either way: only for this member's own phone, never a shared
  // cache, as photos are members-only.
  const versioned = req.nextUrl.searchParams.has("v");
  return new NextResponse(new Uint8Array(user.profilePhoto), {
    headers: {
      "Content-Type": user.profilePhotoType,
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, max-age=3600",
    },
  });
}
