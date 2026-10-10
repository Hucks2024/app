import Link from "next/link";
import ContactEmail from "@/components/ContactEmail";
import { SITE } from "@/lib/site";

export const metadata = { title: "Privacy" };

// What's kept, why, who else handles it, and how to get rid of it, in
// plain words. Keep it true: when the app starts keeping something new,
// it goes in here in the same change.

const UPDATED = "9 October 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold text-white drop-shadow">Privacy</h1>
      <p className="mt-1 text-base text-white/90">Last updated {UPDATED}</p>

      <div className="card mt-6 space-y-6 text-base leading-relaxed text-slate-800">
        <Section title="The short version">
          <ul className="list-disc space-y-1 pl-5">
            <li>We keep what the app needs to work, and nothing else.</li>
            <li>No adverts, no tracking, no selling your data. Ever.</li>
            <li>Your location stays on your phone.</li>
            <li>Delete your account and it&apos;s gone.</li>
          </ul>
        </Section>

        <Section title="Who we are">
          <p>
            {SITE.name} ({SITE.domain}) is a free map of meetups. Questions about your data:{" "}
            <Mail />.
          </p>
        </Section>

        <Section title="What we keep, and why">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Your account:</strong> email address, first name and member number, to sign you in and show who
              you are. Your password is stored scrambled; nobody can read it, us included.
            </li>
            <li>
              <strong>Your photo:</strong> the one photo of your face you choose, so the group knows who to look for.
              Only signed-in members can see it.
            </li>
            <li>
              <strong>Meetups you post:</strong> what, where (the place you type and its spot on the map), when, and any
              notes. Members see them in full. Visitors who aren&apos;t signed in only see roughly where, and what
              kind.
            </li>
            <li>
              <strong>What you do here:</strong> meetups you go to, thumbs up you give and get, reports you send and
              people you block, to run the app and keep it safe.
            </li>
            <li>
              <strong>Security:</strong> wrong password attempts, when you last changed your password, and password reset
              codes (deleted once used, or after 15 minutes).
            </li>
          </ul>
        </Section>

        <Section title="What we don't do">
          <ul className="list-disc space-y-2 pl-5">
            <li>No adverts, analytics or tracking, here or across other apps and sites.</li>
            <li>We never sell or share your data for marketing.</li>
            <li>
              <strong>Location:</strong> when you tap <strong>Near me</strong>, your phone tells the app where you are,
              only to centre the map and show distances. It stays on your phone; it&apos;s never sent to us or kept.
            </li>
            <li>No messages, contacts, microphone or photo library access: only the one photo you pick.</li>
          </ul>
        </Section>

        <Section title="Who else handles it">
          <p>A few services run parts of {SITE.name} for us. Each only uses your data to do that job:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>
              <strong>Vercel</strong> runs the app. Its servers keep short-lived logs, including IP addresses.
            </li>
            <li>
              <strong>Turso</strong> stores the database: accounts, photos and meetups.
            </li>
            <li>
              <strong>Resend</strong> sends password reset emails, so it gets your email address.
            </li>
            <li>
              <strong>OpenFreeMap</strong> draws the map (OpenStreetMap&apos;s own servers stand in if it&apos;s down).
              It sees your IP address and which bit of map you&apos;re looking at, not who you are.
            </li>
            <li>
              <strong>OpenStreetMap (Nominatim)</strong> and <strong>Komoot (Photon)</strong> find the place you type when
              you post a meetup. They see your IP address and that place, not who you are.
            </li>
          </ul>
          <p className="mt-2">
            They protect your data at least as well as this policy does. Their servers may be outside your country;
            where they are, the transfer is covered by the legal safeguards UK and EU law require. If you tap a link to
            Google Calendar, Google Maps or Strava, that service&apos;s own privacy policy applies.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            One cookie, to keep you signed in. Your phone also remembers a couple of small settings, like a tip
            you&apos;ve closed. No tracking cookies.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Until you delete your account: <strong>Me</strong> → <strong>Delete my account</strong>. That removes your
            account, photo, the meetups you host and your places on others, straight away. Server logs go within weeks.
          </p>
        </Section>

        <Section title="Your choices and rights">
          <p>
            You agree to this policy when you join, and you can take that back any time by deleting your account. You
            can also ask us for a copy of your data, or to correct or delete it: email <Mail />. We use your data to
            provide the service you signed up for, and to keep members safe. If you&apos;re unhappy with how we handle
            it, you can complain to the Information Commissioner&apos;s Office (ico.org.uk) or your local data
            protection authority.
          </p>
        </Section>

        <Section title="Under 18s">
          <p>
            {SITE.name} is for people {SITE.minimumAge} and over. If we find an account belongs to someone younger, we
            delete it.
          </p>
        </Section>

        <Section title="Changes">
          <p>If this policy changes, we&apos;ll update it here and change the date at the top.</p>
        </Section>
      </div>

      <p className="mt-6 text-center text-base text-white">
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/info" className="underline">
          Info
        </Link>
      </p>
    </div>
  );
}

function Mail() {
  return (
    <ContactEmail className="font-semibold text-brand-700 underline" />
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
