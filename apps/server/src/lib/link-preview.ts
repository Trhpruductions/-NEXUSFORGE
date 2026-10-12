import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";

/**
 * Fetches a web page for a link preview (title, description, site, image), safely.
 *
 * Fetching arbitrary URLs from the server is the classic SSRF hole, so:
 * - only http/https on ports 80/443;
 * - every DNS answer is checked inside the socket's own lookup, so the address we vet is
 *   the address we connect to (no DNS-rebinding window), and private, loopback,
 *   link-local, carrier-NAT, multicast and reserved ranges are refused;
 * - redirects are followed by hand (max 3), each hop re-checked;
 * - hard limits on time and bytes; only HTML for pages, only images for images.
 */

const TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 512 * 1024;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "VexoraLinkPreview/1.0 (+link previews for chat)";

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const blockedV4: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

/** True for any address a link preview must never reach. */
export function isBlockedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const value = ipv4ToInt(address);
    return blockedV4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isBlockedAddress(mapped[1]);
    if (lower === "::" || lower === "::1") return true;
    if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link local
    if (/^ff/.test(lower)) return true; // multicast
    if (lower.startsWith("2001:db8") || lower.startsWith("64:ff9b") || lower.startsWith("100::")) return true;
    return false;
  }
  return true;
}

/** dns.lookup that refuses blocked addresses; used as the socket's own resolver. */
function guardedLookup(hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = (addresses as dns.LookupAddress[]).filter((entry) => !isBlockedAddress(entry.address));
    if (!list.length || list.length !== (addresses as dns.LookupAddress[]).length) {
      return callback(Object.assign(new Error("Blocked address"), { code: "EBLOCKED" }), "", 0);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

export function checkUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  // A literal IP in the URL is checked here; names are checked at connect time.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedAddress(host)) return null;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  return url;
}

type FetchResult = { status: number; contentType: string; body: Buffer; finalUrl: string };

function fetchOnce(url: URL, accept: string, maxBytes: number): Promise<FetchResult & { location?: string }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup as unknown as typeof dns.lookup,
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "en" },
        timeout: TIMEOUT_MS,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          resolve({ status, contentType: "", body: Buffer.alloc(0), finalUrl: url.toString(), location: response.headers.location });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            // Pages: keep what we have (the <head> is near the top). Images: give up.
            if (accept.startsWith("image")) {
              request.destroy(new Error("Too large"));
              return;
            }
            chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - maxBytes))));
            request.destroy();
            resolve({ status, contentType: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks), finalUrl: url.toString() });
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ status, contentType: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks), finalUrl: url.toString() }));
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("Timed out")));
    request.on("error", reject);
    request.end();
  });
}

export async function safeFetch(raw: string, accept: string, maxBytes: number): Promise<FetchResult | null> {
  let url = checkUrl(raw);
  for (let hop = 0; url && hop <= MAX_REDIRECTS; hop += 1) {
    const result = await fetchOnce(url, accept, maxBytes).catch(() => null);
    if (!result) return null;
    if (result.location) {
      url = checkUrl(new URL(result.location, url).toString());
      continue;
    }
    return result.status >= 200 && result.status < 300 ? result : null;
  }
  return null;
}

// --- parsing -----------------------------------------------------------------

export type LinkPreview = { url: string; siteName: string | null; title: string | null; description: string | null; image: string | null; color: string | null };

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function clean(text: string | undefined | null, max: number) {
  if (!text) return null;
  const value = decodeEntities(text).replace(/\s+/g, " ").trim();
  return value ? value.slice(0, max) : null;
}

export function parsePreview(html: string, pageUrl: string): LinkPreview {
  const head = html.slice(0, 200_000);
  const meta: Record<string, string> = {};
  for (const match of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = match[0];
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && content !== undefined && !(key in meta)) meta[key] = content;
  }
  const title = meta["og:title"] ?? meta["twitter:title"] ?? /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1];
  const description = meta["og:description"] ?? meta["twitter:description"] ?? meta["description"];
  let image: string | null = meta["og:image:secure_url"] ?? meta["og:image"] ?? meta["twitter:image"] ?? meta["twitter:image:src"] ?? null;
  if (image) {
    try {
      image = new URL(decodeEntities(image), pageUrl).toString();
      if (!checkUrl(image)) image = null;
    } catch {
      image = null;
    }
  }
  const color = /^#[0-9a-f]{6}$/i.test(meta["theme-color"] ?? "") ? meta["theme-color"] : null;
  return {
    url: pageUrl,
    siteName: clean(meta["og:site_name"], 80) ?? new URL(pageUrl).hostname.replace(/^www\./, ""),
    title: clean(title, 200),
    description: clean(description, 350),
    image,
    color,
  };
}

// --- cache ---------------------------------------------------------------------

const cache = new Map<string, { at: number; value: LinkPreview | null }>();
const TTL_MS = 6 * 60 * 60_000;
const MAX_ENTRIES = 1000;

export async function getLinkPreview(raw: string): Promise<LinkPreview | null> {
  const key = raw.trim();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const result = await safeFetch(key, "text/html,application/xhtml+xml", MAX_HTML_BYTES);
  let value: LinkPreview | null = null;
  if (result && /text\/html|application\/xhtml/i.test(result.contentType)) {
    value = parsePreview(result.body.toString("utf8"), result.finalUrl);
    if (!value.title && !value.description) value = null;
  }
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}
