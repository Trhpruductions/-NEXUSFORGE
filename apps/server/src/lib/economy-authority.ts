import { prisma } from "./prisma.js";

export type CurrencyType = "NC" | "FS" | "AC" | "FR" | "NF_ETH" | "NF_BTC" | "FORGE";

export class EconomyAuthority {
  /**
   * Adjusts the balance of a user account atomically with retry logic.
   */
  static async adjustBalance(params: {
    userId: string;
    amount: bigint;
    currencyType: CurrencyType;
    reason: string;
    referenceId?: string;
    metadata?: any;
  }, retryCount = 0): Promise<any> {
    // 0. Input validation
    if (params.amount === 0n && params.reason !== "Account Initialization") {
      return this.getAccountStats(params.userId, params.currencyType).then(acc => acc!);
    }

    try {
      return await prisma.$transaction(async (tx) => {
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

        const newBalance = account.balance + params.amount;

        // 2. Prevent negative balance
        if (newBalance < 0n) {
          throw new Error(`Insufficient ${params.currencyType} balance for user ${params.userId}. Requested change: ${params.amount}, Current: ${account.balance}`);
        }

        // 3. Prevent overflow (safety guard at 1 quadrillion)
        if (newBalance > 1_000_000_000_000_000n) {
          throw new Error(`Economy overflow safeguard triggered: Balance would exceed 1 quadrillion for user ${params.userId}.`);
        }

        // 4. Update balance
        const updatedAccount = await tx.economyAccount.update({
          where: { id: account.id },
          data: {
            balance: newBalance,
            lifetimeEarnings: params.amount > 0n ? account.lifetimeEarnings + params.amount : account.lifetimeEarnings,
            lastSyncAt: new Date(),
          },
        });

        // 5. Log transaction
        await tx.economyTransaction.create({
          data: {
            accountId: account.id,
            amount: params.amount,
            type: params.amount >= 0n ? "CREDIT" : "DEBIT",
            reason: params.reason,
            referenceId: params.referenceId,
            metadata: {
              ...(params.metadata || {}),
              preBalance: account.balance.toString(),
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
      }, {
        isolationLevel: "Serializable",
      });
    } catch (error: any) {
      // Retry transient failures (deadlocks, write conflicts)
      if (
        (error.code === 'P2034' || error.message?.includes('deadlock') || error.message?.includes('conflict')) && 
        retryCount < 5
      ) {
        const delay = Math.pow(2, retryCount) * 100 + Math.random() * 50;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.adjustBalance(params, retryCount + 1);
      }
      throw error;
    }
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

  /**
   * Updates state of a progressive jackpot.
   */
  static async incrementJackpot(slug: string, amount: bigint) {
    return prisma.progressiveJackpot.update({
      where: { slug },
      data: {
        currentValue: { increment: amount },
      },
    });
  }
}
