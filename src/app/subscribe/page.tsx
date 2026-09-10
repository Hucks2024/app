import { redirect } from "next/navigation";
import { requireUser, isPaidUp } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { assignDestinationTag, getXrpGbpRate, XRP_PER_MONTH } from "@/lib/xrp";
import CopyableField from "@/components/CopyableField";
import LogoutButton from "@/components/LogoutButton";

export default async function SubscribePage() {
  const user = await requireUser();

  // Nothing to do here if they're already covered.
  if (isPaidUp(user)) redirect("/verify");

  let tag = user.xrpDestinationTag;
  if (tag == null) {
    const prisma = await getPrisma();
    tag = await assignDestinationTag(prisma, user.id);
  }

  const walletAddress = process.env.XRP_WALLET_ADDRESS;
  const rate = walletAddress ? await getXrpGbpRate() : null;
  const lapsed = user.paidUntil != null; // had a paidUntil once, just not anymore

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold mb-2 text-white drop-shadow">Join Pacemates</h1>
      <p className="text-white/85 mb-6">
        {XRP_PER_MONTH} XRP a month, sent to the address below with your personal destination
        tag. Send it for as many months as you like at once, e.g. {XRP_PER_MONTH * 12} XRP covers
        a year. An admin checks the ledger and unlocks access once they see it, not instant, but
        usually not long.
      </p>

      {!walletAddress ? (
        <div className="card">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
            Membership sign-up isn&apos;t switched on yet, check back soon.
          </p>
        </div>
      ) : (
        <div className="card space-y-4">
          {lapsed && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
              Your membership has lapsed. Send another payment below to pick up where you left
              off.
            </p>
          )}

          <div>
            <p className="label">Send XRP to</p>
            <CopyableField value={walletAddress} />
          </div>
          <div>
            <p className="label">With destination tag</p>
            <CopyableField value={String(tag)} />
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠️ The destination tag is required. Without it we can&apos;t tell your payment apart
            from anyone else&apos;s, and it won&apos;t be credited automatically.
          </p>

          <p className="text-sm text-slate-600">
            <strong>
              {XRP_PER_MONTH} XRP = 1 month
            </strong>
            {rate && (
              <span className="text-slate-500"> (≈ £{(XRP_PER_MONTH * rate).toFixed(2)} today)</span>
            )}
            .
          </p>
        </div>
      )}

      <div className="text-xs text-white/70 text-center mt-4 flex items-center justify-center gap-1">
        <span>Signed in as {user.email}, not you?</span>
        <LogoutButton />
      </div>
    </div>
  );
}
