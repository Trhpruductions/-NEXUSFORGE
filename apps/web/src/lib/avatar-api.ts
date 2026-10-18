import {
  api,
  authHeaders,
  createAvatarPreset,
  createUploadPresign,
  deleteAvatarPreset,
  getAvatar,
  getCosmeticCatalog,
  updateAvatarPreset,
  type AvatarConfig,
  type AvatarPreset,
} from "@/lib/api";
import { describeFallbacks, normaliseDesign, type AvatarDesign } from "@/components/avatar3d/design";

/**
 * Client calls for the 3D avatar studio and the saved looks. These use the shared API client in api.ts and
 * add only what the avatar pages need: the ownership snapshot for paid parts, the duplicate and equip calls
 * (with the fallbacks the server reports), and the look-to-design conversions.
 *
 * The server is the authority. The ownership snapshot only drives what the editor shows as locked.
 */

/** Legacy fields the server still expects on every avatar config. These match the 2D studio defaults. */
const LEGACY_FIELDS: Omit<AvatarConfig, "design"> = {
  body: "athletic",
  skin: "#d9a577",
  hair: "spiky",
  hairColor: "#22d3ee",
  hairLength: 60,
  eyes: "sharp",
  eyeColor: "#38bdf8",
  face: "focused",
  accessory: "none",
  topColor: "#111318",
  bottomColor: "#1f2937",
  shoeColor: "#2ea4ff",
  accent: "#2ea4ff",
  background: "city",
  outfit: "base",
};

export type RetiredPart = { field: string; value: string };

export type OwnershipSnapshot = {
  /** Catalog keys the account owns (a UserCosmetic row exists for each). */
  owned: ReadonlySet<string>;
  /** Price in Nexus Forge Coins for each catalog key. */
  prices: ReadonlyMap<string, number>;
  /** Display name for each catalog key. */
  names: ReadonlyMap<string, string>;
  coins: number;
};

/** Reads which paid parts the account owns, from the cosmetic catalog. */
export async function loadOwnership(accessToken: string): Promise<OwnershipSnapshot> {
  const data = await getCosmeticCatalog(accessToken);
  const owned = new Set<string>();
  const prices = new Map<string, number>();
  const names = new Map<string, string>();
  for (const item of data.items) {
    if (item.owned) owned.add(item.key);
    prices.set(item.key, item.priceCoins);
    names.set(item.key, item.name);
  }
  return { owned, prices, names, coins: data.coins };
}

/** Loads the saved looks and the profile's main look. */
export async function loadLooks(accessToken: string) {
  return getAvatar(accessToken);
}

/** Wraps a design in the avatar config the server stores. */
export function configFor(design: AvatarDesign): AvatarConfig {
  return { ...LEGACY_FIELDS, design };
}

/** The design a saved look shows, with any retired parts already replaced by their defaults. */
export function designOfLook(look: AvatarPreset): AvatarDesign {
  return normaliseDesign((look.config as { design?: unknown }).design);
}

/** The parts of a saved look that no longer exist, as text for a notice. */
export function retiredPartsOf(look: AvatarPreset): string[] {
  return describeFallbacks((look.config as { design?: unknown }).design);
}

export async function createLook(accessToken: string, csrfToken: string, name: string, design: AvatarDesign): Promise<AvatarPreset> {
  const result = await createAvatarPreset(accessToken, csrfToken, { name, config: configFor(design) });
  return result.preset;
}

export async function saveLook(accessToken: string, csrfToken: string, id: string, name: string, design: AvatarDesign): Promise<AvatarPreset> {
  const result = await updateAvatarPreset(accessToken, csrfToken, id, { name, config: configFor(design) });
  return result.preset;
}

export async function renameLook(accessToken: string, csrfToken: string, id: string, name: string): Promise<AvatarPreset> {
  const result = await updateAvatarPreset(accessToken, csrfToken, id, { name });
  return result.preset;
}

/** Copies a look on the server. The copy is private. */
export async function duplicateLook(accessToken: string, csrfToken: string, id: string): Promise<{ preset: AvatarPreset; fallbacks: RetiredPart[] }> {
  const response = await api.post<{ preset: AvatarPreset; fallbacks: RetiredPart[] }>(`/api/avatar/presets/${id}/duplicate`, {}, { headers: authHeaders(accessToken, csrfToken) });
  return response.data;
}

/**
 * Equips a look as the profile avatar. The server refuses a paid part the account does not own (403), and
 * reports the retired parts that were replaced by their defaults in the worn avatar.
 */
export async function equipLook(accessToken: string, csrfToken: string, id: string): Promise<{ mainPresetId: string; fallbacks: RetiredPart[] }> {
  const response = await api.post<{ config: AvatarConfig; mainPresetId: string; fallbacks: RetiredPart[] }>(`/api/avatar/presets/${id}/apply`, {}, { headers: authHeaders(accessToken, csrfToken) });
  return { mainPresetId: response.data.mainPresetId, fallbacks: response.data.fallbacks };
}

export async function removeLook(accessToken: string, csrfToken: string, id: string) {
  await deleteAvatarPreset(accessToken, csrfToken, id);
}

/** Uploads a rendered portrait of a look and stores it on that look, for the gallery and the profile. */
export async function uploadPortrait(accessToken: string, csrfToken: string, id: string, blob: Blob): Promise<void> {
  const presign = await createUploadPresign(accessToken, csrfToken, { filename: "avatar-portrait.png", contentType: "image/png", size: blob.size });
  const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: blob });
  if (!put.ok) throw new Error("The picture could not be uploaded. Try again.");
  await updateAvatarPreset(accessToken, csrfToken, id, { previewUrl: presign.fileUrl });
}
