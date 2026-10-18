/**
 * Hidden NFG easter eggs: harmless surprises with no effect on the account, settings or other people. Triggers are
 * deterministic (so they can be tested), ignore keys typed into fields (so chat and inputs are never affected), and
 * each egg has a cooldown. Discoveries are remembered on this device per account and are never sent anywhere.
 */

export const EGG_IDS = ["forge-spark", "neon-overdrive"] as const;
export type EggId = (typeof EGG_IDS)[number];

export const EGGS: Record<EggId, { name: string; hint: string }> = {
  "forge-spark": { name: "Forge Spark", hint: "Strike the forge a few times in a row." },
  "neon-overdrive": { name: "Neon Overdrive", hint: "A classic code, typed anywhere outside a text box." },
};

/** The classic arrow-key code, ending in B then A. */
export const NEON_SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/** Matches a key sequence. feed() returns true exactly when the last keys complete it. */
export function createSequenceMatcher(sequence: string[]) {
  let position = 0;
  return {
    feed(key: string): boolean {
      const normalized = key.length === 1 ? key.toLowerCase() : key;
      if (normalized === sequence[position]) {
        position += 1;
      } else {
        // Restart, but let this key begin a new attempt.
        position = normalized === sequence[0] ? 1 : 0;
      }
      if (position === sequence.length) {
        position = 0;
        return true;
      }
      return false;
    },
    reset() {
      position = 0;
    },
  };
}

/** Counts quick repeated hits: hit() returns true when `count` hits land within `windowMs`. */
export function createBurstCounter({ count, windowMs }: { count: number; windowMs: number }) {
  let hits: number[] = [];
  return {
    hit(now: number): boolean {
      hits = hits.filter((at) => now - at < windowMs);
      hits.push(now);
      if (hits.length >= count) {
        hits = [];
        return true;
      }
      return false;
    },
  };
}

/** Keys typed into text fields never count toward a sequence. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  const element = target as HTMLElement;
  return Boolean(element.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox']"));
}

const storageKey = (userId: string) => `nf-eggs:${userId}`;

export function discoveredEggs(userId: string | null): EggId[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is EggId => (EGG_IDS as readonly string[]).includes(id)) : [];
  } catch {
    return [];
  }
}

/** Records a discovery for this account on this device. Returns true the first time. */
export function markDiscovered(userId: string | null, egg: EggId): boolean {
  if (!userId || typeof window === "undefined") return false;
  const found = discoveredEggs(userId);
  if (found.includes(egg)) return false;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...found, egg]));
  } catch {
    // Storage blocked: the egg still plays, it just is not remembered.
  }
  return true;
}
