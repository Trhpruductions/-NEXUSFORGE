import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { EconomyAuthority } from "../lib/economy-authority.js";
import { ensureCosmeticCatalog } from "../lib/cosmetic-catalog.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

/** Wardrobe: cosmetic catalog, purchases with Vexora Coins (NC), owned inventory, and the equipped loadout. */
export const cosmeticsRouter = Router();

cosmeticsRouter.use(requireAuth);
cosmeticsRouter.use(requireCsrf);

const slotValues = ["HEAD", "FACE", "TOP", "BOTTOM", "SHOES", "BACK", "ACCESSORY", "EMOTE"] as const;

const loadoutSchema = z.object({
  slot: z.enum(slotValues),
  itemId: z.string().uuid().nullable(),
});

type Loadout = Partial<Record<(typeof slotValues)[number], string>>;

function readLoadout(raw: unknown): Loadout {
  if (!raw || typeof raw !== "object") return {};
  const result: Loadout = {};
  for (const slot of slotValues) {
    const value = (raw as Record<string, unknown>)[slot];
    if (typeof value === "string") result[slot] = value;
  }
  return result;
}

type LoadoutPreset = { id: string; name: string; loadout: Loadout; createdAt: string };
const MAX_LOADOUT_PRESETS = 8;

function readPresets(raw: unknown): LoadoutPreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is LoadoutPreset => Boolean(entry) && typeof entry === "object" && typeof (entry as LoadoutPreset).id === "string" && typeof (entry as LoadoutPreset).name === "string")
    .map((entry) => ({ id: entry.id, name: entry.name, loadout: readLoadout(entry.loadout), createdAt: entry.createdAt ?? new Date().toISOString() }));
}

async function coinBalance(userId: string): Promise<number> {
  const account = await prisma.economyAccount.findUnique({
    where: { userId_currencyType: { userId, currencyType: "NC" } },
    select: { balance: true },
  });
  return Number(account?.balance ?? 0n);
}

cosmeticsRouter.get("/catalog", async (req, res) => {
  await ensureCosmeticCatalog();
  const slot = typeof req.query.slot === "string" && (slotValues as readonly string[]).includes(req.query.slot) ? req.query.slot : undefined;
  const [items, owned, user] = await Promise.all([
    prisma.cosmeticItem.findMany({
      where: slot ? { slot: slot as (typeof slotValues)[number] } : {},
      orderBy: [{ slot: "asc" }, { priceCoins: "asc" }],
    }),
    prisma.userCosmetic.findMany({ where: { userId: req.user!.id }, select: { itemId: true } }),
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { loadout: true } }),
  ]);
  const ownedIds = new Set(owned.map((entry) => entry.itemId));
  const loadout = readLoadout(user?.loadout);
  const equipped = new Set(Object.values(loadout));

  res.json({
    items: items.map((item) => ({ ...item, owned: ownedIds.has(item.id), equipped: equipped.has(item.id) })),
    loadout,
    coins: await coinBalance(req.user!.id),
  });
});

cosmeticsRouter.get("/inventory", async (req, res) => {
  await ensureCosmeticCatalog();
  const [owned, user] = await Promise.all([
    prisma.userCosmetic.findMany({
      where: { userId: req.user!.id },
      orderBy: { acquiredAt: "desc" },
      include: { item: true },
    }),
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { loadout: true, loadoutPresets: true } }),
  ]);
  const loadout = readLoadout(user?.loadout);
  const equipped = new Set(Object.values(loadout));
  res.json({
    items: owned.map((entry) => ({ ...entry.item, owned: true, equipped: equipped.has(entry.itemId), acquiredAt: entry.acquiredAt })),
    loadout,
    presets: readPresets(user?.loadoutPresets),
    maxPresets: MAX_LOADOUT_PRESETS,
    coins: await coinBalance(req.user!.id),
  });
});

const presetSchema = z.object({ name: z.string().trim().min(1).max(32) });

