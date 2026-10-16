import "./helpers/env.js";
import "./helpers/stripe-test-env.js";
import { after, describe, it, before as beforeAll, after as afterAll } from "node:test";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { expect } from "./helpers/expect.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/lib/jwt.js";
import { getFinanceTotals, getRecurringRevenue, resolvePeriod } from "../src/lib/finance-metrics.js";

const { ownerRouter } = await import("../src/routes/owner.routes.js");

const testRun = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdExpenseIds: string[] = [];
const createdPaymentIds: string[] = [];
const createdSubscriptionIds: string[] = [];

let server: Server;
let baseUrl = "";

async function makeUser(label: string, appRole: "USER" | "ADMIN" | "OWNER") {
  const id = randomUUID();
  createdUserIds.push(id);
  await prisma.user.create({
    data: {
      id,
      username: `oc_${label}_${testRun}`,
      email: `oc_${label}_${testRun}@example.test`,
      password: "not-used",
      birthdate: new Date("1990-01-01"),
      appRole,
    },
  });
  const token = signAccessToken({ sub: id, username: `oc_${label}_${testRun}`, email: `oc_${label}_${testRun}@example.test`, appRole, jti: randomUUID() });
  return { id, token };
}

async function api(path: string, options: { method?: string; token?: string; body?: unknown } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

let owner: { id: string; token: string };
let admin: { id: string; token: string };
let member: { id: string; token: string };

// File-level cleanup, so fixtures from every describe block are removed, including the finance block.
after(async () => {
  await prisma.auditLog.deleteMany({ where: { resourceType: "Expense", resourceId: { in: createdExpenseIds } } });
  await prisma.expense.deleteMany({ where: { id: { in: createdExpenseIds } } });
  await prisma.paymentTransaction.deleteMany({ where: { id: { in: createdPaymentIds } } });
  await prisma.billingSubscription.deleteMany({ where: { id: { in: createdSubscriptionIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("owner console API", () => {
  beforeAll(async () => {
    owner = await makeUser("owner", "OWNER");
    admin = await makeUser("admin", "ADMIN");
    member = await makeUser("member", "USER");

    const app = express();
    app.use(express.json());
    app.use("/api/owner", ownerRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/owner`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("rejects anonymous, ADMIN, and ordinary member requests on every owner endpoint", async () => {
    for (const path of ["/overview", "/services", "/finance/summary", "/finance/transactions", "/finance/expenses", "/memberships", "/users", "/audit"]) {
      expect((await api(path)).status).toBe(401);
      expect((await api(path, { token: admin.token })).status).toBe(403);
      expect((await api(path, { token: member.token })).status).toBe(403);
    }
  });

  it("serves service checks with honest statuses, including the database probe", async () => {
    const { status, body } = await api("/services", { token: owner.token });
    expect(status).toBe(200);
    const database = body.services.find((service: { id: string }) => service.id === "database");
    expect(database.status).toBe("Online");
    expect(body.services.find((service: { id: string }) => service.id === "api").status).toBe("Online");
    // The test environment has a Stripe key but no webhook secret, so payments must not read as Online.
    const payments = body.services.find((service: { id: string }) => service.id === "payments");
    expect(payments.status).toBe("Degraded");
    expect(payments.detail.includes("Webhook secret missing")).toBe(true);
    expect(typeof body.host.loadAverage[0]).toBe("number");
  });

  it("records expense create, update, and delete in the audit log with changed fields", async () => {
    const created = await api("/finance/expenses", {
      method: "POST",
      token: owner.token,
      body: { category: "HOSTING", description: `test host ${testRun}`, amountCents: 5000, incurredOn: "2097-03-10T00:00:00.000Z", recurring: true },
    });
    expect(created.status).toBe(201);
    const expenseId = created.body.expense.id as string;
    createdExpenseIds.push(expenseId);

    const updated = await api(`/finance/expenses/${expenseId}`, { method: "PATCH", token: owner.token, body: { amountCents: 7500 } });
    expect(updated.status).toBe(200);
    expect(updated.body.expense.amountCents).toBe(7500);

    const deleted = await api(`/finance/expenses/${expenseId}`, { method: "DELETE", token: owner.token });
    expect(deleted.status).toBe(204);

    const trail = await prisma.auditLog.findMany({ where: { resourceType: "Expense", resourceId: expenseId }, orderBy: { createdAt: "asc" } });
    expect(trail.map((row) => row.operation)).toEqual(["CREATE", "UPDATE", "DELETE"]);
    expect(trail[1].changedFields).toEqual(["amountCents"]);
    expect(trail[1].actorId).toBe(owner.id);

    const list = await api("/finance/expenses?from=2097-03-01T00:00:00.000Z&to=2097-04-01T00:00:00.000Z", { token: owner.token });
    expect(list.body.items.some((item: { id: string }) => item.id === expenseId)).toBe(false);
  });

  it("rejects an OTHER expense without a custom category and an invalid amount", async () => {
    const other = await api("/finance/expenses", {
      method: "POST",
      token: owner.token,
      body: { category: "OTHER", description: "no label", amountCents: 100, incurredOn: "2097-01-01T00:00:00.000Z" },
    });
    expect(other.status).toBe(400);

    const negative = await api("/finance/expenses", {
      method: "POST",
      token: owner.token,
      body: { category: "SOFTWARE", description: "negative", amountCents: -5, incurredOn: "2097-01-01T00:00:00.000Z" },
    });
    expect(negative.status).toBe(400);
  });
});

describe("finance metrics", () => {
  const futureDay = { from: new Date("2096-05-01T00:00:00.000Z"), to: new Date("2096-05-02T00:00:00.000Z") };

  it("resolves period boundaries in UTC and compares against an equal-length previous window", () => {
    const now = new Date("2026-10-16T15:30:00.000Z");
    const today = resolvePeriod("today", now);
    expect(today.start?.toISOString()).toBe("2026-10-16T00:00:00.000Z");
    expect(today.end?.toISOString()).toBe("2026-10-17T00:00:00.000Z");
    expect(today.previousStart?.toISOString()).toBe("2026-10-15T00:00:00.000Z");

    const lastMonth = resolvePeriod("last_month", now);
    expect(lastMonth.start?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(lastMonth.end?.toISOString()).toBe("2026-10-01T00:00:00.000Z");

    const week = resolvePeriod("week", now);
    expect(week.start?.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(resolvePeriod("all", now).start).toBeNull();
  });

  it("excludes payment-processing expenses from operating expenses, because fees are already netted", async () => {
    const before = await getFinanceTotals(futureDay, true);
    const processing = await prisma.expense.create({
      data: { category: "PAYMENT_PROCESSING", description: `fees ${testRun}`, amountCents: 900, incurredOn: new Date("2096-05-01T12:00:00.000Z") },
    });
    const hosting = await prisma.expense.create({
      data: { category: "HOSTING", description: `host ${testRun}`, amountCents: 4000, incurredOn: new Date("2096-05-01T12:00:00.000Z") },
    });
    createdExpenseIds.push(processing.id, hosting.id);

    const after = await getFinanceTotals(futureDay, true);
    expect(after.operatingExpenseCents - before.operatingExpenseCents).toBe(4000);
    expect(after.recordedProfitCents - before.recordedProfitCents).toBe(-4000);
  });

  it("keeps test-mode money out of live totals and recurring revenue", async () => {
    const window = { start: new Date(Date.now() - 60 * 60 * 1000), end: null };
    const liveBefore = await getFinanceTotals(window, true);
    const testBefore = await getFinanceTotals(window, false);
    const mrrBefore = await getRecurringRevenue(true);

    const user = await makeUser(`fin_${testRun}`, "USER");
    const liveSale = await prisma.paymentTransaction.create({
      data: { userId: user.id, providerPaymentId: `live_${testRun}`, amountCents: 1111, status: "SUCCEEDED", featureCode: "FORGE_BOOST_PACK", livemode: true },
    });
    const testSale = await prisma.paymentTransaction.create({
      data: { userId: user.id, providerPaymentId: `test_${testRun}`, amountCents: 2222, status: "SUCCEEDED", featureCode: "FORGE_BOOST_PACK", livemode: false },
    });
    createdPaymentIds.push(liveSale.id, testSale.id);

    const liveAfter = await getFinanceTotals(window, true);
    const testAfter = await getFinanceTotals(window, false);
    expect(liveAfter.grossCents - liveBefore.grossCents).toBe(1111);
    expect(testAfter.grossCents - testBefore.grossCents).toBe(2222);
    expect(liveAfter.netCents - liveBefore.netCents).toBe(1111);

    // A yearly subscription's last captured charge contributes one twelfth to MRR.
    const subscriptionId = `sub_mrr_${testRun}`;
    createdSubscriptionIds.push(
      (await prisma.billingSubscription.create({
        data: {
          userId: user.id,
          providerCustomerId: `cus_mrr_${testRun}`,
          providerSubscriptionId: subscriptionId,
          tier: "PLUS",
          interval: "YEARLY",
          status: "ACTIVE",
          livemode: true,
        },
      })).id,
    );
    const renewal = await prisma.paymentTransaction.create({
      data: {
        userId: user.id,
        providerPaymentId: `renew_${testRun}`,
        amountCents: 12000,
        status: "SUCCEEDED",
        featureCode: "CORE_PLUS",
        kind: "RENEWAL",
        providerSubscriptionId: subscriptionId,
        livemode: true,
      },
    });
    createdPaymentIds.push(renewal.id);

    const mrrAfter = await getRecurringRevenue(true);
    expect(mrrAfter.mrrCents - mrrBefore.mrrCents).toBe(1000);
    expect(mrrAfter.arrCents - mrrBefore.arrCents).toBe(12000);
  });
});
