# Avatar system audit and plan: 2026-10-16

Source: the complete avatar brief (pasted 2026-10-16). Scope of this document: what the code does today, what the brief asks for, and the stages proposed. No code for the avatar work has changed yet.

## 1. What exists today

| Area | State | Where |
|---|---|---|
| Two editors | **Two.** `/app/avatar` renders the 2D `AvatarStudio`; `/app/avatars/new` and `/app/avatars/[id]` render the 3D `AvatarEditor` (builder). | `apps/web/src/components/avatar/avatar-studio.tsx`, `apps/web/src/components/avatar3d/avatar-editor.tsx` |
| Saved record | One `User.avatarConfig` JSON holding legacy fields (`hair`, `eyes`, `face`, `accessory`, `outfit`, `background`, …) **and** a `design` object. Both editors write to it. | `apps/web/src/lib/avatar-api.ts` (`LEGACY_FIELDS`), `apps/server/src/routes/avatar.routes.ts` |
| Design vocabulary | 3 body types; 11 hairstyles; tops, outerwear, bottoms, shoes, accessories; 3 eye styles; 4 materials; 8 skin-tone swatches. Most options are free. | `apps/server/src/lib/avatar-design.ts`, `apps/web/src/components/avatar3d/design.ts` |
| Paid parts | 8 options map to catalog keys (jersey, neon jacket, tactical pants, armored legs, gold runners, galaxy shoes, cyber shades, backpack). Server refuses a save or apply that uses an unowned one (403). | `PAID_PARTS` in `avatar-design.ts`; `refuseUnownedPaidParts` in `avatar.routes.ts` |
| Lock display | The 3D builder shows owned / locked / free with price. The 2D Studio shows no lock state. | `avatar3d/avatar-builder-parts.tsx` lines 21–22, 137 |
| Catalog | 23 `CosmeticItem` rows, **all paid** (50 to 9,000 coins). Slots: HEAD, FACE, TOP, BOTTOM, SHOES, BACK, ACCESSORY, EMOTE. Rarities: COMMON, RARE, EPIC, LEGENDARY, MYTHIC. | live database (read-only count) |
| Ownership | `UserCosmetic` rows are the only proof of ownership. 20 grants exist in the live database. | `prisma/schema.prisma` |
| Purchases | Go through the economy ledger with an idempotency key (`cosmeticPurchaseReference`). | `apps/server/src/routes/cosmetics.routes.ts` line 171 onward |
| Presets | Up to 10 per account. 7 exist in the live database. | `MAX_PRESETS` in `avatar.routes.ts` |
| 3D assets | 3 base body models (`base-athletic`, `base-broad`, `base-slim`). Clothing and accessories are built in code (`cosmetic-layers.tsx`). | `apps/web/public/avatar-models/` |
| Surfaces showing avatars | Friends, DMs, member lists, forum, threads, voice room, profile page, profile preview, leaderboards, search, posts. | grep of `apps/web/src` |
| Admin cosmetic tools | **None.** No route creates, edits or disables a `CosmeticItem`. | `apps/server/src/routes` |
| Tests | `avatar-design.test.ts`: 16 tests, all passing. They cover ownership, presets with no paid parts, layering and option counts. | `apps/server/tests` |

## 2. Gaps against the brief

1. **Two avatar editors on one record.** The 2D Studio writes legacy fields the 3D builder does not read. A save from one can leave the other's view stale. This is the conflict the brief asks to avoid.
2. **No free starter catalog rows.** The everyday parts are free in code, but the shop and inventory list only paid items. A new user sees no free items in the Wardrobe.
3. **Locked items are not explained in the 2D Studio.** A refused save shows a generic error, not "owned / locked, buy in the Shop".
4. **Catalog fields.** The model has no color variants, unlock rules, availability windows, compatibility, release metadata or thumbnails beyond `imageUrl`.
5. **No admin cosmetic management**, no grant audit beyond the ledger, and no way to disable a broken item without a code change.
6. **Art.** Only three base bodies ship. New clothing and armor need art. The brief's reference image was not in the pasted message, so the target look is not confirmed.
7. **Rewards and badges.** Event-driven cosmetic grants need event rules that do not exist yet.

## 3. Proposed stages

- **Stage 1 (local, no database writes):** consolidate the Studio on one editor (decision A below); add lock and price states to every paid option; add tests that a free everyday look needs no entitlement; confirm every profile surface reads the saved design.
- **Stage 2 (schema, after a backup):** additive nullable columns on `CosmeticItem` for variants, unlock rules, availability windows, compatibility and release metadata. A reviewed migration file is prepared first; it is not run until the backup is confirmed.
- **Stage 3 (admin, code):** staff-only routes to create, update and disable catalog items, each change recorded in `AuditLog`.
- **Stage 4 (rewards, needs rules):** event-driven grants, validated on the server, with a grant record.
- **Stage 5 (art):** new clothing and armor art, with a licence record for each file.

## 4. Decision needed (A)

The 3D builder already has ownership, locks and presets. The 2D Studio does not. Options:

- **Make the 3D builder the one Avatar Studio (recommended).** The 2D route becomes a redirect to the 3D editor. Legacy fields stay in the saved record so older clients still read it. Saved looks keep working.
- **Keep both editors** and add lock states to the 2D Studio as well. Two places to maintain, and the write conflict stays.

## 5. Verification done

- `avatar-design.test.ts`: 16 of 16 pass, run 2026-10-16 against the live source (no database).
- Live catalog and grants read with a read-only session; no rows changed.
