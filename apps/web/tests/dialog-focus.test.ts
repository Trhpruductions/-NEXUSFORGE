import { test } from "node:test";
import assert from "node:assert/strict";
import { activateDialog, nextTabTarget, tabbableAmong, tabbableElements } from "../src/lib/dialog-focus";

/**
 * A very small stand-in for the DOM: just what dialog-focus.ts touches (tree, attributes, focus, visibility, keydown
 * listeners on the document). Each FakeDocument plays one window, so popouts are a second document.
 */
type KeyEvent = { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; defaultPrevented: boolean; preventDefault: () => void };

class FakeDocument {
  activeElement: FakeElement | null = null;
  /** Inline z-index per element, as getComputedStyle reports it. */
  readonly defaultView = { getComputedStyle: (element: FakeElement) => ({ zIndex: element.zIndex }) };
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  private listeners = new Set<(event: KeyEvent) => void>();
  constructor() {
    this.documentElement = new FakeElement(this, "HTML");
    this.body = new FakeElement(this, "BODY");
    this.documentElement.append(this.body);
    this.activeElement = this.body;
  }
  addEventListener(type: string, listener: (event: KeyEvent) => void) {
    if (type === "keydown") this.listeners.add(listener);
  }
  removeEventListener(type: string, listener: (event: KeyEvent) => void) {
    if (type === "keydown") this.listeners.delete(listener);
  }
  get listenerCount() {
    return this.listeners.size;
  }
  key(key: string, shiftKey = false): KeyEvent {
    const event: KeyEvent = { key, shiftKey, altKey: false, ctrlKey: false, metaKey: false, defaultPrevented: false, preventDefault: () => (event.defaultPrevented = true) };
    for (const listener of [...this.listeners]) listener(event);
    // What the browser does with an unhandled Tab is not simulated: tests check where the trap sends focus.
    return event;
  }
}

const NATURALLY_FOCUSABLE = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "IFRAME", "SUMMARY"]);

/** The element and its ancestors, nearest first. */
function selfAndAncestors(element: FakeElement): FakeElement[] {
  const chain: FakeElement[] = [];
  for (let node: FakeElement | null = element; node; node = node.parent) chain.push(node);
  return chain;
}

