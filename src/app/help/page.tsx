import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { emailVerificationEnabled } from "@/lib/email";
import { SITE } from "@/lib/site";

export const metadata = { title: "Help" };

// Help, for when someone wants it, rather than a tour they have to sit
// through first. Short questions in the words people would use, short
// answers, nothing to log in for. Written to be read easily by anyone,
// including people reading in a second language or with a translate
// button.

type QA = { id: string; q: string; a: React.ReactNode };

export default async function HelpPage() {
  const user = await getCurrentUser();
  const canEmail = emailVerificationEnabled();

  const sections: { title: string; items: QA[] }[] = [
    {
      title: "The basics",
      items: [
        {
          id: "what",
          q: `What is ${SITE.name}?`,
          a: (
            <p>
              A map of meetups near you: runs, walks, bike rides, coffee, a pint. You pick one, say
              you&apos;re going, and turn up. That&apos;s it.
            </p>
          ),
        },
        {
          id: "free",
          q: "Does it cost anything?",
          a: <p>No. It&apos;s free for everyone, and you don&apos;t need an invite.</p>,
        },
        {
          id: "messages",
          q: "Can people message me?",
          a: (
            <p>
              No. There are no messages on {SITE.name}, on purpose. Nobody can contact you through
              the app, and there&apos;s no way to browse people. Everything you need is on the
              meetup page: when, where, and who&apos;s going.
            </p>
          ),
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
              <li>Tap <strong>Map</strong> at the bottom of the screen.</li>
              <li>Tap a meetup on the map, or one in the list under it.</li>
              <li>Tap <strong>I&apos;m in</strong>.</li>
              <li>Tap <strong>Add to calendar</strong> so your phone reminds you.</li>
            </ol>
          ),
        },
        {
          id: "near",
          q: "How do I see what's near me?",
          a: (
            <p>
              Tap <strong>Near me</strong> on the map and allow your location. The map moves to
              where you are, and the list shows how far away each meetup is.
            </p>
          ),
        },
        {
          id: "reminder",
          q: "Will I get a reminder?",
          a: canEmail ? (
            <p>
              Yes. We email you the day before, and straight away if the meetup changes or is
              cancelled. You can turn these emails off on your <strong>Me</strong> page. Tapping{" "}
              <strong>Add to calendar</strong> on the meetup gets your phone to remind you too.
            </p>
          ) : (
            <p>
              Tap <strong>Add to calendar</strong> on the meetup. Your phone will remind you an hour
              before.
            </p>
          ),
        },
        {
          id: "find",
          q: "How do I find the group when I get there?",
          a: (
            <p>
              Look on the meetup page for <strong>How to find us</strong>, for example &ldquo;yellow
              jacket, by the gate&rdquo;. Tap <strong>Directions</strong> to get there.
            </p>
          ),
        },
        {
          id: "cant-go",
          q: "I can't go any more. What do I do?",
          a: (
            <p>
              Open the meetup and tap <strong>I can&apos;t go now</strong>. If there&apos;s a
              waiting list, the next person gets your place.
            </p>
          ),
        },
        {
          id: "safe",
          q: "How do I stay safe?",
          a: (
            <ul className="list-disc space-y-1 pl-5">
              <li>Meet in the public place the host gave.</li>
              <li>Tell a friend where you&apos;re going.</li>
              <li>Get there and home your own way.</li>
              <li>If something feels wrong, leave.</li>
            </ul>
          ),
        },
        {
          id: "report",
          q: "Someone was out of line. What can I do?",
          a: (
            <p>
              On the meetup page, tap <strong>🚩 Report</strong> under their name and say what
              happened. Only moderators see it. If three different people who met them report them,
              they are banned for life.
            </p>
          ),
        },
      ],
    },
    {
      title: "Posting your own meetup",
      items: [
        {
          id: "post",
          q: "How do I post a meetup?",
          a: (
            <p>
              Tap <strong>Post</strong> at the bottom of the screen and answer four quick questions:
              what, where, when, and a name.
            </p>
          ),
        },
        {
          id: "locked",
          q: "Why can't I post yet?",
          a: (
            <p>
              Everyone goes to one meetup before they can post their own. It keeps things friendly:
              every host has turned up and met people. Once a meetup you said you&apos;d go to has
              happened, you can post.
            </p>
          ),
        },
        {
          id: "change",
          q: "How do I change or cancel my meetup?",
          a: (
            <p>
              Open your meetup and tap <strong>Change details</strong> or{" "}
              <strong>Cancel meetup</strong>. Everyone going sees the change.
            </p>
          ),
        },
      ],
    },
    {
      title: "Ticks and thumbs up",
      items: [
        {
          id: "tick",
          q: "What does ✓ Been before mean?",
          a: <p>That person has been to a meetup before. People who haven&apos;t yet show as New.</p>,
        },
        {
          id: "thumbs",
          q: "What is 👍?",
          a: (
            <p>
              After a meetup, the people who were there can give each other a thumbs up. The number
              next to someone&apos;s name is how many they&apos;ve had. Open a meetup that has
              finished to give yours.
            </p>
          ),
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
              On the sign in screen, type your email, then tap{" "}
              <strong>Forgot your password?</strong>. We&apos;ll email you a code to choose a new
              one.
            </p>
          ) : (
            <p>
              Ask a {SITE.name} admin. They can give you a temporary password, and you can change it
              on your profile straight after.
            </p>
          ),
        },
        {
          id: "profile",
          q: "How do I change my name, photo or password?",
          a: (
            <p>
              Tap <strong>Me</strong> at the bottom of the screen. Everything is on that page.
            </p>
          ),
        },
        {
          id: "delete",
          q: "How do I delete my account?",
          a: (
            <p>
              Tap <strong>Me</strong>, scroll to the bottom, and tap{" "}
              <strong>Delete my account</strong>. It&apos;s deleted for good.
            </p>
          ),
        },
        {
          id: "home-screen",
          q: "Can I put it on my phone like an app?",
          a: (
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>iPhone:</strong> in Safari, tap the Share button, then{" "}
                <strong>Add to Home Screen</strong>.
              </li>
              <li>
                <strong>Android:</strong> in Chrome, tap the ⋮ menu, then{" "}
                <strong>Add to Home screen</strong> or <strong>Install app</strong>.
              </li>
            </ul>
          ),
        },
        {
          id: "language",
          q: "Can I read it in my language?",
          a: (
            <p>
              Yes. Your phone can translate the whole site. In Safari, tap the{" "}
              <strong>aA</strong> button and <strong>Translate</strong>. In Chrome, tap{" "}
              <strong>Translate</strong> when it offers, or find it in the ⋮ menu.
            </p>
          ),
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold text-white drop-shadow">Help</h1>
      <p className="mt-2 text-lg text-white">Quick answers. Tap a question to see the answer.</p>

      {/* The rules, up top and always open: short enough to read in ten
          seconds, and the thing everyone agrees to when they join. */}
      <section id="rules" className="card mt-6 scroll-mt-20" aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="text-xl font-bold text-slate-900">
          House rules
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-base text-slate-800">
          <li>
            <strong>Be kind.</strong> Everyone is welcome, whatever their speed, size, age or
            background.
          </li>
          <li>
            <strong>Meet in public.</strong> Hosts pick busy, easy-to-find places.
          </li>
          <li>
            <strong>Turn up, or say you can&apos;t.</strong> Tap &ldquo;I can&apos;t go now&rdquo;
            so someone else can have your place.
          </li>
          <li>
            <strong>No selling, no promoting, no pressure.</strong> This is for meeting people, not
            for sales or dates.
          </li>
          <li>
            <strong>No means no.</strong> If someone doesn&apos;t want to swap numbers or carry on
            afterwards, leave it there.
          </li>
        </ol>
        <p className="mt-3 text-base text-slate-700">
          Break them and people can report you. If three different people who met you report
          you, you&apos;re banned for life.
        </p>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="mt-8" aria-labelledby={`h-${section.title}`}>
          <h2 id={`h-${section.title}`} className="mb-3 text-xl font-bold text-white">
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

      <div className="card mt-10 text-center">
        <p className="text-lg font-semibold text-slate-900">Ready to go?</p>
        <Link href={user ? "/" : "/login"} className="btn-primary mt-3 min-h-12 px-8 text-lg">
          {user ? "Back to the map" : "Sign in or join free"}
        </Link>
      </div>
    </div>
  );
}
