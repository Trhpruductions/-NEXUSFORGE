import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server environment BEFORE dynamic imports
dotenv.config({ path: path.resolve(__dirname, "../apps/server/.env") });

async function stressTest() {
  const { EconomyAuthority } = await import("../apps/server/src/lib/economy-authority.js");
  const { prisma } = await import("../apps/server/src/lib/prisma.js");

  console.log("🚀 Starting Economy Stress Test...");
  console.log("🚀 Starting Economy Stress Test...");
  
  const testUserId = "stress-test-user-" + Date.now();
  
  // 1. Create test user and account
  await prisma.user.create({
    data: {
      id: testUserId,
      username: testUserId,
      email: `${testUserId}@example.com`,
      password: "hashed_password",
    }
  });

  // Pre-initialize account to avoid initial create/update race
  await EconomyAuthority.adjustBalance({
    userId: testUserId,
    amount: 0n,
    currencyType: "NC",
    reason: "Account Initialization"
  });

  console.log("✅ Test user and account created.");

  // 2. Concurrency check: 20 simultaneous balance adjustments
  console.log("⚡ Running 20 concurrent transactions...");
  const adjustPromises = Array.from({ length: 20 }).map((_, i) => 
    EconomyAuthority.adjustBalance({
      userId: testUserId,
      amount: 100n,
      currencyType: "NC",
      reason: `Stress Test Increment ${i}`
    }).catch(err => {
        console.error(`❌ Transaction ${i} failed:`, err.message);
        return null;
    })
  );

  await Promise.all(adjustPromises);

  const finalStats = await EconomyAuthority.getAccountStats(testUserId, "NC");
  console.log(`📊 Final Balance: ${finalStats?.balance.toString()} (Expected: 2000)`);
  
  if (finalStats?.balance === 2000n) {
    console.log("✅ Concurrency validation PASSED.");
  } else {
    console.warn("⚠️ Concurrency validation FAILED or was inconsistent.");
  }

  // 3. Overflow test
  console.log("🌊 Running Overflow Safeguard Test...");
  try {
    await EconomyAuthority.adjustBalance({
      userId: testUserId,
      amount: 2_000_000_000_000_000n,
      currencyType: "NC",
      reason: "Overflow Attempt"
    });
    console.error("❌ Overflow safeguard FAILED (Allowed massive balance)");
  } catch (err: any) {
    console.log("✅ Overflow safeguard PASSED:", err.message);
  }

  // 4. Cleanup
  await prisma.user.delete({ where: { id: testUserId } });
  console.log("🧹 Cleanup complete.");
}

stressTest().catch(console.error).finally(() => prisma.$disconnect());
