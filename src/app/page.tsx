import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/site";

export default async function HomePage() {
  const user = await getCurrentUser();

  // Logged-in members skip the marketing page entirely — straight to the
  // map of runs (or to verification, if they haven't finished that yet),
  // same destination the login form itself redirects to.
  if (user) {
    redirect(user.verificationStatus === "APPROVED" ? "/activities" : "/verify");
  }

  return (
    <div>
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <p className="badge-green mb-4">Photo-ID verified members only</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          Helping people connect
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          {SITE.name} is a small, verified community for runners to organize group runs, find
          training partners, and meet up for race day — without the anonymous-app creep factor.
          Everyone here has confirmed their identity with a photo ID before they can join.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary text-base px-6 py-3">
            Join {SITE.name}
          </Link>
          <Link href="/login" className="btn-secondary text-base px-6 py-3">
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 grid gap-6 sm:grid-cols-3">
        <div className="card">
          <div className="text-2xl mb-2">🪪</div>
          <h3 className="font-semibold mb-1">Real people only</h3>
          <p className="text-sm text-slate-600">
            Every member submits a selfie and a photo ID that a human reviews before they can
            join a single run. No verification, no access.
          </p>
        </div>
        <div className="card">
          <div className="text-2xl mb-2">🏃‍♀️</div>
          <h3 className="font-semibold mb-1">Built around runs</h3>
          <p className="text-sm text-slate-600">
            Post a run with a pace, distance, and meeting point — or browse what other verified
            runners near you have planned.
          </p>
        </div>
        <div className="card">
          <div className="text-2xl mb-2">🚩</div>
          <h3 className="font-semibold mb-1">Easy to report</h3>
          <p className="text-sm text-slate-600">
            If someone&apos;s being weird, one tap flags them to a human admin — who can suspend
            their account.
          </p>
        </div>
      </section>
    </div>
  );
}
