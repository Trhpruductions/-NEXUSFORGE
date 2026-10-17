import type { Metadata } from "next";
import { WardrobePage } from "@/components/wardrobe/wardrobe-page";

export const metadata: Metadata = {
  title: "Store",
  description: "Outfits, cosmetics and emotes for Nexus Forge Coins.",
};

export default function AppStorePage() {
  return <WardrobePage mode="store" />;
}
