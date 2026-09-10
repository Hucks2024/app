import { redirect } from "next/navigation";
import { requireUser, isPaidUp } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { assignDestinationTag, estimateXrpForMonths, getXrpGbpRate } from "@/lib/xrp";
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
      <h1 className="text-2xl font-bold mb-2">Join Pacemates</h1>
      <p className="text-slate-600 mb-6">
        £1/month, paid in XRP. Send any amount of XRP worth roughly £1 per month you want to the
        address below, with your personal destination tag. Access unlocks automatically once the
        payment is confirmed, usually within a few minutes to a few hours.
      </p>

      {!walletAddress ? (
        <div className="card">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Membership sign-up isn&apos;t switched on yet, check back soon.
          </p>
        </div>
      ) : (
        <div className="card space-y-4">
          {lapsed && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
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
          <p className="text-xs text-amber-700">
            ⚠️ The destination tag is required. Without it we can&apos;t tell your payment apart
            from anyone else&apos;s, and it won&apos;t be credited automatically.
          </p>

          {rate ? (
            <p className="text-sm text-slate-600">
              At today&apos;s rate, that&apos;s roughly{" "}
              <strong>{estimateXrpForMonths(rate, 1).toFixed(2)} XRP</strong> for 1 month, or{" "}
              <strong>{estimateXrpForMonths(rate, 12).toFixed(2)} XRP</strong> for 12.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Live rate unavailable right now, roughly £1 worth of XRP per month you want.
            </p>
          )}
        </div>
      )}

      <div className="text-xs text-slate-400 text-center mt-4 flex items-center justify-center gap-1">
        <span>Signed in as {user.email}, not you?</span>
        <LogoutButton />
      </div>
    </div>
  );
}
