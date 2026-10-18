/**
 * Where to send someone after sign-in, sign-up or the age gate, taken from a link's ?redirect= / ?next=.
 * Only a path on this site is accepted. The old check (starts with "/" but not "//") let through values such as
 * "/\evil.com" or "/%09/evil.com", which browsers treat as "//evil.com", so a crafted sign-in link could send
 * people to a lookalike site right after they signed in.
 */
const BASE = "https://nfgcord.invalid";

export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  // Backslashes and control/space characters can turn a path into another host once the browser cleans it up.
  if (/[\\\u0000- \u007f]/.test(raw)) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
