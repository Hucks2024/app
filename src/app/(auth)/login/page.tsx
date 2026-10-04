import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Welcome from "@/components/Welcome";

export const metadata = { title: "Sign in" };

// The same welcome as the front page, minus everything under it: someone
// who tapped "Sign in" has already decided, so it's the buttons and
// nothing else.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  return <Welcome startWithEmail error={error ?? null} />;
}
