import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";

// Joining used to need a code from an email; it doesn't any more. Kept
// only so an old link here still lands somewhere useful.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(safeNext(next));
}
