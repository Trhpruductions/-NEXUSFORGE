import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { evaluateAchievements } from "../lib/achievements.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { avatarDesignSchema, missingPaidParts, previewUrlSchema, readStoredDesign, requiredCatalogKeys, type AvatarDesignInput, type PaidPart } from "../lib/avatar-design.js";

/** Avatar Studio: the layered avatar config on the user plus up to 10 saved looks (AvatarPreset rows). */
export const avatarRouter = Router();

avatarRouter.use(requireAuth);
avatarRouter.use(requireCsrf);

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const avatarConfigSchema = z.object({
  body: z.enum(["slim", "athletic", "broad"]).default("athletic"),
  skin: hex.default("#d9a577"),
  hair: z.enum(["spiky", "fade", "curls", "long", "bun", "buzz", "mohawk", "none"]).default("spiky"),
  hairColor: hex.default("#22d3ee"),
  hairLength: z.number().int().min(0).max(100).default(60),
  eyes: z.enum(["sharp", "round", "calm", "visor"]).default("sharp"),
  eyeColor: hex.default("#38bdf8"),
  face: z.enum(["neutral", "smirk", "focused", "grin"]).default("focused"),
  accessory: z.enum(["none", "shades", "headset", "mask", "bandana"]).default("none"),
  topColor: hex.default("#111318"),
  bottomColor: hex.default("#1f2937"),
  shoeColor: hex.default("#e6b325"),
  accent: hex.default("#e6b325"),
  background: z.enum(["city", "forge", "void", "arena"]).default("city"),
  /** The 3D design (body, clothes, hair, accessories). Optional for avatars made before it existed. */
  design: avatarDesignSchema.optional(),
  /** A full look from the mockups ("base" keeps the layered avatar above). */
  outfit: z.enum(["base", "cyber", "shadow", "knight", "street", "sorceress", "nomad"]).default("base"),
});

export type AvatarConfig = z.infer<typeof avatarConfigSchema>;

const presetSchema = z.object({
  name: z.string().trim().min(1).max(40),
  tagline: z.string().trim().max(60).optional(),
  config: avatarConfigSchema,
  isPublic: z.boolean().optional(),
  previewUrl: previewUrlSchema.nullable().optional(),
});

export const MAX_PRESETS = 10;

/** The catalog keys the account owns, out of the ones given. A UserCosmetic row is the only proof of ownership. */
async function ownedCatalogKeys(userId: string, keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const rows = await prisma.userCosmetic.findMany({
    where: { userId, item: { key: { in: keys } } },
    select: { item: { select: { key: true } } },
  });
  return new Set(rows.map((row) => row.item.key));
}

/** Refuses a write or an apply that uses a paid part the account does not own. Returns true when it refused. */
async function refuseUnownedPaidParts(res: Response, userId: string, design: AvatarDesignInput | undefined): Promise<boolean> {
  if (!design) return false;
  const owned = await ownedCatalogKeys(userId, requiredCatalogKeys(design));
  const missing = missingPaidParts(design, owned);
  if (!missing.length) return false;
  res.status(403).json({ error: unownedMessage(missing), missing: missing.map(toMissingEntry) });
  return true;
}

function unownedMessage(missing: PaidPart[]) {
  return `You do not own ${missing.map((part) => part.label).join(", ")}. Buy it in the Wardrobe to wear it.`;
}

function toMissingEntry(part: PaidPart) {
  return { category: part.category, id: part.id, label: part.label, catalogKey: part.catalogKey };
}

/**
 * The config a stored look produces when it is applied or copied: unknown ids fall back to the default for
 * that field (listed in `fallbacks`), and the legacy fields are checked as before. Returns null when the
 * legacy part is invalid. The stored record itself is never written here.
 */
function readableConfig(raw: unknown): { config: AvatarConfig; design: AvatarDesignInput | undefined; fallbacks: Array<{ field: string; value: string }> } | null {
  const stored = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const { design: rawDesign, ...legacyFields } = stored;
  const legacy = avatarConfigSchema.omit({ design: true }).safeParse(legacyFields);
  if (!legacy.success) return null;
  if (rawDesign === undefined) return { config: { ...legacy.data }, design: undefined, fallbacks: [] };
  const read = readStoredDesign(rawDesign);
  return { config: { ...legacy.data, design: read.design }, design: read.design, fallbacks: read.fallbacks };
}

