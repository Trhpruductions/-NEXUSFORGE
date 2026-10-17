"use strict";

// Read-only check of Stripe's records against the app's payment records. Usage: node reconcile-stripe.js [days]
const { reconcileStripe, closePool } = require("./lib/stripe-reconcile");

(async () => {
  try {
    const report = await reconcileStripe({ days: Number(process.argv[2]) || 30 });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error("reconcile failed:", error.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
})();
