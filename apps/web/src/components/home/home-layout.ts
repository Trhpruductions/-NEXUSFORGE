import type { HomePreferences, HomeWidgetId } from "@/lib/api";
import { JACKPOT_ENABLED } from "@/lib/held-features";

export type HomeColumn = "main" | "side";

/** Every Home widget, in default order. `defaultVisible: false` ones are opt-in extras. */
const ALL_HOME_WIDGETS: Array<{ id: HomeWidgetId; label: string; column: HomeColumn; defaultVisible: boolean }> = [
  { id: "hero", label: "Forge banner", column: "main", defaultVisible: true },
  { id: "stats", label: "Forge stats", column: "main", defaultVisible: true },
  { id: "event", label: "Featured event", column: "main", defaultVisible: true },
  { id: "activity", label: "Recent activity", column: "main", defaultVisible: true },
  { id: "creators", label: "Top creators", column: "main", defaultVisible: true },
  { id: "live", label: "Live now", column: "side", defaultVisible: true },
  { id: "shop", label: "Shop", column: "side", defaultVisible: true },
  { id: "actions", label: "Quick actions", column: "side", defaultVisible: true },
  { id: "posts", label: "Latest posts", column: "side", defaultVisible: false },
  { id: "jackpot", label: "Hourly jackpot", column: "side", defaultVisible: false },
];

// The jackpot widget is hidden while its feature is on hold. A saved layout that mentions it is cleaned up the same way.
export const HOME_WIDGETS = ALL_HOME_WIDGETS.filter((widget) => widget.id !== "jackpot" || JACKPOT_ENABLED);

export type HomeLayoutItem = { id: HomeWidgetId; visible: boolean };

export const DEFAULT_LAYOUT: HomeLayoutItem[] = HOME_WIDGETS.map((w) => ({ id: w.id, visible: w.defaultVisible }));

/**
 * The saved layout, cleaned up: unknown ids dropped, duplicates removed, and any widget
 * the saved list doesn't mention (e.g. one added in a later release) appended with its
 * default visibility.
 */
export function resolveLayout(saved: HomePreferences | undefined | null): HomeLayoutItem[] {
  const known = new Set(HOME_WIDGETS.map((w) => w.id));
  const seen = new Set<HomeWidgetId>();
  const items: HomeLayoutItem[] = [];
  for (const item of saved?.widgets ?? []) {
    if (!known.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push({ id: item.id, visible: item.visible });
  }
  for (const widget of DEFAULT_LAYOUT) if (!seen.has(widget.id)) items.push(widget);
  return items;
}

export function columnOf(id: HomeWidgetId): HomeColumn {
  return HOME_WIDGETS.find((w) => w.id === id)?.column ?? "main";
}

export function labelOf(id: HomeWidgetId): string {
  return HOME_WIDGETS.find((w) => w.id === id)?.label ?? id;
}

/** Moves a widget one place up/down among the widgets of its own column. */
export function moveWithinColumn(layout: HomeLayoutItem[], id: HomeWidgetId, direction: -1 | 1): HomeLayoutItem[] {
  const column = columnOf(id);
  const indexes = layout.map((item, i) => (columnOf(item.id) === column ? i : -1)).filter((i) => i >= 0);
  const position = indexes.findIndex((i) => layout[i].id === id);
  const target = position + direction;
  if (position < 0 || target < 0 || target >= indexes.length) return layout;
  const next = [...layout];
  [next[indexes[position]], next[indexes[target]]] = [next[indexes[target]], next[indexes[position]]];
  return next;
}
