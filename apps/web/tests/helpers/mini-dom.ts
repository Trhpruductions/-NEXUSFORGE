/**
 * Just enough of a browser DOM for react-dom to render plain components in Node (no jsdom in this repo): a node
 * tree, attributes, inline styles, focus, and no-op events. Call installMiniDom() before importing react-dom or any
 * component. Not a general DOM: no layout, no real events, minimal selectors ("tag", "[attr]").
 */

type Listener = (event: unknown) => void;

/** The node and its ancestors, nearest first. */
function selfAndAncestors(node: MiniNode): MiniNode[] {
  const chain: MiniNode[] = [];
  for (let current: MiniNode | null = node; current; current = current.parentNode) chain.push(current);
  return chain;
}

class MiniEventTarget {
  private listeners = new Map<string, Set<Listener>>();
  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatchEvent(event: { type: string }) {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
    return true;
  }
}

class MiniNode extends MiniEventTarget {
  parentNode: MiniNode | null = null;
  childNodes: MiniNode[] = [];
  constructor(
    public ownerDocument: MiniDocument,
    public nodeType: number,
    public nodeName: string,
  ) {
    super();
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }
  get nextSibling(): MiniNode | null {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  get previousSibling(): MiniNode | null {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) - 1] ?? null;
  }
  get parentElement(): MiniNode | null {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }
  get isConnected(): boolean {
    return this.getRootNode() === this.ownerDocument;
  }
  appendChild<T extends MiniNode>(child: T): T {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  insertBefore<T extends MiniNode>(child: T, before: MiniNode | null): T {
    if (!before) return this.appendChild(child);
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.splice(this.childNodes.indexOf(before), 0, child);
    return child;
  }
  removeChild<T extends MiniNode>(child: T): T {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  contains(other: MiniNode | null) {
    for (let node = other; node; node = node.parentNode) if (node === this) return true;
    return false;
  }
  getRootNode(): MiniNode {
    const chain = selfAndAncestors(this);
    return chain[chain.length - 1];
  }
  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    if (value) this.appendChild(this.ownerDocument.createTextNode(String(value)));
  }
}

class MiniText extends MiniNode {
  constructor(ownerDocument: MiniDocument, public nodeValue: string) {
    super(ownerDocument, 3, "#text");
  }
  get data() {
    return this.nodeValue;
  }
  get textContent() {
    return this.nodeValue;
  }
  set textContent(value: string) {
    this.nodeValue = value;
  }
}

function matches(element: MiniElement, selector: string) {
  const attribute = /^\[([\w-]+)\]$/.exec(selector);
  if (attribute) return element.hasAttribute(attribute[1]);
  return element.localName === selector.toLowerCase();
}

class MiniElement extends MiniNode {
  attributes = new Map<string, string>();
  /** Not linked to data-* attributes; only here because Next reads it when its modules load. */
  dataset: Record<string, string> = {};
  style: Record<string, string> & { setProperty: (name: string, value: string) => void; removeProperty: (name: string) => void };
  value = "";
  defaultValue = "";
  checked = false;
  defaultChecked = false;
  constructor(
    ownerDocument: MiniDocument,
    public localName: string,
    public namespaceURI: string | null,
  ) {
    super(ownerDocument, 1, namespaceURI === HTML_NS ? localName.toUpperCase() : localName);
    const style: Record<string, string> = {};
    this.style = Object.assign(style, {
      setProperty: (name: string, value: string) => void (style[name] = value),
      removeProperty: (name: string) => void delete style[name],
    });
  }
  get tagName() {
    return this.nodeName;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }
  setAttributeNS(_namespace: string | null, name: string, value: string) {
    this.setAttribute(name, value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  removeAttributeNS(_namespace: string | null, name: string) {
    this.attributes.delete(name);
  }
  focus() {
    this.ownerDocument.activeElement = this;
  }
  blur() {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null;
  }
  scrollIntoView() {}
  getClientRects() {
    return this.isConnected ? [{ width: 1, height: 1 }] : [];
  }
  getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  private descendants(): MiniElement[] {
    return this.childNodes.filter((node): node is MiniElement => node instanceof MiniElement).flatMap((node) => [node, ...node.descendants()]);
  }
  querySelectorAll(selector: string) {
    return this.descendants().filter((node) => matches(node, selector));
  }
  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  closest(selector: string) {
    return selfAndAncestors(this).find((node): node is MiniElement => node instanceof MiniElement && matches(node, selector)) ?? null;
  }
}

const HTML_NS = "http://www.w3.org/1999/xhtml";

class MiniDocument extends MiniNode {
  documentElement: MiniElement;
  head: MiniElement;
  body: MiniElement;
  activeElement: MiniElement | null = null;
  defaultView: unknown = null;
  constructor() {
    super(null as unknown as MiniDocument, 9, "#document");
    this.ownerDocument = this;
    this.documentElement = this.createElement("html");
    this.head = this.createElement("head");
    this.body = this.createElement("body");
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }
  createElement(tag: string) {
    return new MiniElement(this, tag.toLowerCase(), HTML_NS);
  }
  createElementNS(namespace: string | null, tag: string) {
    return new MiniElement(this, tag, namespace);
  }
  createTextNode(text: string) {
    return new MiniText(this, text);
  }
  createComment(text: string) {
    const node = new MiniText(this, text);
    node.nodeType = 8;
    node.nodeName = "#comment";
    return node;
  }
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

export type MiniDom = { document: MiniDocument; createContainer: () => MiniElement };

/** Puts a window and document on globalThis. Idempotent. */
export function installMiniDom(): MiniDom {
  const g = globalThis as Record<string, unknown>;
  if (g.__miniDom) return g.__miniDom as MiniDom;
  const document = new MiniDocument();
  const windowTarget = new MiniEventTarget();
  const win = Object.assign(windowTarget, {
    document,
    location: { hostname: "localhost", origin: "http://localhost", href: "http://localhost/", pathname: "/", search: "", hash: "" },
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    HTMLIFrameElement: class HTMLIFrameElement {},
    HTMLElement: MiniElement,
    Element: MiniElement,
    Node: MiniNode,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame: (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  (win as unknown as { window: unknown }).window = win;
  document.defaultView = win;
  g.window = win;
  g.document = document;
  g.HTMLIFrameElement = win.HTMLIFrameElement;
  g.HTMLElement = MiniElement;
  g.Element = MiniElement;
  g.Node = MiniNode;
  g.localStorage = win.localStorage;
  g.sessionStorage = win.sessionStorage;
  g.requestAnimationFrame = win.requestAnimationFrame;
  g.cancelAnimationFrame = win.cancelAnimationFrame;
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const dom: MiniDom = {
    document,
    createContainer: () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      return container;
    },
  };
  g.__miniDom = dom;
  return dom;
}
