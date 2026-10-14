import { z } from "zod";

/**
 * The saved 3D avatar design (see apps/web/src/components/avatar3d/design.ts). Stored inside the
 * avatar config and the saved avatars. Unknown or missing fields take these defaults.
 */
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const avatarDesignSchema = z.object({
  version: z.literal(1).default(1),
  body: z.enum(["slim", "athletic", "broad"]).default("athletic"),
  skin: hex.default("#d9a577"),
  hair: z.enum(["none", "buzz", "spiky", "long", "curls", "bun", "mohawk"]).default("spiky"),
  hairColor: hex.default("#22d3ee"),
  eyeColor: hex.default("#38bdf8"),
  eyeStyle: z.enum(["round", "sharp", "calm"]).default("round"),
  top: z.enum(["tee", "hoodie", "jacket"]).default("tee"),
  topColor: hex.default("#1b1e26"),
  bottom: z.enum(["jeans", "cargo", "track"]).default("jeans"),
  bottomColor: hex.default("#1d2029"),
  shoes: z.enum(["sneakers", "boots"]).default("sneakers"),
  shoeColor: hex.default("#111318"),
  accessories: z.array(z.enum(["cap", "chain", "shades", "mask", "headset", "bandana"])).max(6).default([]),
  accent: hex.default("#2ea4ff"),
  material: z.enum(["matte", "satin", "gloss", "metallic"]).default("satin"),
});

export type AvatarDesignInput = z.infer<typeof avatarDesignSchema>;

/** A preview is either a page-relative upload path or an https link (the storage bucket). */
export const previewUrlSchema = z
  .string()
  .max(500)
  .refine((value) => value.startsWith("/uploads/") || /^https:\/\//.test(value), "Preview must be an uploaded image");