/** Save the current loadout as a named outfit preset. */
cosmeticsRouter.post("/presets", async (req, res) => {
  const parsed = presetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Give the outfit a name (up to 32 characters)" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { loadout: true, loadoutPresets: true } });
  const loadout = readLoadout(user?.loadout);
  if (!Object.keys(loadout).length) {
    res.status(400).json({ error: "Equip at least one item before saving an outfit" });
    return;
  }
  const presets = readPresets(user?.loadoutPresets);
  if (presets.length >= MAX_LOADOUT_PRESETS) {
    res.status(400).json({ error: `You can keep up to ${MAX_LOADOUT_PRESETS} outfit presets` });
    return;
  }
  const preset: LoadoutPreset = { id: crypto.randomUUID(), name: parsed.data.name, loadout, createdAt: new Date().toISOString() };
  presets.push(preset);
  await prisma.user.update({ where: { id: req.user!.id }, data: { loadoutPresets: presets } });
  res.status(201).json({ preset, presets });
});

/** Apply a saved outfit preset; items no longer owned are skipped. */
cosmeticsRouter.post("/presets/:id/apply", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { loadoutPresets: true } });
  const preset = readPresets(user?.loadoutPresets).find((entry) => entry.id === req.params.id);
  if (!preset) {
    res.status(404).json({ error: "Outfit preset not found" });
    return;
  }
  const owned = await prisma.userCosmetic.findMany({ where: { userId: req.user!.id }, select: { itemId: true } });
  const ownedIds = new Set(owned.map((entry) => entry.itemId));
  const loadout: Loadout = {};
  for (const slot of slotValues) {
    const itemId = preset.loadout[slot];
    if (itemId && ownedIds.has(itemId)) loadout[slot] = itemId;
  }
  await prisma.user.update({ where: { id: req.user!.id }, data: { loadout } });
  res.json({ loadout });
});

cosmeticsRouter.delete("/presets/:id", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { loadoutPresets: true } });
  const presets = readPresets(user?.loadoutPresets);
  const next = presets.filter((entry) => entry.id !== req.params.id);
  if (next.length === presets.length) {
    res.status(404).json({ error: "Outfit preset not found" });
    return;
  }
  await prisma.user.update({ where: { id: req.user!.id }, data: { loadoutPresets: next } });
  res.json({ presets: next });
});

cosmeticsRouter.post("/:itemId/purchase", async (req, res) => {
  const item = await prisma.cosmeticItem.findUnique({ where: { id: req.params.itemId } });
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  const alreadyOwned = await prisma.userCosmetic.findUnique({
    where: { userId_itemId: { userId: req.user!.id, itemId: item.id } },
  });
  if (alreadyOwned) {
    res.status(400).json({ error: "You already own this item" });
    return;
  }

  if (item.priceCoins > 0) {
    try {
      await EconomyAuthority.adjustBalance({
        userId: req.user!.id,
        amount: BigInt(-item.priceCoins),
        currencyType: "NC",
        reason: `Cosmetic purchase: ${item.name}`,
        referenceId: item.id,
        metadata: { itemKey: item.key, slot: item.slot, rarity: item.rarity },
      });
    } catch (error) {
      res.status(402).json({ error: "Not enough Vexora Coins", detail: error instanceof Error ? error.message : undefined });
      return;
    }
  }

  await prisma.userCosmetic.create({ data: { userId: req.user!.id, itemId: item.id } });
  res.status(201).json({ item: { ...item, owned: true, equipped: false }, coins: await coinBalance(req.user!.id) });
});

cosmeticsRouter.put("/loadout", async (req, res) => {
  const parsed = loadoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  if (parsed.data.itemId) {
    const owned = await prisma.userCosmetic.findUnique({
      where: { userId_itemId: { userId: req.user!.id, itemId: parsed.data.itemId } },
      include: { item: { select: { slot: true } } },
    });
    if (!owned) {
      res.status(403).json({ error: "You do not own this item" });
      return;
    }
    if (owned.item.slot !== parsed.data.slot) {
      res.status(400).json({ error: `That item belongs in the ${owned.item.slot.toLowerCase()} slot` });
      return;
    }
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { loadout: true } });
  const loadout = readLoadout(user?.loadout);
  if (parsed.data.itemId) loadout[parsed.data.slot] = parsed.data.itemId;
  else delete loadout[parsed.data.slot];

  await prisma.user.update({ where: { id: req.user!.id }, data: { loadout } });
  res.json({ loadout });
});
