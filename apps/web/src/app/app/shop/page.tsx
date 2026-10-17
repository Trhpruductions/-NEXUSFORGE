import type { Metadata } from "next";
import { ShopHub } from "@/components/shop/shop-hub";

export const metadata: Metadata = {
  title: "Shop",
  description: "Everything you can buy in Nexus Forge Gaming: outfits and membership.",
};

export default function AppShopPage() {
  return <ShopHub />;
}
