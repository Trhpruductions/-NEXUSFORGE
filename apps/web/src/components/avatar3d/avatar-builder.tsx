"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Shuffle } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api";
import { createLook, loadLooks, loadOwnership, saveLook, uploadPortrait, type OwnershipSnapshot } from "@/lib/avatar-api";
import {
  ACCESSORY_GROUP_LABELS,
  BODY_TYPES,
  COLOUR_FIELDS,
  DEFAULT_DESIGN,
  DESIGN_PRESETS,
  EYE_STYLES,
  MATERIAL_STYLES,
  PALETTE,
  PART_OPTIONS,
  SKIN_TONES,
  randomDesign,
  toggleAccessory,
  type Accessory,
  type AvatarDesign,
  type HairStyle,
  type PartCategory,
  type PartOption,
  type ShoeStyle,
  type TopStyle,
  type OuterStyle,
  type BottomStyle,
} from "@/components/avatar3d/design";
import type { CaptureFn, ViewerBackground, ViewerPose, ViewerShot } from "@/components/avatar3d/avatar-viewer";
import { usePrefersReducedMotion } from "@/components/avatar3d/reduced-motion";
import { Chips, FilterBar, OptionGrid, Swatches, chip, type LockFilter } from "@/components/avatar3d/avatar-builder-parts";
import { SavedLooksPanel, type Notice } from "@/components/avatar3d/saved-looks-panel";
import { CurrentSelections } from "@/components/avatar3d/current-selections";
import { STUDIO_CATEGORIES, armorOptions, headwear, onlyHoodies, otherAccessories, remember, topsWithoutHoodies, type RecentPick, type StudioCategory } from "@/components/avatar3d/studio-model";
import { EmotePanel, OwnedInventory, OwnershipLegend, ProfileCard, RecentlyUsed, SavedOutfitsSummary } from "@/components/avatar3d/studio-panels";
import type { EmoteId } from "@/components/avatar3d/emote-poses";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

const POSE_CHOICES: Array<{ id: ViewerPose; label: string }> = [
  { id: "relaxed", label: "Relaxed" },
  { id: "victory", label: "Victory" },
  { id: "showcase", label: "Showcase" },
  { id: "pockets", label: "Hands in pockets" },
];
const SHOT_CHOICES: Array<{ id: ViewerShot; label: string }> = [
  { id: "full", label: "Full body" },
  { id: "portrait", label: "Portrait" },
  { id: "side", label: "Side" },
];
const RENDER_BACKGROUNDS: Array<{ id: "studio" | "night" | "transparent"; label: string }> = [
  { id: "studio", label: "Studio" },
  { id: "night", label: "Night" },
  { id: "transparent", label: "Clear PNG" },
];
const RENDER_SIZES: Record<ViewerShot, { width: number; height: number }> = {
  full: { width: 900, height: 1200 },
  portrait: { width: 800, height: 800 },
  side: { width: 900, height: 1200 },
};

// The 3D viewer needs WebGL, so it loads only in the browser.
const AvatarViewer = dynamic(() => import("@/components/avatar3d/avatar-viewer").then((m) => m.AvatarViewer), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-slate-400">Loading 3D…</div>,
});

type Category = StudioCategory;
const CATEGORIES = STUDIO_CATEGORIES;

// Head coverings have their own category, so the accessories tabs cover eyewear, face and body items.
type AccessoryTab = "all" | "eyewear" | "face" | "body";
const ACCESSORY_TABS: Array<{ id: AccessoryTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "eyewear", label: ACCESSORY_GROUP_LABELS.eyewear },
  { id: "face", label: ACCESSORY_GROUP_LABELS.face },
  { id: "body", label: ACCESSORY_GROUP_LABELS.body },
];

/** The option's label, or its id if it is not in the list. */
function labelOf(category: PartCategory, id: string): string {
  return PART_OPTIONS[category].find((option) => option.id === id)?.label ?? id;
}

type Snapshot = { name: string; design: AvatarDesign };
const EMPTY_OWNED: ReadonlySet<string> = new Set<string>();
const UNSAVED_MESSAGE = "You have unsaved changes to this avatar. Leave without saving?";

