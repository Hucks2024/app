import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });
  if (viewer.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { requestId } = await params;
  const record = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { selfiePhoto: true, selfiePhotoType: true },
  });

  if (!record) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(record.selfiePhoto), {
    headers: {
      "Content-Type": record.selfiePhotoType,
      "Cache-Control": "private, no-store",
    },
  });
}
