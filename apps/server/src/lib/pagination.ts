/**
 * Page size from a `?limit=` query value: a whole number clamped to 1..max. Missing, empty, repeated
 * or non-numeric values give the fallback. Prisma's `take` refuses NaN and fractions with a 500, so
 * every list route reads its limit through here.
 */
export function pageLimit(raw: unknown, fallback: number, max: number): number {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}
