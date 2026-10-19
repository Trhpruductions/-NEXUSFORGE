/**
 * Keyboard focus for modal dialogs: focus moves into a dialog when it opens, Tab and Shift+Tab stay inside it,
 * Escape closes it, and focus goes back to where it was when it closes.
 *
 * Plain DOM with no React, so it can be unit tested; use-dialog-focus.ts wires it to a component. Everything goes
 * through the dialog's own document (element.ownerDocument), never the global one: some panels render into popout
 * windows through React portals, and keys pressed there never reach the main window. For the same reason nothing here
 * uses instanceof HTMLElement (each window has its own HTMLElement class).
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "iframe",
  "summary",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]",
].join(",");

/** Has a box on screen (display:none, a closed <details> or a hidden breakpoint variant have none). */
function isVisible(element: Element): boolean {
  return typeof element.getClientRects === "function" ? element.getClientRects().length > 0 : true;
}

function isRadio(element: Element): element is HTMLInputElement {
  return element.tagName === "INPUT" && (element as HTMLInputElement).type === "radio" && Boolean((element as HTMLInputElement).name);
}

/** The body or <html>: focus that is "nowhere in particular". */
function isDocumentLevel(element: Element): boolean {
  const doc = element.ownerDocument;
  return Boolean(doc && (element === doc.body || element === doc.documentElement));
}

/**
 * Which of these candidates Tab can actually land on, in order. Leaves out disabled controls, negative tabindex,
 * anything not on screen or inside an inert subtree, and every radio button of a group except the one Tab stops at
 * (the checked one, or the first when none is checked).
 */
export function tabbableAmong(candidates: HTMLElement[]): HTMLElement[] {
  const tabbable = candidates.filter((element) => {
    if ((element as HTMLButtonElement).disabled === true) return false;
    const tabindex = element.getAttribute("tabindex");
    if (tabindex !== null && tabindex.trim() !== "" && Number(tabindex) < 0) return false;
    if (typeof element.closest === "function" && element.closest("[inert]")) return false;
    return isVisible(element);
  });
  return tabbable.filter((element) => {
    if (!isRadio(element)) return true;
    const group = tabbable.filter((other) => isRadio(other) && other.name === element.name && other.form === element.form) as HTMLInputElement[];
    const checked = group.find((radio) => radio.checked);
    return checked ? checked === element : group[0] === element;
  });
}

/** Everything inside the container that Tab can land on, in document order. */
export function tabbableElements(container: HTMLElement): HTMLElement[] {
  return tabbableAmong(Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)));
}

/**
 * Where Tab (or Shift+Tab when backwards) should go to stay inside the dialog, or null to let the browser move focus
 * as usual. Wraps from the last element to the first and back; with nothing focusable inside, focus stays on the
 * dialog itself. Focus somewhere else outside the dialog (a popover it opened in a portal) is left alone.
 */
export function nextTabTarget(container: HTMLElement, tabbable: HTMLElement[], active: Element | null, backwards: boolean): HTMLElement | null {
  if (!tabbable.length) return container;
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  const inside = Boolean(active && active !== container && container.contains(active));
  if (!inside) {
    if (!active || active === container || isDocumentLevel(active)) return backwards ? last : first;
    return null;
  }
  if (backwards && active === first) return last;
  if (!backwards && active === last) return first;
  return null;
}

function focus(element: HTMLElement | null | undefined) {
  if (!element || typeof element.focus !== "function") return;
  try {
    element.focus();
  } catch {
    // An element in a window that just closed.
  }
}

/**
 * How high a dialog sits on screen: the z-index of its outermost positioned ancestor below <body>. Dialogs portalled
 * to the body carry their own (z-[1100], z-[1200]...); dialogs drawn inside the page share the app root's stacking
 * context, so they rank below every portalled one, as they look.
 */
