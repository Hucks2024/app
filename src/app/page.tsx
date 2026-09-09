import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/site";
import RunsScreen from "@/components/RunsScreen";

export default async function HomePage() {
  const user = await getCurrentUser();

  // Logged-in members see the map right here on "/" — no marketing copy,
  // no extra click. Not-yet-verified members still go to /verify first,
  // same as the login form's own redirect.
  if (user) {
    if (user.verificationStatus !== "APPROVED") redirect("/verify");
    return <RunsScreen />;
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="badge-green mb-4">Photo-ID verified members only</p>
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
        Connect with Running
      </h1>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/signup" className="btn-primary text-base px-6 py-3">
          Join {SITE.name}
        </Link>
        <Link href="/login" className="btn-secondary text-base px-6 py-3">
          Log in
        </Link>
      </div>
    </section>
  );
}
