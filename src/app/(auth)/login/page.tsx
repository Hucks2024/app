import { readError } from "@/lib/flash";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/lib/auth";
import Welcome from "@/components/Welcome";

export const metadata = { title: "Sign in" };

// The same welcome as the front page, minus everything under it: someone
// who tapped "Sign in" has already decided, so it's the buttons and
// nothing else.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sig?: string; next?: string }>;
}) {
  const { error, sig, next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  return <Welcome startWithEmail error={readError(error, sig)} next={safeNext(next)} />;
}
