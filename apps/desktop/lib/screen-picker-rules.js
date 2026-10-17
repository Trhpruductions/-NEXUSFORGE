"use strict";

// Rules for the screen-share picker. No Electron here, so they can be tested directly.
// The picker offers every screen and every titled window. A choice is accepted only if it is one of the ids that were
// offered to that picker, so a page cannot ask for a source it was never shown.

/** Kind of a desktopCapturer source, from its id ("screen:..." or "window:..."). */
function sourceKind(id) {
  if (typeof id !== "string") return null;
  if (id.startsWith("screen:")) return "screen";
  if (id.startsWith("window:")) return "window";
  return null;
}

/**
 * The list shown in the picker: screens first (the main screen first, then in the order Windows reports them, labelled
 * "Screen 1", "Screen 2"...), then windows that have a title. Untitled windows are background helpers and are left out.
 */
function describeSources(sources, primaryDisplayId) {
  const screens = [];
  const windows = [];
  for (const source of Array.isArray(sources) ? sources : []) {
    const kind = sourceKind(source && source.id);
    if (kind === "screen") screens.push(source);
    else if (kind === "window" && typeof source.name === "string" && source.name.trim() !== "") windows.push(source);
  }
  const primary = String(primaryDisplayId ?? "");
  screens.sort((a, b) => Number(String(b.display_id) === primary) - Number(String(a.display_id) === primary));
  const single = screens.length === 1;
  return [
    ...screens.map((source, index) => ({
      id: source.id,
      kind: "screen",
      primary: String(source.display_id) === primary,
      name: single ? "Entire screen" : `Screen ${index + 1}${String(source.display_id) === primary ? " (main)" : ""}`,
    })),
    ...windows.map((source) => ({ id: source.id, kind: "window", primary: false, name: source.name.trim().slice(0, 120) })),
  ];
}

/** The chosen id, if it is one of the offered ids; otherwise null. */
function resolveChoice(offeredIds, chosenId) {
  if (typeof chosenId !== "string" || chosenId.length === 0 || chosenId.length > 200) return null;
  return offeredIds.includes(chosenId) ? chosenId : null;
}

module.exports = { sourceKind, describeSources, resolveChoice };
