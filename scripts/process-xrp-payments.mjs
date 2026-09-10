// Polls the XRP Ledger's public API for payments to our wallet, matches
// each one to a member via its destination tag, and extends that member's
// paidUntil date. Run on a schedule (see
// .github/workflows/process-xrp-payments.yml) — safe to re-run over the
// same ledger history any time, since XrpPayment.txHash is unique and
// already-processed transactions are skipped.
//
// Not tested against a live XRPL node from this sandbox (no outbound
// network access here) — written against the documented, long-stable
// account_tx API shape. Worth confirming with a small real test payment
// once this is deployed and running on schedule.
import { createClient } from "@libsql/client";

const RIPPLE_EPOCH_OFFSET = 946684800; // seconds between 1970-01-01 and 2000-01-01 (Ripple epoch)
const GBP_PER_MONTH = 1;

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;
const walletAddress = process.env.XRP_WALLET_ADDRESS;
if (!dbUrl || !dbToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}
if (!walletAddress) {
  console.error("Set XRP_WALLET_ADDRESS");
  process.exit(1);
}

const client = createClient({ url: dbUrl, authToken: dbToken });

async function getXrpGbpRate() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=gbp"
  );
  if (!res.ok) throw new Error(`CoinGecko request failed: ${res.status}`);
  const data = await res.json();
  const rate = data?.ripple?.gbp;
  if (!rate) throw new Error("CoinGecko response missing ripple.gbp");
  return rate;
}

async function fetchAccountTx(address) {
  const res = await fetch("https://xrplcluster.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "account_tx",
      params: [
        {
          account: address,
          ledger_index_min: -1,
          ledger_index_max: -1,
          limit: 100,
          forward: false,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`XRPL account_tx request failed: ${res.status}`);
  const data = await res.json();
  if (data.result?.status !== "success") {
    throw new Error(`XRPL account_tx error: ${JSON.stringify(data.result)}`);
  }
  return data.result.transactions ?? [];
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

const rate = await getXrpGbpRate();
console.log(`Current XRP/GBP rate: ${rate}`);

const transactions = await fetchAccountTx(walletAddress);
console.log(`Fetched ${transactions.length} recent transaction(s) for ${walletAddress}`);

let credited = 0;
let skipped = 0;

for (const entry of transactions) {
  // Different rippled versions have nested the transaction body under `tx`
  // vs `tx_json` at various points; check both rather than assume one.
  const tx = entry.tx ?? entry.tx_json;
  const meta = entry.meta;
  if (!tx || !meta) continue;

  if (tx.TransactionType !== "Payment") continue;
  if (tx.Destination !== walletAddress) continue;
  if (meta.TransactionResult !== "tesSUCCESS") continue;
  if (typeof tx.Amount !== "string") continue; // an object here means an issued currency, not native XRP
  if (tx.DestinationTag == null) {
    console.log(`Skipping ${tx.hash}: no destination tag, can't attribute it to a member.`);
    skipped++;
    continue;
  }

  const existing = await client.execute({
    sql: 'SELECT "id" FROM "XrpPayment" WHERE "txHash" = ?',
    args: [tx.hash],
  });
  if (existing.rows.length > 0) continue; // already processed on a previous run

  const userResult = await client.execute({
    sql: 'SELECT "id", "paidUntil" FROM "User" WHERE "xrpDestinationTag" = ?',
    args: [tx.DestinationTag],
  });
  const user = userResult.rows[0];
  if (!user) {
    console.log(
      `Skipping ${tx.hash}: destination tag ${tx.DestinationTag} doesn't match any member.`
    );
    skipped++;
    continue;
  }

  const amountXrp = Number(tx.Amount) / 1_000_000; // Amount is in drops
  const amountGbp = amountXrp * rate;
  const monthsCredited = Math.round(amountGbp / GBP_PER_MONTH);
  const ledgerCloseAt = new Date((tx.date + RIPPLE_EPOCH_OFFSET) * 1000).toISOString();

  const currentPaidUntil = user.paidUntil ? new Date(user.paidUntil) : null;
  const base = currentPaidUntil && currentPaidUntil > new Date() ? currentPaidUntil : new Date();
  const newPaidUntil = monthsCredited > 0 ? addMonths(base, monthsCredited).toISOString() : null;

  await client.execute({
    sql: `INSERT INTO "XrpPayment"
        ("id", "txHash", "userId", "amountXrp", "amountGbp", "monthsCredited", "ledgerCloseAt")
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), tx.hash, user.id, amountXrp, amountGbp, monthsCredited, ledgerCloseAt],
  });

  if (newPaidUntil) {
    await client.execute({
      sql: 'UPDATE "User" SET "paidUntil" = ? WHERE "id" = ?',
      args: [newPaidUntil, user.id],
    });
  }

  console.log(
    `Credited ${tx.hash}: ${amountXrp} XRP (~£${amountGbp.toFixed(2)}) -> ${monthsCredited} month(s) for user ${user.id}${newPaidUntil ? `, paidUntil now ${newPaidUntil}` : " (too small to credit a month)"}`
  );
  credited++;
}

console.log(`Done. Credited ${credited} new payment(s), skipped ${skipped} unattributable transaction(s).`);
client.close();
