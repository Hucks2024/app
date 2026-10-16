import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { canSendEmail } from "@/lib/email";
import ContactEmail from "@/components/ContactEmail";
import { SITE } from "@/lib/site";
import { inApp } from "@/lib/in-app";

export const metadata = { title: "Info" };

// Info (it used to be called Help), for when someone wants it, rather than a tour they have to sit
// through first. Short questions in the words people would use, short
// answers, nothing to log in for. Written to be read easily by anyone,
// including people reading in a second language or with a translate
// button.

type QA = { id: string; q: string; a: React.ReactNode };


export default async function InfoPage() {
  const user = await getCurrentUser();
  const canEmail = canSendEmail();
  const app = await inApp();

  // Few questions, short answers: the ones people actually ask.
  const questions: QA[] = [
    {
      id: "what",
      q: `What is ${SITE.name}?`,
      a: <p>A free map of meetups. Pick one. Turn up. Nobody can message you.</p>,
    },
    {
      id: "who",
      q: "Who is it for?",
      a: (
        <p>
          It&apos;s made for {SITE.recommendedAges}s, so that&apos;s who you&apos;ll mostly meet. Anyone {SITE.minimumAge} or
          over can join.
        </p>
      ),
    },
    {
      id: "join",
      q: "How do I go to a meetup?",
      a: (
        <ol className="list-decimal space-y-1 pl-5">
          <li>Tap a pin on the <strong>Map</strong>.</li>
          <li>Tap <strong>I&apos;m in</strong>.</li>
          <li>Turn up. Can&apos;t go? Tap <strong>I can&apos;t go now</strong>.</li>
        </ol>
      ),
    },
    {
      id: "post",
      q: "How do I post a meetup?",
      a: (
        <p>
          Tap <strong>Post</strong> and answer 4 questions. You can post after your first meetup.
        </p>
      ),
    },
    {
      id: "photo",
      q: "Do I need a photo?",
      a: <p>Yes, of your face, so people know who to look for.</p>,
    },
    {
      id: "safe",
      q: "How do I stay safe?",
      a: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Stay in public.</li>
          <li>Tell a friend where you are.</li>
          <li>Feels wrong? Leave.</li>
        </ul>
      ),
    },
    {
      id: "report",
      q: "Someone was rude",
      a: (
        <p>
          Tap <strong>🚩 Report or block</strong> under their name. Blocking hides you from each other. Undo it on{" "}
          <strong>Me</strong>.
        </p>
      ),
    },
    {
      id: "forgot",
      q: "I forgot my password",
      a: canEmail ? (
        <p>
          On sign in, tap <strong>Forgot your password?</strong>
        </p>
      ) : (
        <p>Ask an admin.</p>
      ),
    },
    {
      id: "delete",
      q: "Delete my account",
      a: (
        <p>
          Tap <strong>Me</strong> → <strong>Settings</strong> → <strong>Delete my account</strong>.
        </p>
      ),
    },
    // Website only: the app is already on the phone.
    ...(app
      ? []
      : [
          {
            id: "home-screen",
            q: "Put it on my phone",
            a: (
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>iPhone:</strong> Share → <strong>Add to Home Screen</strong>
                </li>
                <li>
                  <strong>Android:</strong> ⋮ → <strong>Add to Home screen</strong>
                </li>
              </ul>
            ),
          },
        ]),
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold text-white drop-shadow">Info</h1>

      {/* A little nerve for the first time: walking up to strangers is
          the hard bit, and the reason most people never go. */}
      <figure className="card mt-6 !p-5">
        <blockquote className="text-xl font-semibold leading-snug text-slate-900">
          &ldquo;Every friend was once a stranger.&rdquo;
        </blockquote>
      </figure>

      {/* The rules, up top and always open: short enough to read in ten
          seconds, and the thing everyone agrees to when they join. */}
      <section id="rules" className="card mt-6 scroll-mt-20" aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="text-xl font-bold text-slate-900">
          House rules
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-base text-slate-800">
          <li>{SITE.minimumAge}+ only.</li>
          <li>Be kind.</li>
          <li>Meet in public.</li>
          <li>
            Can&apos;t go? Tap <strong>I can&apos;t go now</strong>.
          </li>
          <li>No selling.</li>
          <li>No means no.</li>
        </ol>
        <p className="mt-3 text-base font-semibold text-slate-900">🚩 3 reports = banned for life.</p>
        <p className="mt-2 text-sm text-slate-600">
          The full{" "}
          <Link href="/terms" className="font-semibold text-brand-700 underline">
            Terms
          </Link>
          .
        </p>
      </section>

      <p className="mb-3 mt-8 text-lg font-semibold text-white">Questions? Tap one.</p>

      <div className="space-y-3">
        {questions.map((item) => (
          <details key={item.id} id={item.id} className="card !p-0 help-item">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-lg font-semibold text-slate-900">
              {item.q}
              <span className="help-chevron text-2xl text-brand-700" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="px-5 pb-5 text-base leading-relaxed text-slate-800">{item.a}</div>
          </details>
        ))}
      </div>

      <section id="contact" className="card mt-10 scroll-mt-20 text-center" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-xl font-bold text-slate-900">
          Contact us
        </h2>
        <p className="mt-2 text-base text-slate-700">Questions, problems or something to report:</p>
        <ContactEmail className="mt-1 inline-block text-lg font-semibold text-brand-700 underline" />
        <p className="mt-3 text-sm text-slate-600">
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </section>

      <div className="card mt-6 text-center">
        <p className="text-lg font-semibold text-slate-900">Ready?</p>
        <Link href={user ? "/" : "/login"} className="btn-primary mt-3 min-h-12 px-8 text-lg">
          {user ? "Back to the map" : "Join free"}
        </Link>
      </div>
    </div>
  );
}