class FakeElement {
  parent: FakeElement | null = null;
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  hiddenBox = false;
  zIndex = "auto";
  disabled?: boolean;
  type?: string;
  name?: string;
  checked?: boolean;
  form: null = null;
  constructor(
    public ownerDocument: FakeDocument,
    public tagName: string,
    attributes: Record<string, string> = {},
    props: Partial<Pick<FakeElement, "disabled" | "type" | "name" | "checked" | "hiddenBox">> = {},
  ) {
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
    Object.assign(this, props);
  }
  append(...children: FakeElement[]) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
    return this;
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  get parentElement() {
    return this.parent;
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  focus() {
    if (this.getClientRects().length) this.ownerDocument.activeElement = this;
  }
  get isConnected(): boolean {
    const chain = selfAndAncestors(this);
    return chain[chain.length - 1] === this.ownerDocument.documentElement;
  }
  /** No box when this or an ancestor is display:none, or when it's not in the page. */
  getClientRects() {
    if (selfAndAncestors(this).some((node) => node.hiddenBox)) return [];
    return this.isConnected ? [{}] : [];
  }
  contains(other: unknown) {
    for (let node = other as FakeElement | null; node; node = node.parent) if (node === this) return true;
    return false;
  }
  closest(selector: string) {
    const attribute = selector.replace(/^\[|\]$/g, "");
    return selfAndAncestors(this).find((node) => node.hasAttribute(attribute)) ?? null;
  }
  private descendants(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  /** Supports "[attr]" and the focusable-candidates selector dialog-focus.ts uses. */
  querySelectorAll(selector: string) {
    if (/^\[[\w-]+\]$/.test(selector)) return this.descendants().filter((node) => node.hasAttribute(selector.slice(1, -1)));
    return this.descendants().filter(
      (node) => NATURALLY_FOCUSABLE.has(node.tagName) || (node.tagName === "A" && node.hasAttribute("href")) || node.hasAttribute("tabindex") || node.hasAttribute("contenteditable"),
    );
  }
}

const el = (doc: FakeDocument, tag: string, attributes?: Record<string, string>, props?: ConstructorParameters<typeof FakeElement>[3]) => new FakeElement(doc, tag, attributes, props);
const asHtml = (element: FakeElement) => element as unknown as HTMLElement;
const asHtmlList = (elements: FakeElement[]) => elements as unknown as HTMLElement[];

/** A page with a trigger button and a dialog holding a close button, a text box and a save button. */
function setup() {
  const doc = new FakeDocument();
  const trigger = el(doc, "BUTTON");
  const dialog = el(doc, "DIV", { role: "dialog", tabindex: "-1" });
  const close = el(doc, "BUTTON");
  const field = el(doc, "INPUT", {}, { type: "text" });
  const save = el(doc, "BUTTON");
  dialog.append(close, field, save);
  doc.body.append(trigger, dialog);
  trigger.focus();
  return { doc, trigger, dialog, close, field, save };
}

test("tabbable elements leave out disabled, negative tabindex, hidden and inert ones", () => {
  const doc = new FakeDocument();
  const root = el(doc, "DIV");
  const ok = el(doc, "BUTTON");
  const disabled = el(doc, "BUTTON", {}, { disabled: true });
  const skipped = el(doc, "A", { href: "/x", tabindex: "-1" });
  const hidden = el(doc, "BUTTON", {}, { hiddenBox: true });
  const inertBox = el(doc, "DIV", { inert: "" }).append(el(doc, "BUTTON"));
  const plainDiv = el(doc, "DIV");
  const custom = el(doc, "DIV", { tabindex: "0" });
  const link = el(doc, "A", { href: "/y" });
  root.append(ok, disabled, skipped, hidden, inertBox, plainDiv, custom, link);
  doc.body.append(root);
  assert.deepEqual(tabbableElements(asHtml(root)), asHtmlList([ok, custom, link]));
});

test("only one radio button per group is a Tab stop: the checked one, else the first", () => {
  const doc = new FakeDocument();
  const a1 = el(doc, "INPUT", {}, { type: "radio", name: "a" });
  const a2 = el(doc, "INPUT", {}, { type: "radio", name: "a", checked: true });
  const b1 = el(doc, "INPUT", {}, { type: "radio", name: "b" });
  const b2 = el(doc, "INPUT", {}, { type: "radio", name: "b" });
  doc.body.append(a1, a2, b1, b2);
  assert.deepEqual(tabbableAmong(asHtmlList([a1, a2, b1, b2])), asHtmlList([a2, b1]));
});

test("Tab wraps from the last element to the first, Shift+Tab from the first to the last", () => {
  const { dialog, close, field, save } = setup();
  const list = asHtmlList([close, field, save]);
  assert.equal(nextTabTarget(asHtml(dialog), list, asHtml(save), false), asHtml(close));
  assert.equal(nextTabTarget(asHtml(dialog), list, asHtml(close), true), asHtml(save));
  // In the middle the browser moves focus as usual.
  assert.equal(nextTabTarget(asHtml(dialog), list, asHtml(field), false), null);
  assert.equal(nextTabTarget(asHtml(dialog), list, asHtml(field), true), null);
});

test("from the dialog itself or from nowhere, Tab enters at the right end; nothing focusable keeps focus on the dialog", () => {
  const { doc, dialog, close, field, save } = setup();
  const list = asHtmlList([close, field, save]);
  assert.equal(nextTabTarget(asHtml(dialog), list, asHtml(dialog), false), asHtml(close));
  assert.equal(nextTabTarget(asHtml(dialog), list, asHtml(dialog), true), asHtml(save));
  assert.equal(nextTabTarget(asHtml(dialog), list, asHtml(doc.body), false), asHtml(close));
  assert.equal(nextTabTarget(asHtml(dialog), list, null, true), asHtml(save));
  assert.equal(nextTabTarget(asHtml(dialog), [], asHtml(dialog), false), asHtml(dialog));
});

test("focus in something else outside the dialog (a popover it opened) is left to the browser", () => {
  const { doc, dialog, close, field, save } = setup();
  const popover = el(doc, "BUTTON");
  doc.body.append(popover);
  assert.equal(nextTabTarget(asHtml(dialog), asHtmlList([close, field, save]), asHtml(popover), false), null);
});

test("opening moves focus to the first tabbable element; closing puts it back on the trigger", () => {
  const { doc, trigger, dialog, close } = setup();
  const deactivate = activateDialog(asHtml(dialog));
  assert.equal(doc.activeElement, close);
  deactivate();
  assert.equal(doc.activeElement, trigger);
  assert.equal(doc.listenerCount, 0);
});

test("initial focus prefers the initialFocus option, then data-autofocus", () => {
  const { doc, dialog, field, save } = setup();
  save.attributes.set("data-autofocus", "");
  const first = activateDialog(asHtml(dialog));
  assert.equal(doc.activeElement, save);
  first();
  const second = activateDialog(asHtml(dialog), { initialFocus: () => asHtml(field) });
  assert.equal(doc.activeElement, field);
  second();
});

test("with nothing focusable inside, the dialog itself takes focus", () => {
  const doc = new FakeDocument();
  const trigger = el(doc, "BUTTON");
  const dialog = el(doc, "DIV", { role: "dialog", tabindex: "-1" }).append(el(doc, "P"));
  doc.body.append(trigger, dialog);
  trigger.focus();
  const deactivate = activateDialog(asHtml(dialog));
  assert.equal(doc.activeElement, dialog);
  const tab = doc.key("Tab");
  assert.equal(tab.defaultPrevented, true);
  assert.equal(doc.activeElement, dialog);
  deactivate();
  assert.equal(doc.activeElement, trigger);
});

test("Tab and Shift+Tab are trapped at the edges; keys in the middle are left alone", () => {
  const { doc, dialog, close, field, save } = setup();
  const deactivate = activateDialog(asHtml(dialog));
  save.focus();
  assert.equal(doc.key("Tab").defaultPrevented, true);
  assert.equal(doc.activeElement, close);
  assert.equal(doc.key("Tab", true).defaultPrevented, true);
  assert.equal(doc.activeElement, save);
  field.focus();
  assert.equal(doc.key("Tab").defaultPrevented, false);
  assert.equal(doc.activeElement, field);
  deactivate();
});

test("Escape calls onEscape; a dialog that can't be dismissed ignores it", () => {
  const { doc, dialog } = setup();
  let closed = 0;
  const deactivate = activateDialog(asHtml(dialog), { onEscape: () => (closed += 1) });
  doc.key("Escape");
  assert.equal(closed, 1);
  deactivate();
  const locked = activateDialog(asHtml(dialog));
  assert.doesNotThrow(() => doc.key("Escape"));
  locked();
});

test("a key another handler already handled (preventDefault) is left alone", () => {
  const { doc, dialog } = setup();
  let closed = 0;
  const deactivate = activateDialog(asHtml(dialog), { onEscape: () => (closed += 1) });
  const event: KeyEvent = { key: "Escape", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, defaultPrevented: true, preventDefault: () => undefined };
  // Dispatch the already-handled event through the same listener set.
  (doc as unknown as { listeners: Set<(event: KeyEvent) => void> }).listeners.forEach((listener) => listener(event));
  assert.equal(closed, 0);
  deactivate();
});

test("with two dialogs open, only the newest one handles Escape and Tab; closing it returns focus to the first", () => {
  const { doc, dialog, save } = setup();
  const closed: string[] = [];
  const closeFirst = activateDialog(asHtml(dialog), { onEscape: () => closed.push("first") });
  save.focus();
  const second = el(doc, "DIV", { role: "dialog", tabindex: "-1" });
  const secondButton = el(doc, "BUTTON");
  second.append(secondButton);
  doc.body.append(second);
  const closeSecond = activateDialog(asHtml(second), { onEscape: () => closed.push("second") });
  assert.equal(doc.activeElement, secondButton);
  doc.key("Escape");
  assert.deepEqual(closed, ["second"]);
  // The single button wraps onto itself.
  assert.equal(doc.key("Tab").defaultPrevented, true);
  assert.equal(doc.activeElement, secondButton);
  closeSecond();
  second.remove();
  assert.equal(doc.activeElement, save);
  doc.key("Escape");
  assert.deepEqual(closed, ["second", "first"]);
  closeFirst();
});

test("a dialog in a popout window listens in its own document and doesn't block the main window's dialog", () => {
  const main = setup();
  const popoutDoc = new FakeDocument();
  const popoutTrigger = el(popoutDoc, "BUTTON");
  const popoutDialog = el(popoutDoc, "DIV", { role: "dialog", tabindex: "-1" });
  const popoutButton = el(popoutDoc, "BUTTON");
  popoutDialog.append(popoutButton);
  popoutDoc.body.append(popoutTrigger, popoutDialog);
  popoutTrigger.focus();

  const closed: string[] = [];
  const closeMain = activateDialog(asHtml(main.dialog), { onEscape: () => closed.push("main") });
  const closePopout = activateDialog(asHtml(popoutDialog), { onEscape: () => closed.push("popout") });
  assert.equal(popoutDoc.activeElement, popoutButton);
  assert.equal(main.doc.activeElement, main.close);
  assert.equal(popoutDoc.listenerCount, 1);
  assert.equal(main.doc.listenerCount, 1);

  main.doc.key("Escape");
  popoutDoc.key("Escape");
  assert.deepEqual(closed, ["main", "popout"]);
  closePopout();
  assert.equal(popoutDoc.activeElement, popoutTrigger);
  closeMain();
  assert.equal(main.doc.activeElement, main.trigger);
});

test("closing doesn't pull focus back if the person already moved it elsewhere, or if the trigger is gone", () => {
  const first = setup();
  const elsewhere = el(first.doc, "BUTTON");
  first.doc.body.append(elsewhere);
  const deactivate = activateDialog(asHtml(first.dialog));
  elsewhere.focus();
  deactivate();
  assert.equal(first.doc.activeElement, elsewhere);

  const second = setup();
  const deactivateSecond = activateDialog(asHtml(second.dialog));
  second.trigger.remove();
  second.dialog.remove();
  second.doc.activeElement = second.doc.body;
  deactivateSecond();
  assert.equal(second.doc.activeElement, second.doc.body);
});

test("a dialog hidden at this window size (display:none) neither grabs focus nor traps Tab", () => {
  const { doc, trigger, dialog } = setup();
  dialog.hiddenBox = true;
  const deactivate = activateDialog(asHtml(dialog));
  assert.equal(doc.activeElement, trigger);
  assert.equal(doc.key("Tab").defaultPrevented, false);
  deactivate();
  assert.equal(doc.activeElement, trigger);
});

test("the dialog drawn on top holds the keyboard, even when one underneath opened after it", () => {
  const doc = new FakeDocument();
  const trigger = el(doc, "BUTTON");
  // The policy prompt (z-[1200], can't be dismissed) and "What's new" (z-[1150]) both open when the app loads.
  const consent = el(doc, "DIV", { role: "dialog", tabindex: "-1" });
  consent.zIndex = "1200";
  const accept = el(doc, "BUTTON");
  const signOut = el(doc, "BUTTON");
  consent.append(signOut, accept);
  const whatsNew = el(doc, "DIV", { role: "dialog", tabindex: "-1" });
  whatsNew.zIndex = "1150";
  const gotIt = el(doc, "BUTTON");
  whatsNew.append(gotIt);
  doc.body.append(trigger, consent, whatsNew);
  trigger.focus();

  const closed: string[] = [];
  const closeConsent = activateDialog(asHtml(consent));
  assert.equal(doc.activeElement, signOut);
  const closeWhatsNew = activateDialog(asHtml(whatsNew), { onEscape: () => closed.push("whats-new") });
  assert.equal(doc.activeElement, signOut, "focus stayed in the dialog on top");

  doc.key("Escape");
  assert.deepEqual(closed, [], "Escape doesn't close the covered dialog");
  accept.focus();
  assert.equal(doc.key("Tab").defaultPrevented, true);
  assert.equal(doc.activeElement, signOut, "Tab wraps inside the dialog on top");

  // Accepting closes the prompt: focus moves into the dialog that is now on top.
  closeConsent();
  consent.remove();
  assert.equal(doc.activeElement, gotIt);
  doc.key("Escape");
  assert.deepEqual(closed, ["whats-new"]);
  closeWhatsNew();
  whatsNew.remove();
  assert.equal(doc.activeElement, trigger);
});

test("a dialog inside the page ranks below one portalled over it, whatever the order they opened in", () => {
  const doc = new FakeDocument();
  // The app root is z-index 1 (globals.css), so a z-[120] dialog inside it is under a z-[1100] portal.
  const appRoot = el(doc, "DIV");
  appRoot.zIndex = "1";
  const pageDialog = el(doc, "DIV", { role: "dialog", tabindex: "-1" });
  pageDialog.zIndex = "120";
  const pageButton = el(doc, "BUTTON");
  pageDialog.append(pageButton);
  appRoot.append(pageDialog);
  const portal = el(doc, "DIV");
  portal.zIndex = "1100";
  const portalDialog = el(doc, "DIV", { role: "dialog", tabindex: "-1" });
  const portalButton = el(doc, "BUTTON");
  portalDialog.append(portalButton);
  portal.append(portalDialog);
  doc.body.append(portal, appRoot);

  const closed: string[] = [];
  const closePortal = activateDialog(asHtml(portalDialog), { onEscape: () => closed.push("portal") });
  const closePage = activateDialog(asHtml(pageDialog), { onEscape: () => closed.push("page") });
  assert.equal(doc.activeElement, portalButton);
  doc.key("Escape");
  assert.deepEqual(closed, ["portal"]);
  closePage();
  closePortal();
});
