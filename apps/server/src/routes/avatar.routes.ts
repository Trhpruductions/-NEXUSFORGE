import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

/** Avatar Studio: the layered avatar config on the user plus up to 10 saved presets. */
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
});

export type AvatarConfig = z.infer<typeof avatarConfigSchema>;

const presetSchema = z.object({
  name: z.string().trim().min(1).max(40),
  tagline: z.string().trim().max(60).optional(),
  config: avatarConfigSchema,
});

export const MAX_PRESETS = 10;

avatarRouter.get("/", async (req, res) => {
  const [user, presets] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { avatarConfig: true } }),
    prisma.avatarPreset.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const parsed = avatarConfigSchema.safeParse(user?.avatarConfig ?? {});
  res.json({
    config: parsed.success ? parsed.data : avatarConfigSchema.parse({}),
    presets,
    maxPresets: MAX_PRESETS,
  });
});

avatarRouter.put("/", async (req, res) => {
  const parsed = avatarConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid avatar", details: parsed.error.flatten() });
    return;
  }
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
  const preset = await prisma.avatarPreset.create({
    data: { userId: req.user!.id, name: parsed.data.name, tagline: parsed.data.tagline, config: parsed.data.config },
  });
  res.status(201).json({ preset });
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
  const preset = await prisma.avatarPreset.update({
    where: { id: existing.id },
    data: { name: parsed.data.name, tagline: parsed.data.tagline, config: parsed.data.config },
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
  res.json({ ok: true, presetId: existing.id });
});

avatarRouter.post("/presets/:id/apply", async (req, res) => {
  const existing = await prisma.avatarPreset.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!existing) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }
  const parsed = avatarConfigSchema.safeParse(existing.config);
  if (!parsed.success) {
    res.status(400).json({ error: "Stored preset is invalid" });
    return;
  }
  await prisma.user.update({ where: { id: req.user!.id }, data: { avatarConfig: parsed.data } });
  res.json({ config: parsed.data });
});
