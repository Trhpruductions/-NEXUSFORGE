// The API runs user text through the `xss` filter before storing it, which turns a
// bare "<" or ">" into "&lt;" / "&gt;" (so "gg <3" is stored as "gg &lt;3"). React
// already renders text safely, so those entities just showed up literally on screen.
// Decode them back for display and for edit boxes; React escapes the result again.
const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&amp;": "&" };

export function plainText(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/&(?:lt|gt|quot|#39|#x27|amp);/g, (entity) => ENTITIES[entity] ?? entity);
}
