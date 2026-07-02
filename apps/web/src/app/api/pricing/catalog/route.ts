import { NextResponse } from "next/server";
import {
  CORE_PLUS_TIER_DISPLAY_LABELS,
  CORE_PLUS_TIER_PRICING,
  PAID_FEATURE_DISPLAY_LABELS,
  PAID_FEATURE_PRICE_LABELS,
} from "@/lib/pricing-catalog";

export async function GET() {
  return NextResponse.json(
    {
      tiers: CORE_PLUS_TIER_PRICING,
      tierLabels: CORE_PLUS_TIER_DISPLAY_LABELS,
      paidFeatureLabels: PAID_FEATURE_DISPLAY_LABELS,
      paidFeaturePrices: PAID_FEATURE_PRICE_LABELS,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}