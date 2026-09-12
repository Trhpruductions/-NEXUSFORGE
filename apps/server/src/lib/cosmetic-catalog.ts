import { prisma } from "./prisma.js";

type CatalogEntry = {
  key: string;
  name: string;
  description: string;
  slot: "HEAD" | "FACE" | "TOP" | "BOTTOM" | "SHOES" | "BACK" | "ACCESSORY" | "EMOTE";
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
  priceCoins: number;
  color: string;
  metadata?: Record<string, unknown>;
};

/** Starter cosmetic catalog. Colors drive the layered avatar renderer; imageUrl can be added later. */
export const cosmeticCatalog: CatalogEntry[] = [
  { key: "top-vexora-hoodie", name: "Vexora Hoodie", description: "Black hoodie with the gold V.", slot: "TOP", rarity: "EPIC", priceCoins: 1200, color: "#111318", metadata: { accent: "#e6b325" } },
  { key: "top-neon-drift-jacket", name: "Neon Drift Jacket", description: "Layered street jacket with neon trim.", slot: "TOP", rarity: "LEGENDARY", priceCoins: 2400, color: "#1d4ed8", metadata: { accent: "#22d3ee" } },
  { key: "top-squad-tee", name: "Squad Tee", description: "Everyday tee in forge colors.", slot: "TOP", rarity: "COMMON", priceCoins: 150, color: "#334155" },
  { key: "top-esports-jersey", name: "Esports Jersey", description: "Tournament-cut jersey.", slot: "TOP", rarity: "RARE", priceCoins: 600, color: "#7f1d1d", metadata: { accent: "#f8fafc" } },
  { key: "bottom-tactical-pants", name: "Tactical Pants", description: "Cargo cut with utility straps.", slot: "BOTTOM", rarity: "EPIC", priceCoins: 900, color: "#1f2937" },
  { key: "bottom-track-pants", name: "Track Pants", description: "Stripe-side joggers.", slot: "BOTTOM", rarity: "COMMON", priceCoins: 120, color: "#0f172a", metadata: { accent: "#e6b325" } },
  { key: "bottom-armored-legs", name: "Armored Legs", description: "Plated greaves from the arena.", slot: "BOTTOM", rarity: "LEGENDARY", priceCoins: 2100, color: "#3f3f46", metadata: { accent: "#a1a1aa" } },
  { key: "shoes-galaxy", name: "Galaxy Shoes", description: "Starfield runners with a glow sole.", slot: "SHOES", rarity: "MYTHIC", priceCoins: 4200, color: "#4c1d95", metadata: { accent: "#22d3ee" } },
  { key: "shoes-court-classic", name: "Court Classics", description: "Clean white high tops.", slot: "SHOES", rarity: "COMMON", priceCoins: 100, color: "#e2e8f0" },
  { key: "shoes-gold-runners", name: "Gold Runners", description: "Trainers dipped in forge gold.", slot: "SHOES", rarity: "EPIC", priceCoins: 1100, color: "#e6b325" },
  { key: "head-rogue-mask", name: "Rogue Mask", description: "Half mask with a glowing visor.", slot: "HEAD", rarity: "EPIC", priceCoins: 1300, color: "#111827", metadata: { accent: "#ef4444" } },
  { key: "head-snapback", name: "Vexora Snapback", description: "Flat brim with the emblem.", slot: "HEAD", rarity: "RARE", priceCoins: 400, color: "#0b0f19", metadata: { accent: "#e6b325" } },
  { key: "head-crown", name: "Founder Crown", description: "Reserved for the first wave.", slot: "HEAD", rarity: "MYTHIC", priceCoins: 9000, color: "#e6b325" },
  { key: "face-cyber-shades", name: "Cyber Shades", description: "Wraparound lenses.", slot: "FACE", rarity: "RARE", priceCoins: 350, color: "#0ea5e9" },
  { key: "face-war-paint", name: "War Paint", description: "Two-stripe camo streaks.", slot: "FACE", rarity: "COMMON", priceCoins: 80, color: "#dc2626" },
  { key: "back-neon-backpack", name: "Neon Backpack", description: "Compact pack with LED piping.", slot: "BACK", rarity: "RARE", priceCoins: 700, color: "#0f172a", metadata: { accent: "#a855f7" } },
  { key: "back-flux-wings", name: "Flux Wings", description: "Energy wings that flare on emotes.", slot: "BACK", rarity: "LEGENDARY", priceCoins: 3600, color: "#06b6d4", metadata: { accent: "#f0abfc" } },
  { key: "acc-headset", name: "Pro Headset", description: "Over-ear cans with boom mic.", slot: "ACCESSORY", rarity: "COMMON", priceCoins: 200, color: "#1e293b", metadata: { accent: "#e6b325" } },
  { key: "acc-chain", name: "Gold Chain", description: "Heavy link with the V pendant.", slot: "ACCESSORY", rarity: "EPIC", priceCoins: 1500, color: "#e6b325" },
  { key: "emote-gg", name: "GG Salute", description: "Two-finger salute.", slot: "EMOTE", rarity: "COMMON", priceCoins: 50, color: "#e6b325" },
  { key: "emote-victory-flex", name: "Victory Flex", description: "Double bicep with sparks.", slot: "EMOTE", rarity: "RARE", priceCoins: 450, color: "#f59e0b" },
  { key: "emote-drop-in", name: "Drop In", description: "Skydive landing pose.", slot: "EMOTE", rarity: "LEGENDARY", priceCoins: 2000, color: "#22d3ee" },
];

let ensured = false;

/** Inserts any catalog entries that are missing. Safe to call on every boot. */
export async function ensureCosmeticCatalog(): Promise<void> {
  if (ensured) return;
  const existing = await prisma.cosmeticItem.findMany({ select: { key: true } });
  const have = new Set(existing.map((entry) => entry.key));
  const missing = cosmeticCatalog.filter((entry) => !have.has(entry.key));
  if (missing.length) {
    await prisma.cosmeticItem.createMany({
      data: missing.map((entry) => ({
        key: entry.key,
        name: entry.name,
        description: entry.description,
        slot: entry.slot,
        rarity: entry.rarity,
        priceCoins: entry.priceCoins,
        color: entry.color,
        metadata: entry.metadata ?? undefined,
      })),
      skipDuplicates: true,
    });
  }
  ensured = true;
}
