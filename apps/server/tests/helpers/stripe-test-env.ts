/**
 * Gives the Stripe client a placeholder key before config/env.ts is parsed. The billing tests stub
 * every Stripe network call, so the key is never sent anywhere. Import this before any src module.
 */
if (!process.env.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = "sk_test_unit_placeholder";
