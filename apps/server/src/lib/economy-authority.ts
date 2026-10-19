import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export type CurrencyType = "NC" | "FS" | "AC" | "FR" | "NF_ETH" | "NF_BTC" | "FORGE";

type BalanceChange = {
  userId: string;
  amount: bigint;
  currencyType: CurrencyType;
  reason: string;
  referenceId?: string;
  metadata?: any;
  /** Ledger type; defaults to CREDIT / DEBIT from the sign of amount. */
  type?: string;
};

/**
 * Credits that don't count toward lifetimeEarnings: coins another player earned
 * (TRANSFER_IN) and money handed back (JACKPOT_REFUND).
 */
const NON_EARNING_CREDIT_TYPES = new Set(["TRANSFER_IN", "JACKPOT_REFUND"]);

/** Thrown when a debit would take an account below zero. Routes turn this into a 400. */
export class InsufficientBalanceError extends Error {
  constructor(currencyType: CurrencyType, readonly available: bigint) {
    super(`Not enough ${currencyType}. You have ${available}.`);
    this.name = "InsufficientBalanceError";
  }
}

/** Balances stop here (1 quadrillion), well past anything the game can pay out. */
const MAX_BALANCE = 1_000_000_000_000_000n;

function isTransientConflict(error: any) {
  return error?.code === "P2034" || error?.message?.includes("deadlock") || error?.message?.includes("conflict");
}

export class EconomyAuthority {
  /**
   * Applies one balance change inside an existing transaction: get-or-create the
   * account, guard against negative and runaway balances, update, and write the
   * ledger row. Callers that move coins between users run several of these in a
   * single transaction so either every leg lands or none does.
   */
  static async applyChange(tx: Prisma.TransactionClient, params: BalanceChange, retryCount = 0) {
    // 1. Get or create the account
    let account = await tx.economyAccount.findUnique({
      where: {
        userId_currencyType: {
          userId: params.userId,
          currencyType: params.currencyType,
        },
      },
    });

    if (!account) {
      account = await tx.economyAccount.create({
        data: {
          userId: params.userId,
          currencyType: params.currencyType,
          balance: 0n,
          frozenBalance: 0n,
          lifetimeEarnings: 0n,
        },
      });
    }

    // 2-4. Change the balance in ONE conditional write: the database adds the amount only if the
    // result stays between zero and the cap. It used to write back a balance worked out from the
    // row read above, so two spends racing each other could both pass the check on the same old
    // balance and overdraw it (or one could overwrite the other's change). Now the guard and the
    // change are the same statement, whatever the transaction's isolation level.
    const amount = params.amount;
    const earns = amount > 0n && !NON_EARNING_CREDIT_TYPES.has(params.type ?? "");
    const changed = await tx.economyAccount.updateMany({
      where: {
        id: account.id,
        balance: amount < 0n ? { gte: -amount } : { lte: MAX_BALANCE - amount },
      },
      data: {
        balance: { increment: amount },
        ...(earns ? { lifetimeEarnings: { increment: amount } } : {}),
        lastSyncAt: new Date(),
      },
    });
    const updatedAccount = await tx.economyAccount.findUniqueOrThrow({ where: { id: account.id } });
    if (changed.count !== 1) {
      if (amount < 0n) throw new InsufficientBalanceError(params.currencyType, updatedAccount.balance);
      throw new Error(`Economy overflow safeguard triggered: Balance would exceed 1 quadrillion for user ${params.userId}.`);
    }
    const newBalance = updatedAccount.balance;
    const previousBalance = newBalance - amount;

    // 5. Log transaction
    await tx.economyTransaction.create({
      data: {
        userId: params.userId,
        accountId: account.id,
        amount: params.amount,
        type: params.type ?? (params.amount >= 0n ? "CREDIT" : "DEBIT"),
        reason: params.reason,
        referenceId: params.referenceId,
        balanceBefore: previousBalance,
        balanceAfter: newBalance,
        metadata: {
          ...(params.metadata || {}),
          preBalance: previousBalance.toString(),
          postBalance: newBalance.toString(),
          timestamp: new Date().toISOString(),
          retry: retryCount
        },
      },
    });

    // 6. Security Audit: Log high-value transactions
    if (params.amount > 10_000_000n || params.amount < -10_000_000n) {
      console.warn(`[AUDIT][ECONOMY] High-value transaction: User=${params.userId}, Amount=${params.amount}, Reason="${params.reason}", Ref=${params.referenceId || "none"}`);
    }

    return updatedAccount;
  }

  /**
   * Runs `work` in a serializable transaction, retrying deadlocks and write
   * conflicts with backoff. Use for anything that touches balances.
   */
  static async serializable<T>(work: (tx: Prisma.TransactionClient, retryCount: number) => Promise<T>, retryCount = 0): Promise<T> {
    try {
      return await prisma.$transaction((tx) => work(tx, retryCount), { isolationLevel: "Serializable" });
    } catch (error: any) {
      if (isTransientConflict(error) && retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 100 + Math.random() * 50;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.serializable(work, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Adjusts the balance of a user account atomically with retry logic.
   */
  static async adjustBalance(params: BalanceChange): Promise<any> {
    // 0. Input validation
    if (params.amount === 0n && params.reason !== "Account Initialization") {
      return this.getAccountStats(params.userId, params.currencyType).then(acc => acc!);
    }

    return this.serializable((tx, retryCount) => this.applyChange(tx, params, retryCount));
  }



  /**
   * Retrieves all economy accounts for a user.
   */
  static async getAllUserAccounts(userId: string) {
    return prisma.economyAccount.findMany({
      where: { userId },
      include: {
        transactions: {
          orderBy: { timestamp: "desc" },
          take: 5,
        },
      },
    });
  }

  /**
   * Retrieves current balance and stats for a user.
   */
  static async getAccountStats(userId: string, currencyType: CurrencyType = "NC") {
    const account = await prisma.economyAccount.findUnique({
      where: {
        userId_currencyType: {
          userId,
          currencyType,
        },
      },
      include: {
        transactions: {
          orderBy: { timestamp: "desc" },
          take: 5,
        },
      },
    });

    return account;
  }
}
