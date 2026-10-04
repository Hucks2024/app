import { getPrisma } from "@/lib/db";
import { enabledProviders } from "@/lib/oauth";
import { hostIsActive } from "@/lib/moderation";
import Logo from "@/components/Logo";
import SignIn from "@/components/SignIn";

/** How many meetups are coming up, for the live pill. A real count, never
 * a padded one: it's the first number anyone sees here, and the same
 * number the map underneath shows, so the two can't disagree. */
export async function meetupsComingUp(): Promise<number> {
  const prisma = await getPrisma();
  return prisma.runActivity.count({ where: { startsAt: { gte: new Date() }, ...hostIsActive } });
}

/** The front door: who we are, what this is, and one big button.
 *
 * Laid out like the welcome screens people already know from travel apps
 * (an icon, a hello, a live number, a button) so there's nothing to work
 * out before getting in. */
export default async function Welcome({
  startWithEmail = false,
  error,
}: {
  startWithEmail?: boolean;
  error?: string | null;
}) {
  const count = await meetupsComingUp();

  return (
    <section className="mx-auto max-w-md px-4 pt-8 pb-6 text-center text-white">
      <div className="app-tile mx-auto">
        <Logo variant="white" size={62} />
      </div>

      {/* Sized to the screen so it stays on one line, the way a welcome
          screen's hello should, rather than breaking after "to". */}
      <h1 className="font-wordmark mt-6 text-[clamp(22px,7.4vw,34px)] font-bold leading-tight lowercase">
        welcome to packmates
      </h1>
      <p className="font-wordmark mt-1 text-lg font-semibold text-white/90">
        a backpacker&apos;s guide to the galaxy
      </p>
      <p className="mt-3 text-[15px] leading-snug text-white/85">
        Real meetups with real people. Find one on the map, turn up, make friends.
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
        <SignIn providers={enabledProviders()} startWithEmail={startWithEmail} error={error} />
      </div>

      <p className="mt-4 text-xs text-white/75">Free for everyone. No invite needed.</p>
    </section>
  );
}
