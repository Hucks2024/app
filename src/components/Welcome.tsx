import { getPrisma } from "@/lib/db";
import { enabledProviders } from "@/lib/oauth";
import { liveMeetup } from "@/lib/meetups";
import { canSendEmail } from "@/lib/email";
import Logo from "@/components/Logo";
import { SITE } from "@/lib/site";
import SignIn from "@/components/SignIn";

/** How many meetups are coming up, for the live pill. A real count, never
 * a padded one: it's the first number anyone sees here, and the same
 * number the map underneath shows, so the two can't disagree. */
export async function meetupsComingUp(): Promise<number> {
  const prisma = await getPrisma();
  return prisma.runActivity.count({ where: { startsAt: { gte: new Date() }, ...liveMeetup } });
}

/** The front door: who we are, what this is, and one big button.
 *
 * Laid out like the welcome screens people already know from travel apps
 * (an icon, a hello, a live number, a button) so there's nothing to work
 * out before getting in. */
export default async function Welcome({
  startWithEmail = false,
  error,
  next = "/",
}: {
  startWithEmail?: boolean;
  error?: string | null;
  // Where to land after signing in (see safeNext).
  next?: string;
}) {
  const count = await meetupsComingUp();

  return (
    <section className="mx-auto max-w-md px-4 pt-8 pb-6 text-center text-white">
      <div className="app-tile mx-auto">
        <Logo variant="white" size={62} />
      </div>

      {/* Two even lines on a phone, so "mate" never sits alone. */}
      <h1 className="font-wordmark mt-6 text-balance text-[clamp(24px,7.4vw,34px)] font-bold leading-tight">
        {SITE.tagline}
      </h1>
      <p className="font-wordmark mt-1 text-lg font-semibold text-white">
        your guide to the galaxy
      </p>
      <p className="mt-3 text-xl font-semibold leading-snug text-white">
        Meet people like you.
      </p>

      {count > 0 && (
        <p className="live-pill mt-5">
          <span className="live-dot" aria-hidden="true" />
          <span>
            <strong className="text-amber-200">{count}</strong>{" "}
            {count === 1 ? "meetup" : "meetups"} coming up
          </span>
          <span aria-hidden="true">🌍</span>
        </p>
      )}

      <div className="mx-auto mt-7 max-w-sm text-left">
        <SignIn
          providers={enabledProviders()}
          canEmail={canSendEmail()}
          startWithEmail={startWithEmail}
          error={error}
          next={next}
        />
      </div>

      <p className="mt-4 text-sm text-white">Free. No invite needed.</p>
    </section>
  );
}