/** The part of the design that is compared when deciding whether anything changed. */
const signatureOf = (snapshot: Snapshot) => JSON.stringify({ name: snapshot.name.trim(), design: snapshot.design });

/** Paid parts in the design that the account does not own yet. */
function lockedPartsIn(design: AvatarDesign, owned: ReadonlySet<string>): string[] {
  const picks: Array<[PartCategory, string]> = [
    ["hair", design.hair],
    ["top", design.top],
    ["outer", design.outer],
    ["bottom", design.bottom],
    ["shoes", design.shoes],
    ...design.accessories.map((a): [PartCategory, string] => ["accessory", a]),
  ];
  const labels: string[] = [];
  for (const [category, id] of picks) {
    const option = PART_OPTIONS[category].find((entry) => entry.id === id);
    if (option?.catalogKey && !owned.has(option.catalogKey)) labels.push(option.label);
  }
  return labels;
}

/**
 * The avatar builder. Every option changes the 3D figure in the viewer. Paid options show as locked until the
 * account owns them, and the server refuses to save them either way. Changes are kept in a draft until Save.
 */
export function AvatarBuilder({ initial = DEFAULT_DESIGN, presetId = null, initialName = "My avatar", retiredParts = [] }: { initial?: AvatarDesign; presetId?: string | null; initialName?: string; retiredParts?: string[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryScope = useQueryScope();
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const reduced = usePrefersReducedMotion();

  const ownershipQuery = useQuery({ queryKey: ["avatar-ownership", queryScope], queryFn: () => loadOwnership(accessToken!), enabled: Boolean(accessToken) });
  const ownership: OwnershipSnapshot | null = ownershipQuery.data ?? null;
  const owned = ownership?.owned ?? EMPTY_OWNED;
  const looksQuery = useQuery({ queryKey: ["avatar", queryScope], queryFn: () => loadLooks(accessToken!), enabled: Boolean(accessToken) });
  const looks = looksQuery.data?.presets ?? [];
  const maxLooks = looksQuery.data?.maxPresets ?? 10;
  const mainId = looksQuery.data?.mainPresetId ?? null;

  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState<AvatarDesign>(initial);
  // What is saved (for a new avatar, the starting design). Unsaved changes are measured against it.
  const [baseline, setBaseline] = useState<Snapshot>({ name: initialName, design: initial });
  const dirty = signatureOf({ name, design: draft }) !== signatureOf(baseline);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [category, setCategory] = useState<Category>("hair");
  const [accessoryTab, setAccessoryTab] = useState<AccessoryTab>("all");
  const user = useAuthStore((state) => state.user);
  const [recent, setRecent] = useState<RecentPick[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LockFilter>("all");
  const [hint, setHint] = useState<string | null>(null);
  const [spin, setSpin] = useState(true);
  const [background, setBackground] = useState<ViewerBackground>("studio");
  const captureRef = useRef<CaptureFn | null>(null);
  const [pose, setPose] = useState<ViewerPose>("relaxed");
  // Each preview gets a new nonce, so pressing Preview again plays the emote from the start.
  const [emote, setEmote] = useState<{ id: EmoteId; nonce: number } | null>(null);
  const previewEmote = (id: EmoteId) => setEmote((current) => ({ id, nonce: (current?.nonce ?? 0) + 1 }));
  const [shot, setShot] = useState<ViewerShot>("full");
  const [renderBackground, setRenderBackground] = useState<"studio" | "night" | "transparent">("studio");
  const [renderNote, setRenderNote] = useState<string | null>(null);
  const [pictureBusy, setPictureBusy] = useState(false);
  // A prepared PNG waits for the Save PNG link. It is kept only while the view it was rendered from is unchanged.
  const [pngFile, setPngFile] = useState<{ url: string; name: string } | null>(null);
  const pngUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    pngUrlRef.current = null;
    setPngFile(null);
  }, [shot, pose, renderBackground, draft]);
  useEffect(
    () => () => {
      if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    },
    []
  );

  // Unsaved changes: warn on reload or closing the tab, and ask before any link leaves the builder.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmLinks = (event: globalThis.MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null | undefined;
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm(UNSAVED_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", confirmLinks, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", confirmLinks, true);
    };
  }, [dirty]);

  const update = useCallback((patch: Partial<AvatarDesign>) => setDraft((current) => ({ ...current, ...patch })), []);

  const save = useMutation({
    mutationFn: async (variables: Snapshot) => {
      if (!accessToken || !csrfToken) throw new Error("Sign in to save your avatar.");
      const label = variables.name.trim() || "My avatar";
      if (presetId) {
        await saveLook(accessToken, csrfToken, presetId, label, variables.design);
        return { id: presetId, created: false, label, design: variables.design };
      }
      const created = await createLook(accessToken, csrfToken, label, variables.design);
      return { id: created.id, created: true, label, design: variables.design };
    },
    onSuccess: async (result) => {
      setBaseline({ name: result.label, design: result.design });
      setNotice({ tone: "ok", text: "Avatar saved to your account." });
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
      if (result.created) router.replace(`/app/avatars/${result.id}`);
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const saveCopy = useMutation({
    mutationFn: async () => {
      if (!accessToken || !csrfToken) throw new Error("Sign in to save your avatar.");
      return createLook(accessToken, csrfToken, `${(name.trim() || "My avatar").slice(0, 32)} copy`, draft);
    },
    onSuccess: async (preset) => {
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
      router.push(`/app/avatars/${preset.id}`);
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  /** Cancel: revert the draft to the saved state. A new avatar with changes asks first, then goes back to the list. */
  const cancel = () => {
    if (presetId) {
      if (dirty && !window.confirm("Discard your unsaved changes?")) return;
      setDraft(baseline.design);
      setName(baseline.name);
      setNotice(null);
      return;
    }
    if (dirty && !window.confirm("Discard this new avatar?")) return;
    router.push("/app/avatars");
  };

  /** Renders the figure to a PNG blob, at the chosen shot, pose and background. */
  const renderPng = async (target: ViewerShot, background: "studio" | "night" | "transparent") => {
    const capture = captureRef.current;
    if (!capture) throw new Error("The 3D view is still loading. Try again in a moment.");
    return capture({ shot: target, pose, background, ...RENDER_SIZES[target] });
  };
  /**
   * Renders the picture for the Save PNG link. The download itself is a plain link click, so the browser
   * always treats it as the person's own download; a script click after a slow render can be blocked.
   */
  const preparePng = async () => {
    setRenderNote("Rendering…");
    try {
      const blob = await renderPng(shot, renderBackground);
      const url = URL.createObjectURL(blob);
      if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
      pngUrlRef.current = url;
      const slug = (name.trim() || "avatar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "avatar";
      setPngFile({ url, name: `${slug}-${shot}.png` });
      setRenderNote("Ready. Press Save PNG to download it.");
    } catch (error) {
      setRenderNote(error instanceof Error ? error.message : "The picture could not be created.");
    }
  };
  /** Uploads a portrait of the saved look and stores it on the avatar, for the gallery and profile. */
  const saveAsPicture = async () => {
    if (!presetId) {
      setRenderNote("Save the avatar first, then use it as your profile picture.");
      return;
    }
    if (dirty) {
      setRenderNote("Save changes first, so the picture matches the saved look.");
      return;
    }
    if (!accessToken || !csrfToken) {
      setRenderNote("Sign in to save your profile picture.");
      return;
    }
    setPictureBusy(true);
    setRenderNote("Creating your profile picture…");
    try {
      const blob = await renderPng("portrait", renderBackground === "transparent" ? "studio" : renderBackground);
      await uploadPortrait(accessToken, csrfToken, presetId, blob);
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
      setRenderNote("Profile picture saved. It now shows in your gallery.");
    } catch (error) {
      setRenderNote(error instanceof Error ? error.message : getApiErrorMessage(error));
    } finally {
      setPictureBusy(false);
    }
  };

  const lockedNow = useMemo(() => lockedPartsIn(draft, owned), [draft, owned]);

  const onLocked = (option: PartOption) => setHint(`${option.label} is locked. Buy it in the Wardrobe to wear it.`);

  /** Single-choice parts: the option id is written to its field. */
  /** Wears a part in the draft and remembers it for Recently used. An option the account does not own is refused, as in the grids. */
  const wear = (pick: RecentPick) => {
    const option = PART_OPTIONS[pick.category].find((entry) => entry.id === pick.id);
    if (option?.catalogKey && !owned.has(option.catalogKey)) {
      onLocked(option);
      return;
    }
    setRecent((current) => remember(current, pick));
    switch (pick.category) {
      case "hair": update({ hair: pick.id as HairStyle }); break;
      case "top": update({ top: pick.id as TopStyle }); break;
      case "outer": update({ outer: pick.id as OuterStyle }); break;
      case "bottom": update({ bottom: pick.id as BottomStyle }); break;
      case "shoes": update({ shoes: pick.id as ShoeStyle }); break;
      case "accessory": setDraft((current) => ({ ...current, accessories: toggleAccessory(current.accessories, pick.id as Accessory) })); break;
    }
  };
  /** Whether the draft currently wears this option. */
  const isWorn = (category: PartCategory, id: string): boolean => {
    switch (category) {
      case "hair": return draft.hair === id;
      case "top": return draft.top === id;
      case "outer": return draft.outer === id;
      case "bottom": return draft.bottom === id;
      case "shoes": return draft.shoes === id;
      case "accessory": return draft.accessories.includes(id as Accessory);
      default: return false;
    }
  };
  const pickFor = (category: PartCategory) => (id: string) => wear({ category, id, label: labelOf(category, id) });

  // The status line: what is saved, what is not, and what needs attention.
  const status = notice
    ? notice.text
    : presetId
      ? dirty
        ? "Unsaved changes"
        : "All changes saved"
      : dirty
        ? "Unsaved changes"
        : "Not saved yet";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-xs text-slate-300">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Avatar name</span>
          <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={cancel} className={chip(false)}>Cancel</button>
          {presetId ? (
            <button type="button" onClick={() => saveCopy.mutate()} disabled={saveCopy.isPending} className={`${chip(false)} disabled:opacity-50`}>Save as new</button>
          ) : null}
          <button
            type="button"
            onClick={() => save.mutate({ name, design: draft })}
            disabled={(presetId !== null && !dirty) || save.isPending}
            className="rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : presetId ? "Save changes" : "Save avatar"}
          </button>
        </div>
        <p role="status" aria-live="polite" className={`w-full text-[11px] ${notice?.tone === "error" ? "text-rose-200" : notice ? "text-emerald-200" : "text-slate-400"}`}>{status}</p>
      </div>

      {retiredParts.length ? (
        <p role="note" className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Some parts of this saved look no longer exist, so they show their defaults: {retiredParts.join(", ")}. Save to keep the defaults.
        </p>
      ) : null}
      {lockedNow.length ? (
        <p role="status" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          This design uses parts you do not own yet: {lockedNow.join(", ")}. Saving is refused until you own them, so pick another part or buy it in the{" "}
          <Link href="/app/wardrobe" className="underline">Wardrobe</Link>.
        </p>
      ) : null}
      {hint ? (
        <p role="status" className="text-xs text-slate-300">
          {hint} <Link href="/app/wardrobe" className="underline">Open the Wardrobe</Link>
        </p>
      ) : null}
      {accessToken && ownershipQuery.isLoading ? <p className="text-[11px] text-slate-500">Checking what you own…</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px_300px]">
        {/* Categories: one row across the studio, scrolling on narrow screens. */}
        <nav aria-label="Avatar categories" className="flex gap-2 overflow-x-auto pb-1 xl:col-span-3">
          {CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={category === entry.id}
              onClick={() => {
                setCategory(entry.id);
                setQuery("");
                setFilter("all");
                setHint(null);
              }}
              className={`shrink-0 whitespace-nowrap rounded-xl border px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] ${category === entry.id ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/10 bg-[#0d1119] text-slate-300 hover:border-white/30"}`}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        {/* The figure: the middle column on desktop, first on phones. */}
        <div className="order-1 space-y-3 xl:order-none xl:col-start-2 xl:row-start-2">
          <AvatarViewer design={draft} autoRotate={spin} background={background} pose={pose} emote={emote} captureRef={captureRef} className="h-[52vh] min-h-[340px] w-full lg:h-[64vh]" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={spin} onClick={() => setSpin((v) => !v)} className={chip(spin)}>Auto turn</button>
              {(["studio", "night", "transparent"] as const).map((id) => (
                <button key={id} type="button" aria-pressed={background === id} onClick={() => setBackground(id)} className={chip(background === id)}>
                  {id === "transparent" ? "Clear" : id === "night" ? "Night" : "Studio"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDraft(randomDesign(owned))} className={`${chip(false)} inline-flex items-center gap-1.5`}>
                <Shuffle className="h-3.5 w-3.5" /> Randomise
              </button>
              <button type="button" onClick={() => setDraft(DEFAULT_DESIGN)} className={`${chip(false)} inline-flex items-center gap-1.5`}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset look
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Drag to turn. Scroll or pinch to zoom. Use the buttons under the figure for front, side, back and reset.
            {reduced ? " Reduced motion is on, so auto-turn and idle motion are off." : ""}
          </p>
          <div className="vx-panel space-y-3 rounded-2xl p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pose</p>
                <div className="flex flex-wrap gap-2">
                  {POSE_CHOICES.map((choice) => (
                    <button key={choice.id} type="button" aria-pressed={pose === choice.id} onClick={() => setPose(choice.id)} className={chip(pose === choice.id)}>{choice.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Camera</p>
                <div className="flex flex-wrap gap-2">
                  {SHOT_CHOICES.map((choice) => (
                    <button key={choice.id} type="button" aria-pressed={shot === choice.id} onClick={() => setShot(choice.id)} className={chip(shot === choice.id)}>{choice.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Render background</p>
                <div className="flex flex-wrap gap-2">
                  {RENDER_BACKGROUNDS.map((choice) => (
                    <button key={choice.id} type="button" aria-pressed={renderBackground === choice.id} onClick={() => setRenderBackground(choice.id)} className={chip(renderBackground === choice.id)}>{choice.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void preparePng()} className={chip(false)}>Prepare PNG</button>
              {pngFile ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pngFile.url} alt="Preview of the prepared PNG" className="h-16 w-auto rounded-md border border-white/10 bg-[#0b1220] object-contain" />
                  <a href={pngFile.url} download={pngFile.name} className={chip(true)}>Save PNG</a>
                </>
              ) : null}
              <button type="button" onClick={() => void saveAsPicture()} disabled={pictureBusy || !presetId} className={`${chip(false)} disabled:opacity-40`}>
                {pictureBusy ? "Working…" : "Use as profile picture"}
              </button>
              {renderNote ? <p role="status" aria-live="polite" className="text-[11px] text-slate-300">{renderNote}</p> : null}
            </div>
          </div>
          <OwnedInventory onWear={wear} />
        </div>

        {/* Controls for the chosen category: the catalog column on desktop. */}
        <div className="order-2 vx-panel max-h-[80vh] space-y-5 overflow-y-auto rounded-2xl p-4 xl:order-none xl:col-start-1 xl:row-start-2">
          {category === "body" ? (
            <Chips label="Body size" options={BODY_TYPES} value={draft.body} onPick={(body) => update({ body })} />
          ) : null}

          {category === "skin" ? (
            <Swatches label="Skin tone" colours={SKIN_TONES} value={draft.skin} onPick={(skin) => update({ skin })} />
          ) : null}

          {category === "face" ? (
            <>
              <Chips label="Eye style" options={EYE_STYLES} value={draft.eyeStyle} onPick={(eyeStyle) => update({ eyeStyle })} />
              <Swatches label="Eye colour" colours={PALETTE} value={draft.eyeColor} onPick={(eyeColor) => update({ eyeColor })} />
            </>
          ) : null}

          {category === "hair" ? (
            <>
              <FilterBar label="Hair" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
              <OptionGrid options={PART_OPTIONS.hair} isSelected={(id) => isWorn("hair", id)} ownership={ownership} query={query} filter={filter} onPick={pickFor("hair")} onLocked={onLocked} />
              <Swatches label="Hair colour" colours={PALETTE} value={draft.hairColor} onPick={(hairColor) => update({ hairColor })} />
            </>
          ) : null}

          {category === "head" ? (
            <>
              <FilterBar label="Head" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
              <OptionGrid options={headwear(PART_OPTIONS.accessory)} isSelected={(id) => isWorn("accessory", id)} ownership={ownership} query={query} filter={filter} onPick={pickFor("accessory")} onLocked={onLocked} />
              <p className="text-[11px] text-slate-500">Hats and caps replace each other, so the last pick shows.</p>
            </>
          ) : null}

          {category === "tops" ? (
            <>
              <FilterBar label="Tops" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
              <OptionGrid options={topsWithoutHoodies(PART_OPTIONS.top)} isSelected={(id) => isWorn("top", id)} ownership={ownership} query={query} filter={filter} onPick={pickFor("top")} onLocked={onLocked} />
              <Swatches label="Top colour" colours={PALETTE} value={draft.topColor} onPick={(topColor) => update({ topColor })} />
            </>
          ) : null}

          {category === "hoodies" ? (
            <>
              <FilterBar label="Hoodies" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
              <OptionGrid options={onlyHoodies(PART_OPTIONS.top)} isSelected={(id) => isWorn("top", id)} ownership={ownership} query={query} filter={filter} onPick={pickFor("top")} onLocked={onLocked} />
              <Swatches label="Hoodie colour" colours={PALETTE} value={draft.topColor} onPick={(topColor) => update({ topColor })} />
            </>
          ) : null}

          {category === "jackets" ? (
            <>
              <FilterBar label="Jackets" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
              <OptionGrid options={PART_OPTIONS.outer} isSelected={(id) => isWorn("outer", id)} ownership={ownership} query={query} filter={filter} onPick={pickFor("outer")} onLocked={onLocked} />
              <Swatches label="Jacket colour" colours={PALETTE} value={draft.outerColor} onPick={(outerColor) => update({ outerColor })} />
            </>
          ) : null}

          {category === "pants" ? (
            <>
              <FilterBar label="Pants" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
              <OptionGrid options={PART_OPTIONS.bottom} isSelected={(id) => isWorn("bottom", id)} ownership={ownership} query={query} filter={filter} onPick={pickFor("bottom")} onLocked={onLocked} />
              <Swatches label="Pants colour" colours={PALETTE} value={draft.bottomColor} onPick={(bottomColor) => update({ bottomColor })} />
            </>
          ) : null}

          {category === "shoes" ? (
            <>
              <FilterBar label="Shoes" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
              <OptionGrid options={PART_OPTIONS.shoes} isSelected={(id) => isWorn("shoes", id)} ownership={ownership} query={query} filter={filter} onPick={pickFor("shoes")} onLocked={onLocked} />
              <Swatches label="Shoe colour" colours={PALETTE} value={draft.shoeColor} onPick={(shoeColor) => update({ shoeColor })} />
            </>
          ) : null}

          {category === "armor" ? (
            <div className="space-y-5">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Armour and futuristic parts are paid. Each one stays locked until you own it, and the Wardrobe sells them.
              </p>
              {([
                { label: "Jackets", category: "outer" },
                { label: "Pants", category: "bottom" },
                { label: "Shoes", category: "shoes" },
                { label: "Accessories", category: "accessory" },
              ] as const).map((section) => {
                const options = armorOptions(section.category, PART_OPTIONS[section.category]);
                if (!options.length) return null;
                return (
                  <div key={section.category} className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{section.label}</p>
                    <OptionGrid options={options} isSelected={(id) => isWorn(section.category, id)} ownership={ownership} query="" filter="all" onPick={pickFor(section.category)} onLocked={onLocked} />
                  </div>
                );
              })}
            </div>
          ) : null}

          {category === "emotes" ? <EmotePanel onPreview={previewEmote} /> : null}

          {category === "accessories" ? (
            <>
              <div role="group" aria-label="Accessory group" className="flex flex-wrap gap-1.5">
                {ACCESSORY_TABS.map((entry) => (
                  <button key={entry.id} type="button" aria-pressed={accessoryTab === entry.id} onClick={() => setAccessoryTab(entry.id)} className={chip(accessoryTab === entry.id)}>{entry.label}</button>
                ))}
              </div>
              <FilterBar label="Accessories" query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} />
              <OptionGrid
                options={otherAccessories(PART_OPTIONS.accessory).filter((option) => accessoryTab === "all" || option.group === accessoryTab)}
                isSelected={(id) => isWorn("accessory", id)}
                ownership={ownership}
                query={query}
                filter={filter}
                onPick={pickFor("accessory")}
                onLocked={onLocked}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">Pick any that fit together. Hats and eyewear replace each other, so the last pick shows.</p>
                <button type="button" onClick={() => update({ accessories: [] })} disabled={draft.accessories.length === 0} className={`${chip(false)} disabled:opacity-40`}>Clear accessories</button>
              </div>
            </>
          ) : null}

          {category === "outfits" ? (
            <div className="space-y-3">
              <p className="text-[11px] leading-relaxed text-slate-500">A preset replaces your draft. Press Save to keep it. Presets use free parts, so every account can wear them.</p>
              {DESIGN_PRESETS.map((preset) => (
                <div key={preset.id} className="rounded-xl border border-white/10 bg-[#0d1119] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{preset.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{preset.tagline}</p>
                    </div>
                    <button type="button" onClick={() => setDraft(preset.design)} className={chip(false)}>Use preset</button>
                  </div>
                  <div className="mt-2 flex gap-1.5" aria-hidden="true">
                    {[preset.design.hairColor, preset.design.topColor, preset.design.outerColor, preset.design.bottomColor, preset.design.shoeColor, preset.design.accent].map((hex, index) => (
                      <span key={index} className="h-4 w-4 rounded-full border border-white/10" style={{ backgroundColor: hex }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {category === "outfits" ? (
            <SavedLooksPanel
              looks={looks}
              maxLooks={maxLooks}
              mainId={mainId}
              draftName={name}
              draftDesign={draft}
              onNotice={setNotice}
            />
          ) : null}
        </div>

        {/* Right column: what is worn, colour accents, ownership key, saved outfits, recent parts and the profile card. */}
        <aside aria-label="Current selections and profile" className="order-3 space-y-4 xl:order-none xl:col-start-3 xl:row-start-2">
          <CurrentSelections design={draft} owned={owned} />
          <section aria-labelledby="colour-accents-heading" className="vx-panel space-y-4 rounded-2xl p-4">
            <h2 id="colour-accents-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Colour accents</h2>
            {COLOUR_FIELDS.filter((entry) => !["skin", "hairColor", "eyeColor", "topColor", "outerColor", "bottomColor", "shoeColor"].includes(entry.field)).map((entry) => (
              <Swatches
                key={entry.field}
                label={entry.label}
                help={entry.help}
                colours={PALETTE}
                value={draft[entry.field]}
                onPick={(hex) => update({ [entry.field]: hex } as Partial<AvatarDesign>)}
              />
            ))}
            <Chips label="Finish" options={MATERIAL_STYLES} value={draft.material} onPick={(material) => update({ material })} />
            <p className="text-[11px] leading-relaxed text-slate-500">The finish applies to base tops, outerwear, bottoms and shoes: matte is dull, satin soft, gloss shiny and metallic reflective.</p>
          </section>
          <OwnershipLegend />
          <SavedOutfitsSummary looks={looks} maxLooks={maxLooks} mainId={mainId} />
          <RecentlyUsed recent={recent} onWear={wear} />
          <ProfileCard user={user} />
        </aside>
      </div>
    </div>
  );
}
