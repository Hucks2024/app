import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata = { title: "Terms" };

// What everyone agrees to when they join, in plain words. The App Store
// asks for exactly this of apps where people post things and meet: zero
// tolerance for nastiness, a way to report it, and a way to block people.

const UPDATED = "9 October 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold text-white drop-shadow">Terms</h1>
      <p className="mt-1 text-base text-white/90">Last updated {UPDATED}</p>

      <div className="card mt-6 space-y-6 text-base leading-relaxed text-slate-800">
        <Section title="The short version">
          <ul className="list-disc space-y-1 pl-5">
            <li>You must be {SITE.minimumAge} or over.</li>
            <li>Be kind. Meet in public. No selling.</li>
            <li>We don&apos;t put up with abuse, hate or sexual content. At all.</li>
            <li>Report anything wrong. We act within 24 hours.</li>
          </ul>
        </Section>

        <Section title="Who can join">
          <p>
            You must be {SITE.minimumAge} or over. One account each, in your own first name, with a real photo of your
            face. {SITE.name} is for meeting people to do things together. It isn&apos;t a dating or hookup app.
          </p>
        </Section>

        <Section title="Zero tolerance">
          <p>There is no place here for objectionable content or abusive people. You must not:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>harass, bully, threaten or stalk anyone, online or in person;</li>
            <li>post anything hateful, sexual, violent or illegal;</li>
            <li>advertise or sell, or post links, emails or phone numbers;</li>
            <li>pretend to be someone else, or post a meetup you won&apos;t turn up to.</li>
          </ul>
          <p className="mt-2">
            Break these and we remove what you posted and ban you, for good. Three reports from people you met at
            meetups ban you automatically.
          </p>
        </Section>

        <Section title="Reporting and blocking">
          <p>
            On any meetup, tap <strong>🚩 Report or block</strong> under someone&apos;s name, or{" "}
            <strong>🚩 Report this meetup</strong>. We review every report within 24 hours. Blocking someone hides
            your meetups from each other straight away. You can unblock them on <strong>Me</strong>.
          </p>
        </Section>

        <Section title="Meeting in person">
          <p>
            You&apos;re responsible for your own safety. We don&apos;t check who people are. Meet in public, tell a friend
            where you&apos;re going, get home your own way, and leave if anything feels wrong. Activities like running,
            swimming or climbing carry risk: take part within your limits.
          </p>
        </Section>

        <Section title="What you post">
          <p>
            What you post stays yours. You let us show it in {SITE.name} so the meetup works. Only post what you have
            the right to.
          </p>
        </Section>

        <Section title="Leaving">
          <p>
            You can delete your account any time: <strong>Me</strong> → <strong>Delete my account</strong>. We can
            suspend or ban accounts that break these terms.
          </p>
        </Section>

        <Section title="The legal bit">
          <p>
            {SITE.name} is free and comes as it is, without guarantees. As far as the law allows, we aren&apos;t liable
            for what happens at meetups or for what members post. Nothing here takes away your rights as a consumer.
            If you got the app from the App Store, Apple&apos;s standard licence applies too. These terms are governed
            by the laws of England and Wales. If we change them, we&apos;ll update the date at the top.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a href={`mailto:${SITE.contactEmail}`} className="font-semibold text-brand-700 underline">
              {SITE.contactEmail}
            </a>
          </p>
        </Section>
      </div>

      <p className="mt-6 text-center text-base text-white">
        <Link href="/privacy" className="underline">
          Privacy policy
        </Link>{" "}
        ·{" "}
        <Link href="/info" className="underline">
          Info
        </Link>
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
