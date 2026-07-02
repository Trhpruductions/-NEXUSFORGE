import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { MiningAuthority, RIG_PRICING } from "../src/lib/mining-authority.js";
import { EconomyAuthority } from "../src/lib/economy-authority.js";
import { v4 as uuidv4 } from "uuid";

/**
 * MINING AUTHORITY TEST SUITE
 * 
 * Comprehensive tests for all mining operations:
 * - Rig creation with atomic balance deduction
 * - Yield calculation
 * - Harvesting (single and batch)
 * - Rig updates
 * - Rig decommissioning with refunds
 * - Edge cases and error conditions
 */

describe("MiningAuthority", () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    testUserId = uuidv4();
    await prisma.user.create({
      data: {
        id: testUserId,
        username: `test_user_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: "hashedpassword",
        birthdate: new Date("1990-01-01"),
      },
    });

    // Create economy account with starting balance
    await prisma.economyAccount.create({
      data: {
        userId: testUserId,
        currencyType: "NC",
        balance: 500000n, // 500k NC for testing
      },
    });

    console.log(`✓ Test user created: ${testUserId}`);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.miningRig.deleteMany({ where: { userId: testUserId } });
    await prisma.economyTransaction.deleteMany({ where: { userId: testUserId } });
    await prisma.economyAccount.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    console.log(`✓ Test user cleaned up`);
  });

  describe("createRig", () => {
    it("should create a BASIC rig and deduct cost from balance", async () => {
      const balanceBefore = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      const rig = await MiningAuthority.createRig({
        userId: testUserId,
        name: "Test Rig 1",
        tier: "BASIC",
      });

      expect(rig).toBeDefined();
      expect(rig.name).toBe("Test Rig 1");
      expect(rig.tier).toBe("BASIC");
      expect(rig.hashRate).toBe(RIG_PRICING.BASIC.hashRate);
      expect(rig.efficiency).toBe(RIG_PRICING.BASIC.efficiency);
      expect(rig.status).toBe("ACTIVE");

      const balanceAfter = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      expect(balanceAfter).toBe(balanceBefore - RIG_PRICING.BASIC.cost);
    });

    it("should create an ELITE rig with correct properties", async () => {
      const rig = await MiningAuthority.createRig({
        userId: testUserId,
        name: "Elite Machine",
        tier: "ELITE",
      });

      expect(rig.hashRate).toBe(RIG_PRICING.ELITE.hashRate);
      expect(rig.efficiency).toBe(RIG_PRICING.ELITE.efficiency);
    });

    it("should reject rig creation with insufficient balance", async () => {
      // Create a new user with low balance
      const lowBalanceUserId = uuidv4();
      await prisma.user.create({
        data: {
          id: lowBalanceUserId,
          username: `low_balance_${Date.now()}`,
          email: `low_${Date.now()}@example.com`,
          password: "hashedpassword",
          birthdate: new Date("1990-01-01"),
        },
      });

      await prisma.economyAccount.create({
        data: {
          userId: lowBalanceUserId,
          currencyType: "NC",
          balance: 1000n, // Only 1k NC
        },
      });

      await expect(
        MiningAuthority.createRig({
          userId: lowBalanceUserId,
          name: "Expensive Rig",
          tier: "ELITE",
        })
      ).rejects.toThrow("Insufficient balance");

      // Cleanup
      await prisma.user.delete({ where: { id: lowBalanceUserId } });
    });

    it("should reject invalid rig tier", async () => {
      await expect(
        MiningAuthority.createRig({
          userId: testUserId,
          name: "Invalid Rig",
          tier: "INVALID_TIER",
        })
      ).rejects.toThrow("Invalid rig tier");
    });

    it("should create transaction log entry for rig purchase", async () => {
      const transactionsBefore = await prisma.economyTransaction.count({
        where: { userId: testUserId },
      });

      await MiningAuthority.createRig({
        userId: testUserId,
        name: "Transaction Test Rig",
        tier: "STANDARD",
      });

      const transactionsAfter = await prisma.economyTransaction.count({
        where: { userId: testUserId },
      });

      expect(transactionsAfter).toBe(transactionsBefore + 1);

      const lastTransaction = await prisma.economyTransaction.findFirst({
        where: { userId: testUserId },
        orderBy: { createdAt: "desc" },
      });

      expect(lastTransaction?.type).toBe("MINING_RIG_PURCHASE");
      expect(lastTransaction?.amount).toBe(RIG_PRICING.STANDARD.cost);
    });
  });

  describe("updateRig", () => {
    let testRigId: string;

    beforeEach(async () => {
      const rig = await MiningAuthority.createRig({
        userId: testUserId,
        name: "Update Test Rig",
        tier: "BASIC",
      });
      testRigId = rig.id;
    });

    it("should update rig name", async () => {
      const updated = await MiningAuthority.updateRig({
        rigId: testRigId,
        userId: testUserId,
        updates: { name: "Renamed Rig" },
      });

      expect(updated.name).toBe("Renamed Rig");
    });

    it("should update rig status", async () => {
      const updated = await MiningAuthority.updateRig({
        rigId: testRigId,
        userId: testUserId,
        updates: { status: "PAUSED" },
      });

      expect(updated.status).toBe("PAUSED");
    });

    it("should reject invalid status", async () => {
      await expect(
        MiningAuthority.updateRig({
          rigId: testRigId,
          userId: testUserId,
          updates: { status: "INVALID_STATUS" },
        })
      ).rejects.toThrow("Invalid status");
    });

    it("should prevent unauthorized updates", async () => {
      const otherUserId = uuidv4();
      await expect(
        MiningAuthority.updateRig({
          rigId: testRigId,
          userId: otherUserId,
          updates: { name: "Hacked Name" },
        })
      ).rejects.toThrow("access denied");
    });
  });

  describe("calculatePendingYield", () => {
    it("should calculate zero yield for fresh rig", async () => {
      const rig = await prisma.miningRig.create({
        data: {
          userId: testUserId,
          name: "Fresh Rig",
          hashRate: 10,
          efficiency: 0.85,
          status: "ACTIVE",
          lastHarvestAt: new Date(),
        },
      });

      const yield_amount = MiningAuthority.calculatePendingYield(rig);
      expect(yield_amount).toBe(0n);
    });

    it("should calculate yield based on time elapsed", async () => {
      const oneHourAgo = new Date(Date.now() - 3600000); // 1 hour ago
      const rig = {
        hashRate: 10,
        efficiency: 0.85,
        lastHarvestAt: oneHourAgo,
      };

      const yield_amount = MiningAuthority.calculatePendingYield(rig);
      const expected = BigInt(Math.floor(10 * 1 * 0.85)); // hashRate * hours * efficiency
      expect(yield_amount).toBe(expected);
    });

    it("should handle multiple hours of yield accumulation", async () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600000); // 7 days ago
      const rig = {
        hashRate: 100,
        efficiency: 0.9,
        lastHarvestAt: oneWeekAgo,
      };

      const yield_amount = MiningAuthority.calculatePendingYield(rig);
      const expected = BigInt(Math.floor(100 * 168 * 0.9)); // 100 hashRate * 168 hours * 0.9 efficiency
      expect(yield_amount).toBe(expected);
    });
  });

  describe("harvestAll", () => {
    it("should harvest multiple rigs in atomic transaction", async () => {
      // Create 3 rigs
      const rigs = [];
      for (let i = 0; i < 3; i++) {
        const rig = await MiningAuthority.createRig({
          userId: testUserId,
          name: `Harvest Rig ${i}`,
          tier: "BASIC",
        });
        rigs.push(rig);
      }

      // Set harvest times to 1 hour ago
      const oneHourAgo = new Date(Date.now() - 3600000);
      for (const rig of rigs) {
        await prisma.miningRig.update({
          where: { id: rig.id },
          data: { lastHarvestAt: oneHourAgo },
        });
      }

      const balanceBefore = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      const totalHarvested = await MiningAuthority.harvestAll(testUserId);

      expect(totalHarvested).toBeGreaterThan(0n);

      const balanceAfter = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      expect(balanceAfter).toBe(balanceBefore + totalHarvested);
    });

    it("should not harvest PAUSED rigs", async () => {
      const rig = await MiningAuthority.createRig({
        userId: testUserId,
        name: "Paused Rig",
        tier: "BASIC",
      });

      // Pause the rig
      await MiningAuthority.updateRig({
        rigId: rig.id,
        userId: testUserId,
        updates: { status: "PAUSED" },
      });

      // Set harvest time
      const oneHourAgo = new Date(Date.now() - 3600000);
      await prisma.miningRig.update({
        where: { id: rig.id },
        data: { lastHarvestAt: oneHourAgo },
      });

      const balanceBefore = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      await MiningAuthority.harvestAll(testUserId);

      const balanceAfter = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      // Balance should not change
      expect(balanceAfter).toBe(balanceBefore);
    });
  });

  describe("decommissionRig", () => {
    it("should refund 50% of rig cost on decommission", async () => {
      const rig = await MiningAuthority.createRig({
        userId: testUserId,
        name: "Decommission Test",
        tier: "STANDARD",
      });

      const balanceBefore = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      const result = await MiningAuthority.decommissionRig({
        rigId: rig.id,
        userId: testUserId,
      });

      const expectedRefund = RIG_PRICING.STANDARD.cost / 2n;
      expect(BigInt(result.refundAmount)).toBe(expectedRefund);

      const balanceAfter = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      expect(balanceAfter).toBe(balanceBefore + expectedRefund);

      // Verify rig is deleted
      const deletedRig = await prisma.miningRig.findUnique({
        where: { id: rig.id },
      });
      expect(deletedRig).toBeNull();
    });

    it("should harvest pending yield before decommission", async () => {
      const rig = await MiningAuthority.createRig({
        userId: testUserId,
        name: "Decommission with Yield",
        tier: "BASIC",
      });

      // Set harvest time to 1 hour ago
      const oneHourAgo = new Date(Date.now() - 3600000);
      await prisma.miningRig.update({
        where: { id: rig.id },
        data: { lastHarvestAt: oneHourAgo },
      });

      const balanceBefore = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      const result = await MiningAuthority.decommissionRig({
        rigId: rig.id,
        userId: testUserId,
      });

      const balanceAfter = (await prisma.economyAccount.findUnique({
        where: {
          userId_currencyType: { userId: testUserId, currencyType: "NC" },
        },
      }))?.balance!;

      const expectedRefund = RIG_PRICING.BASIC.cost / 2n;
      const expectedYield = BigInt(result.pendingYield);
      const expectedBalance = balanceBefore + expectedRefund + expectedYield;

      expect(balanceAfter).toBe(expectedBalance);
    });

    it("should prevent decommissioning another user's rig", async () => {
      const rig = await MiningAuthority.createRig({
        userId: testUserId,
        name: "Protected Rig",
        tier: "BASIC",
      });

      const otherUserId = uuidv4();

      await expect(
        MiningAuthority.decommissionRig({
          rigId: rig.id,
          userId: otherUserId,
        })
      ).rejects.toThrow("access denied");
    });

    it("should create refund transaction log entry", async () => {
      const rig = await MiningAuthority.createRig({
        userId: testUserId,
        name: "Transaction Log Test",
        tier: "BASIC",
      });

      const transactionsBefore = await prisma.economyTransaction.count({
        where: {
          userId: testUserId,
          type: "MINING_RIG_PURCHASE",
        },
      });

      await MiningAuthority.decommissionRig({
        rigId: rig.id,
        userId: testUserId,
      });

      const refundTransaction = await prisma.economyTransaction.findFirst({
        where: {
          userId: testUserId,
          type: "MINING_RIG_REFUND",
        },
        orderBy: { createdAt: "desc" },
      });

      expect(refundTransaction).toBeDefined();
      expect(refundTransaction?.amount).toBe(RIG_PRICING.BASIC.cost / 2n);
    });
  });

  describe("getMiningStats", () => {
    it("should aggregate statistics for all user rigs", async () => {
      const rigCount = 2;
      for (let i = 0; i < rigCount; i++) {
        await MiningAuthority.createRig({
          userId: testUserId,
          name: `Stats Rig ${i}`,
          tier: i === 0 ? "BASIC" : "STANDARD",
        });
      }

      const stats = await MiningAuthority.getMiningStats(testUserId);

      expect(stats.rigCount).toBeGreaterThanOrEqual(rigCount);
      expect(stats.activeRigs).toBeGreaterThanOrEqual(rigCount);
      expect(stats.totalHashRate).toBeGreaterThan(0);
      expect(stats.avgEfficiency).toBeGreaterThan(0);
      expect(stats.avgEfficiency).toBeLessThanOrEqual(1);
    });

    it("should calculate estimated hourly income", async () => {
      const stats = await MiningAuthority.getMiningStats(testUserId);
      expect(stats.estimatedHourlyIncome).toBeDefined();
      expect(typeof stats.estimatedHourlyIncome).toBe("string");
      expect(BigInt(stats.estimatedHourlyIncome)).toBeGreaterThanOrEqual(0n);
    });
  });

  describe("validateRigTier", () => {
    it("should validate known tiers", () => {
      expect(MiningAuthority.validateRigTier("BASIC")).toBeDefined();
      expect(MiningAuthority.validateRigTier("STANDARD")).toBeDefined();
      expect(MiningAuthority.validateRigTier("ADVANCED")).toBeDefined();
      expect(MiningAuthority.validateRigTier("ELITE")).toBeDefined();
    });

    it("should reject unknown tiers", () => {
      expect(MiningAuthority.validateRigTier("INVALID")).toBeNull();
      expect(MiningAuthority.validateRigTier("SUPER_ELITE")).toBeNull();
    });
  });
});
