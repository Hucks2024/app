import { Prisma, type PrismaClient } from "@prisma/client";

export const GBP_PER_MONTH = 1;

/** Live XRP/GBP rate via CoinGecko's free, keyless price endpoint. Returns
 * null on any failure, callers should show a fallback rather than block
 * on this, it's a convenience estimate, not something payments depend on
 * (the poller fetches its own rate at credit time). */
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

export function estimateXrpForMonths(rate: number, months: number): number {
  return (GBP_PER_MONTH * months) / rate;
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