function stackLevel(element: HTMLElement): number {
  const view = element.ownerDocument.defaultView;
  if (!view || typeof view.getComputedStyle !== "function") return 0;
  let level = 0;
  for (let node: HTMLElement | null = element; node && node !== element.ownerDocument.body; node = node.parentElement) {
    const z = Number.parseInt(view.getComputedStyle(node).zIndex, 10);
    if (!Number.isNaN(z)) level = z;
  }
  return level;
}

/** restoreTo: what had focus when the dialog opened, focused again when it closes. */
type OpenDialog = { container: HTMLElement; doc: Document; level: number; order: number; restoreTo: HTMLElement | null };
const openDialogs: OpenDialog[] = [];
let opened = 0;

/**
 * The dialog that handles keys in this document: the visible one drawn on top (highest stack level, then the most
 * recently opened). Only it reacts, so Escape closes one dialog at a time, and focus is never trapped in a dialog
 * that another one covers (the policy prompt and "What's new" can both open when the app loads).
 */
function topmostIn(doc: Document): OpenDialog | null {
  let top: OpenDialog | null = null;
  for (const entry of openDialogs) {
    if (entry.doc !== doc || !isVisible(entry.container)) continue;
    if (!top || entry.level > top.level || (entry.level === top.level && entry.order > top.order)) top = entry;
  }
  return top;
}

export type DialogFocusOptions = {
  /** Called on Escape. Leave it out for a dialog that can't be dismissed. */
  onEscape?: (() => void) | null;
  /** What to focus first; otherwise an element marked data-autofocus, then the first tabbable element, then the dialog. */
  initialFocus?: () => HTMLElement | null | undefined;
};

/**
 * Starts focus handling for an open dialog and returns the function that ends it (call it when the dialog closes or
 * unmounts). The container should have tabIndex={-1} so it can hold focus when nothing inside can.
 */
export function activateDialog(container: HTMLElement, options: DialogFocusOptions = {}): () => void {
  const doc = container.ownerDocument;
  const entry: OpenDialog = { container, doc, level: stackLevel(container), order: (opened += 1), restoreTo: doc.activeElement as HTMLElement | null };
  openDialogs.push(entry);

  // A dialog that opens underneath another one waits for its turn instead of pulling focus behind it.
  const alreadyInside = Boolean(doc.activeElement && container.contains(doc.activeElement));
  if (!alreadyInside && topmostIn(doc) === entry) {
    const target = options.initialFocus?.() ?? container.querySelector<HTMLElement>("[data-autofocus]") ?? tabbableElements(container)[0] ?? container;
    focus(target);
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || topmostIn(doc) !== entry) return;
    if (event.key === "Escape") {
      options.onEscape?.();
      return;
    }
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    // (A dialog hidden at this window size, like the phone navigation drawer on a wide window, is never topmost.)
    const target = nextTabTarget(container, tabbableElements(container), doc.activeElement, event.shiftKey);
    if (!target) return;
    event.preventDefault();
    focus(target);
  };
  doc.addEventListener("keydown", onKeyDown);

  return () => {
    doc.removeEventListener("keydown", onKeyDown);
    const index = openDialogs.indexOf(entry);
    if (index >= 0) openDialogs.splice(index, 1);
    // Dialogs that opened while this one had focus remember an element inside it; they go back to what this one
    // remembered instead.
    for (const other of openDialogs) {
      if (other.doc === doc && other.restoreTo && container.contains(other.restoreTo)) other.restoreTo = entry.restoreTo;
    }
    // Put focus back, unless the person already moved it somewhere else on purpose. If another dialog is still open
    // and what had focus before isn't in it, focus goes into that dialog instead (it holds the keyboard now).
    const active = doc.activeElement;
    const focusWasInDialog = !active || isDocumentLevel(active) || container.contains(active);
    if (!focusWasInDialog) return;
    const next = topmostIn(doc);
    const previous = entry.restoreTo;
    const canRestore = Boolean(previous && !isDocumentLevel(previous) && previous.isConnected && !container.contains(previous));
    if (previous && canRestore && (!next || next.container.contains(previous))) focus(previous);
    else if (next) focus(tabbableElements(next.container)[0] ?? next.container);
  };
}
