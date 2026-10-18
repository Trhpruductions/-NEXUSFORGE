import { prisma } from "../prisma.js";
import type { AppleConfig } from "./apple.js";
import { appleConfig } from "./config.js";
import { applySignedAppleTransaction, fetchAppleSubscriptionState } from "./apple-notifications.js";
import { setStorePurchaseStatus } from "./lifecycle.js";

// Notifications can be late or lost. Once a subscription is past its expiry date (plus a day's grace), the sweep asks
// the store where it stands, and moves the record to match. Without this, a lost notification would leave premium on.

const EVERY_MS = 15 * 60 * 1000;
const GRACE_MS = 24 * 60 * 60 * 1000;
const BATCH = 200;

type FetchLike = typeof fetch;

export async function runStoreBillingSweep(
  input: { now?: Date; fetchImpl?: FetchLike; appleConfig?: AppleConfig | null } = {},
): Promise<{ checked: number; expired: number; renewed: number }> {
  const now = input.now ?? new Date();
  const config = input.appleConfig !== undefined ? input.appleConfig : appleConfig();
  const lapsed = await prisma.storePurchase.findMany({
    where: { status: "ACTIVE", tier: { not: null }, expiresAt: { lt: new Date(now.getTime() - GRACE_MS) } },
    select: { provider: true, transactionId: true, originalTransactionId: true },
    orderBy: { expiresAt: "asc" },
    take: BATCH,
  });

  const result = { checked: lapsed.length, expired: 0, renewed: 0 };
  for (const row of lapsed) {
    try {
      if (row.provider === "APPLE" && config && row.originalTransactionId) {
        const state = await fetchAppleSubscriptionState({ config, originalTransactionId: row.originalTransactionId, now, fetchImpl: input.fetchImpl });
        if (state.state === "ACTIVE") {
          // Apple has a newer paid period. Renew it, unless it is this same transaction (a clock difference).
          if (state.transactionId === row.transactionId) continue;
          await applySignedAppleTransaction({ signedTransactionInfo: state.signedTransactionInfo, config, now });
          result.renewed += 1;
        }
        const status = state.state === "REVOKED" ? "REVOKED" : "EXPIRED";
        await setStorePurchaseStatus({ provider: "APPLE", transactionId: row.transactionId, status, now });
      } else {
        await setStorePurchaseStatus({ provider: row.provider as "APPLE" | "GOOGLE", transactionId: row.transactionId, status: "EXPIRED", now });
      }
      result.expired += 1;
    } catch (error) {
      console.error("[store-billing] sweep failed for one purchase:", error instanceof Error ? error.message : error);
    }
  }
  return result;
}

let timer: NodeJS.Timeout | null = null;

export function startStoreBillingSweep() {
  if (timer) return;
  const run = () => {
    runStoreBillingSweep()
      .then((result) => {
        if (result.checked > 0) console.log("[store-billing] sweep", result);
      })
      .catch((error: unknown) => console.error("[store-billing] sweep failed:", error instanceof Error ? error.message : error));
  };
  setTimeout(run, 90_000).unref();
  timer = setInterval(run, EVERY_MS);
  timer.unref();
}