avatarRouter.get("/", async (req, res) => {
  const [user, presets] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatarConfig: true, mainAvatarPresetId: true } }),
    prisma.avatarPreset.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "asc" } }),
  ]);
  // Retired ids in the worn design fall back per field, so one retired part does not reset the whole avatar.
  const readable = readableConfig(user?.avatarConfig ?? {});
  res.json({
    config: readable ? readable.config : avatarConfigSchema.parse({}),
    presets,
    maxPresets: MAX_PRESETS,
    mainPresetId: user?.mainAvatarPresetId ?? null,
  });
});

avatarRouter.put("/", async (req, res) => {
  const parsed = avatarConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid avatar", details: parsed.error.flatten() });
    return;
  }
  if (await refuseUnownedPaidParts(res, req.user!.id, parsed.data.design)) return;
  await prisma.user.update({ where: { id: req.user!.id }, data: { avatarConfig: parsed.data } });
  res.json({ config: parsed.data });
});

avatarRouter.post("/presets", async (req, res) => {
  const parsed = presetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid preset", details: parsed.error.flatten() });
    return;
  }
  const count = await prisma.avatarPreset.count({ where: { userId: req.user!.id } });
  if (count >= MAX_PRESETS) {
    res.status(400).json({ error: `You can keep up to ${MAX_PRESETS} saved avatars` });
    return;
  }
  if (await refuseUnownedPaidParts(res, req.user!.id, parsed.data.config.design)) return;
  const preset = await prisma.avatarPreset.create({
    data: {
      userId: req.user!.id,
      name: parsed.data.name,
      tagline: parsed.data.tagline,
      config: parsed.data.config,
      isPublic: parsed.data.isPublic ?? false,
      previewUrl: parsed.data.previewUrl ?? null,
    },
  });
  res.status(201).json({ preset });
  void evaluateAchievements(req.user!.id);
});

avatarRouter.patch("/presets/:id", async (req, res) => {
  const parsed = presetSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid preset", details: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.avatarPreset.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!existing) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }
  if (await refuseUnownedPaidParts(res, req.user!.id, parsed.data.config?.design)) return;
  const preset = await prisma.avatarPreset.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      tagline: parsed.data.tagline,
      config: parsed.data.config,
      isPublic: parsed.data.isPublic,
      previewUrl: parsed.data.previewUrl,
    },
  });
  res.json({ preset });
});

avatarRouter.delete("/presets/:id", async (req, res) => {
  const existing = await prisma.avatarPreset.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!existing) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }
  await prisma.avatarPreset.delete({ where: { id: existing.id } });
  // Deleting the main avatar leaves the profile on the layered avatar.
  await prisma.user.updateMany({ where: { id: req.user!.id, mainAvatarPresetId: existing.id }, data: { mainAvatarPresetId: null } });
  res.json({ ok: true, presetId: existing.id });
});

/** Copies a saved look. The copy is private, and retired ids are replaced by their defaults in the copy only. */
avatarRouter.post("/presets/:id/duplicate", async (req, res) => {
  const existing = await prisma.avatarPreset.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!existing) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }
  const count = await prisma.avatarPreset.count({ where: { userId: req.user!.id } });
  if (count >= MAX_PRESETS) {
    res.status(400).json({ error: `You can keep up to ${MAX_PRESETS} saved avatars` });
    return;
  }
  const readable = readableConfig(existing.config);
  if (!readable) {
    res.status(400).json({ error: "Stored avatar is invalid" });
    return;
  }
  if (await refuseUnownedPaidParts(res, req.user!.id, readable.design)) return;
  const preset = await prisma.avatarPreset.create({
    data: {
      userId: req.user!.id,
      name: `${existing.name.slice(0, 32)} copy`,
      tagline: existing.tagline,
      config: readable.config,
      isPublic: false,
      previewUrl: null,
    },
  });
  res.status(201).json({ preset, fallbacks: readable.fallbacks });
  void evaluateAchievements(req.user!.id);
});

/**
 * Equips a saved look as the profile avatar. A paid part the account does not own is refused (403).
 * Retired ids fall back to their defaults for the worn avatar, and are listed in `fallbacks`. The saved
 * look itself is not changed.
 */
avatarRouter.post("/presets/:id/apply", async (req, res) => {
  const existing = await prisma.avatarPreset.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!existing) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }
  const readable = readableConfig(existing.config);
  if (!readable) {
    res.status(400).json({ error: "Stored preset is invalid" });
    return;
  }
  if (await refuseUnownedPaidParts(res, req.user!.id, readable.design)) return;
  await prisma.user.update({ where: { id: req.user!.id }, data: { avatarConfig: readable.config, mainAvatarPresetId: existing.id } });
  res.json({ config: readable.config, mainPresetId: existing.id, fallbacks: readable.fallbacks });
});
