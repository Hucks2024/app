import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { canSendEmail } from "@/lib/email";
import ContactEmail from "@/components/ContactEmail";
import { SITE } from "@/lib/site";
import { inApp } from "@/lib/in-app";
import { getT } from "@/i18n/server";
import { fill, rich } from "@/i18n/format";
import LanguagePicker from "@/components/LanguagePicker";
import { CAN_PICK_LANGUAGE } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getT()).common.info, alternates: { canonical: "/info" } };
}

// Info (it used to be called Help), for when someone wants it, rather than a tour they have to sit
// through first. Short questions in the words people would use, short
// answers, nothing to log in for. Written to be read easily by anyone,
// including people reading in a second language or with a translate
// button.

type QA = { id: string; q: string; a: React.ReactNode };

const b = (text: string) => <strong>{text}</strong>;

export default async function InfoPage() {
  const [user, t, app] = await Promise.all([getCurrentUser(), getT(), inApp()]);
  const canEmail = canSendEmail();
  const i = t.info;

  // Few questions, short answers: the ones people actually ask.
  const questions: QA[] = [
    {
      id: "what",
      q: fill(i.whatQ, { name: SITE.name }),
      a: <p>{i.whatA}</p>,
    },
    {
      id: "who",
      q: i.whoQ,
      a: <p>{fill(i.whoA, { ages: SITE.recommendedAges, min: SITE.minimumAge })}</p>,
    },
    {
      id: "join",
      q: i.joinQ,
      a: (
        <ol className="list-decimal space-y-1 pl-5">
          <li>{rich(i.join1, { map: b(t.common.map) })}</li>
          <li>{rich(i.join2, { button: b(t.meetup.imIn) })}</li>
          <li>{rich(i.join3, { button: b(t.meetup.cantGo) })}</li>
        </ol>
      ),
    },
    {
      id: "post",
      q: i.postQ,
      a: <p>{rich(i.postA, { post: b(t.common.post) })}</p>,
    },
    {
      id: "photo",
      q: i.photoQ,
      a: <p>{i.photoA}</p>,
    },
    {
      id: "safe",
      q: i.safeQ,
      a: (
        <ul className="list-disc space-y-1 pl-5">
          <li>{i.safe1}</li>
          <li>{i.safe2}</li>
          <li>{i.safe3}</li>
        </ul>
      ),
    },
    {
      id: "report",
      q: i.reportQ,
      a: <p>{rich(i.reportA, { button: b(`🚩 ${t.meetup.reportOrBlock}`), me: b(t.common.me) })}</p>,
    },
    {
      id: "forgot",
      q: i.forgotQ,
      a: canEmail ? <p>{rich(i.forgotA, { link: b(t.signIn.forgotPassword) })}</p> : <p>{t.signIn.askAdmin}</p>,
    },
    {
      id: "delete",
      q: t.me.deleteAccount,
      a: (
        <p>
          {rich(i.tapPath, {
            path: (
              <>
                {b(t.common.me)} → {b(t.me.settings)} → {b(t.me.deleteAccount)}
              </>
            ),
          })}
        </p>
      ),
    },
    // Website only: the app is already on the phone.
    ...(app
      ? []
      : [
          {
            id: "home-screen",
            q: i.homeQ,
            a: (
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>iPhone:</strong> {t.install.share} → {b(t.install.addIphone)}
                </li>
                <li>
                  <strong>Android:</strong> ⋮ → {b(t.install.addAndroid)}
                </li>
              </ul>
            ),
          },
        ]),
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold text-white drop-shadow">{t.common.info}</h1>
      {CAN_PICK_LANGUAGE && (
        <div className="mt-4 flex justify-start">
          <LanguagePicker onDark />
        </div>
      )}

      {/* A little nerve for the first time: walking up to strangers is
          the hard bit, and the reason most people never go. */}
      <figure className="card mt-6 !p-5">
        <blockquote className="text-xl font-semibold leading-snug text-slate-900">
          &ldquo;{i.quote}&rdquo;
        </blockquote>
      </figure>

      {/* One membership, the same for everyone: nobody pays to be seen
          first or treated better. */}
      <section id="diamond" className="card mt-6 scroll-mt-20" aria-labelledby="diamond-heading">
        <h2 id="diamond-heading" className="text-xl font-bold text-slate-900">
          <span aria-hidden="true">💎</span> {i.diamondHeading}
        </h2>
        <p className="mt-2 text-base text-slate-800">{i.diamondText}</p>
      </section>

      {/* The rules, up top and always open: short enough to read in ten
          seconds, and the thing everyone agrees to when they join. */}
      <section id="rules" className="card mt-6 scroll-mt-20" aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="text-xl font-bold text-slate-900">
          {i.rules}
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-base text-slate-800">
          <li>{fill(i.rule1, { min: SITE.minimumAge })}</li>
          <li>{i.rule2}</li>
          <li>{i.rule3}</li>
          <li>{rich(i.rule4, { button: b(t.meetup.cantGo) })}</li>
          <li>{i.rule5}</li>
          <li>{i.rule6}</li>
        </ol>
        <p className="mt-3 text-base font-semibold text-slate-900">🚩 {i.threeReports}</p>
        <p className="mt-3 text-base font-semibold text-slate-900">🚫 {i.instantBan}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-base text-slate-800">
          {i.banFor.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-slate-600">
          {rich(i.fullTerms, {
            terms: (
              <Link href="/terms" className="font-semibold text-brand-700 underline">
                {t.common.terms}
              </Link>
            ),
          })}
        </p>
      </section>

      <p className="mb-3 mt-8 text-lg font-semibold text-white">{i.tapOne}</p>

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
          {i.contact}
        </h2>
        <p className="mt-2 text-base text-slate-700">{i.contactNote}</p>
        <ContactEmail className="mt-1 inline-block text-lg font-semibold text-brand-700 underline" />
        <p className="mt-3 text-sm text-slate-600">
          <Link href="/terms" className="underline">
            {t.common.terms}
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline">
            {t.common.privacy}
          </Link>
        </p>
      </section>

      <div className="card mt-6 text-center">
        <p className="text-lg font-semibold text-slate-900">{i.ready}</p>
        <Link href={user ? "/" : "/login"} className="btn-primary mt-3 min-h-12 px-8 text-lg">
          {user ? i.backToMap : t.map.joinFree}
        </Link>
      </div>
    </div>
  );
}
