import { Prisma, type PrismaClient } from "@prisma/client";

const RIPPLE_EPOCH_OFFSET = 946684800; // seconds between 1970-01-01 and 2000-01-01 (Ripple epoch)

// Flat price: 1 XRP buys 1 month, full stop. No live rate involved in what
// someone actually owes, that only ever gets used for the informational
// "≈ £x today" line on /subscribe.
export const XRP_PER_MONTH = 1;

/** Live XRP/GBP rate via CoinGecko's free, keyless price endpoint, purely
 * for display ("that's about £x"). Returns null on any failure, callers
 * should show a fallback rather than block on this. */
export async function getXrpGbpRate(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=gbp",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { ripple?: { gbp?: number } };
    return data.ripple?.gbp ?? null;
  } catch {
    return null;
  }
}

function randomDestinationTag(): number {
  // Keeps it a readable 6-9 digit number rather than the full 32-bit
  // range XRPL technically allows for destination tags.
  return 100_000 + Math.floor(Math.random() * (999_999_999 - 100_000));
}

/** Assigns a unique XRPL destination tag to a user, retrying on the rare
 * random collision. Called lazily the first time a member reaches
 * /subscribe; the tag then stays fixed for the life of the account. */
export async function assignDestinationTag(
  prisma: PrismaClient,
  userId: string
): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const tag = randomDestinationTag();
    try {
      await prisma.user.update({ where: { id: userId }, data: { xrpDestinationTag: tag } });
      return tag;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue; // tag collision, try another
      }
      throw err;
    }
  }
  throw new Error("Could not assign a unique XRP destination tag after 10 attempts");
}

type XrplTx = {
  TransactionType?: string;
  Destination?: string;
  Amount?: unknown;
  DestinationTag?: number;
  hash?: string;
  date?: number;
};

async function fetchAccountTx(address: string): Promise<
  Array<{ tx?: XrplTx; tx_json?: XrplTx; meta?: { TransactionResult?: string } }>
> {
  const res = await fetch("https://xrplcluster.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "account_tx",
      params: [
        { account: address, ledger_index_min: -1, ledger_index_max: -1, limit: 100, forward: false },
      ],
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`XRPL account_tx request failed: ${res.status}`);
  const data = await res.json();
  if (data.result?.status !== "success") {
    throw new Error(`XRPL account_tx error: ${JSON.stringify(data.result)}`);
  }
  return data.result.transactions ?? [];
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export type XrpScanResult = {
  credited: number;
  skippedNoTag: number;
  skippedUnmatchedTag: number[];
  error?: string;
};

/** The same "check the ledger, credit matching members" logic as
 * scripts/process-xrp-payments.mjs (which runs on its own 15-minute
 * schedule via GitHub Actions), just via Prisma instead of a raw libsql
 * client, so it's callable directly from the app, e.g. an admin's
 * "Scan now" button, for an on-demand check instead of waiting for the
 * next scheduled run. */
export async function processXrpPayments(
  prisma: PrismaClient,
  walletAddress: string
): Promise<XrpScanResult> {
  const result: XrpScanResult = { credited: 0, skippedNoTag: 0, skippedUnmatchedTag: [] };

  // The GBP rate is purely informational (amountGbp on the record), a
  // failure there (getXrpGbpRate swallows its own errors and returns
  // null) doesn't block crediting, which only depends on the XRP amount.
  let rate: number | null;
  let transactions: Awaited<ReturnType<typeof fetchAccountTx>>;
  try {
    [rate, transactions] = await Promise.all([getXrpGbpRate(), fetchAccountTx(walletAddress)]);
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Failed to reach the XRP Ledger.";
    return result;
  }

  for (const entry of transactions) {
    const tx = entry.tx ?? entry.tx_json;
    const meta = entry.meta;
    if (!tx || !meta) continue;
    if (tx.TransactionType !== "Payment") continue;
    if (tx.Destination !== walletAddress) continue;
    if (meta.TransactionResult !== "tesSUCCESS") continue;
    if (typeof tx.Amount !== "string") continue; // an object here means an issued currency, not native XRP
    if (tx.DestinationTag == null || !tx.hash || tx.date == null) {
      result.skippedNoTag++;
      continue;
    }

    const existing = await prisma.xrpPayment.findUnique({ where: { txHash: tx.hash } });
    if (existing) continue; // already processed on a previous scan

    const user = await prisma.user.findUnique({ where: { xrpDestinationTag: tx.DestinationTag } });
    if (!user) {
      result.skippedUnmatchedTag.push(tx.DestinationTag);
      continue;
    }

    const amountXrp = Number(tx.Amount) / 1_000_000; // Amount is in drops
    const amountGbp = rate ? amountXrp * rate : 0; // 0 means "rate unavailable", not "worthless"
    // Floor, not round: a fixed 1 XRP = 1 month price means a partial XRP
    // over some whole number of months is a tip, not a rounding error in
    // the member's favor.
    const monthsCredited = Math.floor(amountXrp / XRP_PER_MONTH);
    const ledgerCloseAt = new Date((tx.date + RIPPLE_EPOCH_OFFSET) * 1000);

    const base = user.paidUntil && user.paidUntil > new Date() ? user.paidUntil : new Date();
    const newPaidUntil = monthsCredited > 0 ? addMonths(base, monthsCredited) : null;

    await prisma.xrpPayment.create({
      data: {
        txHash: tx.hash,
        userId: user.id,
        amountXrp,
        amountGbp,
        monthsCredited,
        ledgerCloseAt,
      },
    });
    if (newPaidUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { paidUntil: newPaidUntil } });
    }
    result.credited++;
  }

  return result;
}
