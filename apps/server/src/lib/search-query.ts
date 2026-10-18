/**
 * Discord-style message search filters, typed into the search box:
 *   from:nova  in:general  has:link|file|image|video  mentions:rook
 *   before:2026-10-01  after:2026-09-01  during:2026-09-15  pinned:true
 * Anything else is the words to look for. Quoted values allow spaces: in:"raid plans".
 */

export type HasFilter = "link" | "file" | "image" | "video";

export type SearchFilters = {
  text: string;
  from: string[];
  in: string[];
  has: HasFilter[];
  mentions: string[];
  before: Date | null;
  after: Date | null;
  pinned: boolean | null;
};

const HAS: HasFilter[] = ["link", "file", "image", "video"];

function day(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseSearchQuery(raw: string): SearchFilters {
  const filters: SearchFilters = { text: "", from: [], in: [], has: [], mentions: [], before: null, after: null, pinned: null };
  const words: string[] = [];
  for (const match of raw.matchAll(/(\w+):("([^"]*)"|\S+)|"([^"]*)"|(\S+)/g)) {
    const [, key, , quotedValue, quotedWord, word] = match;
    if (key) {
      const value = (quotedValue ?? match[2]).replace(/^["#@]+|"$/g, "").trim();
      const lower = key.toLowerCase();
      if (!value) continue;
      if (lower === "from") filters.from.push(value);
      else if (lower === "in") filters.in.push(value.toLowerCase());
      else if (lower === "mentions") filters.mentions.push(value);
      else if (lower === "has") {
        // Only the kinds we can search for; anything else is ignored rather than searched as text.
        if ((HAS as string[]).includes(value.toLowerCase())) filters.has.push(value.toLowerCase() as HasFilter);
      }
      else if (lower === "before") filters.before = day(value) ?? filters.before;
      else if (lower === "after") filters.after = day(value) ?? filters.after;
      else if (lower === "during") {
        const start = day(value);
        if (start) {
          filters.after = new Date(start.getTime() - 1);
          filters.before = new Date(start.getTime() + 24 * 60 * 60_000);
        }
      } else if (lower === "pinned") filters.pinned = value.toLowerCase() === "true" || value.toLowerCase() === "yes";
      else words.push(match[0]); // unknown key: treat "word:thing" as plain text
    } else {
      words.push(quotedWord ?? word);
    }
  }
  filters.text = words.join(" ").trim().slice(0, 120);
  return filters;
}

export function hasAnyFilter(filters: SearchFilters) {
  return Boolean(filters.text || filters.from.length || filters.in.length || filters.has.length || filters.mentions.length || filters.before || filters.after || filters.pinned !== null);
}
