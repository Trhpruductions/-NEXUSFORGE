import type { Metadata } from "next";
import { WardrobePage } from "@/components/wardrobe/wardrobe-page";

export const metadata: Metadata = {
  title: "Wardrobe",
  description: "Outfits. Cosmetics. Collectibles.",
};

export default function AppWardrobePage() {
  return <WardrobePage mode="wardrobe" />;
}
