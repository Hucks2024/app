import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });
  if (viewer.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { requestId } = await params;
  const prisma = await getPrisma();
  const record = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { idPhoto: true, idPhotoType: true },
  });

  // idPhoto is deliberately wiped after a decision is made, so this can
  // legitimately 404 even for a request that clearly exists.
  if (!record?.idPhoto || !record.idPhotoType) {
    return new NextResponse("Not found (may have already been reviewed and purged)", {
      status: 404,
    });
  }

  return new NextResponse(new Uint8Array(record.idPhoto), {
    headers: {
      "Content-Type": record.idPhotoType,
      "Cache-Control": "private, no-store",
    },
  });
}
