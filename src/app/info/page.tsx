import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { canSendEmail } from "@/lib/email";
import { SITE } from "@/lib/site";

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

  const sections: { title: string; items: QA[] }[] = [
    {
      title: "The basics",
      items: [
        {
          id: "what",
          q: `What is ${SITE.name}?`,
          a: <p>A map of meetups. Pick one. Turn up.</p>,
        },
        {
          id: "free",
          q: "Does it cost anything?",
          a: <p>No. It&apos;s free.</p>,
        },
        {
          id: "messages",
          q: "Can people message me?",
          a: <p>No. Nobody can message you here.</p>,
        },
      ],
    },
    {
      title: "Going to a meetup",
      items: [
        {
          id: "join",
          q: "How do I go to a meetup?",
          a: (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Tap <strong>Map</strong>.</li>
              <li>Tap a meetup.</li>
              <li>Tap <strong>I&apos;m in</strong>.</li>
            </ol>
          ),
        },
        {
          id: "photo",
          q: "Do I need a photo?",
          a: <p>Yes, of your face. People need to know who to look for.</p>,
        },
        {
          id: "near",
          q: "What's near me?",
          a: (
            <p>
              Tap <strong>Near me</strong> on the map.
            </p>
          ),
        },
        {
          id: "reminder",
          q: "Will I get a reminder?",
          a: (
            <p>
              Tap <strong>Add to calendar</strong> on the meetup. Your phone will remind you.
            </p>
          ),
        },
        {
          id: "find",
          q: "How do I find the group?",
          a: (
            <p>
              Look for <strong>How to find us</strong> on the meetup.
            </p>
          ),
        },
        {
          id: "cant-go",
          q: "I can't go any more",
          a: (
            <p>
              Open the meetup. Tap <strong>I can&apos;t go now</strong>.
            </p>
          ),
        },
        {
          id: "safe",
          q: "How do I stay safe?",
          a: (
            <ul className="list-disc space-y-1 pl-5">
              <li>Stay in public.</li>
              <li>Tell a friend where you are.</li>
              <li>Get home your own way.</li>
              <li>Feels wrong? Leave.</li>
            </ul>
          ),
        },
        {
          id: "report",
          q: "Someone was rude",
          a: (
            <p>
              Tap <strong>🚩 Report or block</strong> under their name. We act within 24 hours.
            </p>
          ),
        },
        {
          id: "block",
          q: "Block someone",
          a: (
            <p>
              Tap <strong>🚩 Report or block</strong> under their name, then <strong>Block</strong>. You won&apos;t see
              each other&apos;s meetups. Undo it on <strong>Me</strong>.
            </p>
          ),
        },
      ],
    },
    {
      title: "Posting a meetup",
      items: [
        {
          id: "post",
          q: "How do I post a meetup?",
          a: (
            <p>
              Tap <strong>Post</strong>. Answer 4 questions.
            </p>
          ),
        },
        {
          id: "locked",
          q: "Why can't I post yet?",
          a: <p>Go to one meetup first. Any meetup, anywhere.</p>,
        },
        {
          id: "change",
          q: "How do I change or cancel it?",
          a: (
            <p>
              Open it. Tap <strong>Change details</strong> or <strong>Cancel meetup</strong>.
            </p>
          ),
        },
      ],
    },
    {
      title: "✓ and 👍",
      items: [
        {
          id: "tick",
          q: "What does ✓ Been before mean?",
          a: <p>They&apos;ve been to a meetup.</p>,
        },
        {
          id: "thumbs",
          q: "What is 👍?",
          a: <p>Thumbs up from people they met.</p>,
        },
      ],
    },
    {
      title: "Your account",
      items: [
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
          id: "profile",
          q: "Change my name, photo or password",
          a: (
            <p>
              Tap <strong>Me</strong>.
            </p>
          ),
        },
        {
          id: "delete",
          q: "Delete my account",
          a: (
            <p>
              Tap <strong>Me</strong>. Scroll down. Tap <strong>Delete my account</strong>.
            </p>
          ),
        },
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
        {
          id: "language",
          q: "Read it in my language",
          a: <p>Use your browser&apos;s Translate button.</p>,
        },
        {
          id: "privacy",
          q: "My data",
          a: (
            <p>
              No adverts, no tracking. Read the{" "}
              <Link href="/privacy" className="font-semibold text-brand-700 underline">
                Privacy policy
              </Link>
              .
            </p>
          ),
        },
      ],
    },
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

      <p className="mt-8 text-lg text-white">Questions? Tap one.</p>

      {sections.map((section, i) => (
        <section key={section.title} className="mt-8" aria-labelledby={`help-h${i}`}>
          <h2 id={`help-h${i}`} className="mb-3 text-xl font-bold text-white">
            {section.title}
          </h2>
          <div className="space-y-3">
            {section.items.map((item) => (
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
        </section>
      ))}

      <section id="contact" className="card mt-10 scroll-mt-20 text-center" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-xl font-bold text-slate-900">
          Contact us
        </h2>
        <p className="mt-2 text-base text-slate-700">Questions, problems or something to report:</p>
        <a href={`mailto:${SITE.contactEmail}`} className="mt-1 inline-block text-lg font-semibold text-brand-700 underline">
          {SITE.contactEmail}
        </a>
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
