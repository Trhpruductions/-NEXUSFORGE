/**
 * Seasonal events. A small schedule decides which event (if any) is on, by the person's LOCAL calendar date. Events are
 * short windows, so the app is its normal self most of the year. Nothing here changes the clock or the server: the date
 * is passed in, which also makes every boundary testable.
 */

export const SEASON_IDS = ["nfg-anniversary", "halloween", "winter", "new-year", "valentines", "spring", "summer"] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

export type Season = {
  id: SeasonId;
  name: string;
  /** Short line for the loading screen. */
  tagline: string;
};

type Window = { id: SeasonId; name: string; tagline: string; from: [number, number]; to: [number, number] };

// [month (1-12), day] inclusive, in the person's local time. Earlier entries win when windows overlap.
const WINDOWS: Window[] = [
  // nfgcord.com went live on 13 October 2026.
  { id: "nfg-anniversary", name: "NFG anniversary", tagline: "Another year of the forge. Thanks for being here.", from: [10, 12], to: [10, 14] },
  { id: "halloween", name: "Halloween", tagline: "The forge burns a little spookier tonight.", from: [10, 24], to: [10, 31] },
  { id: "new-year", name: "New Year", tagline: "New year, new squad goals.", from: [12, 31], to: [1, 2] },
  { id: "winter", name: "Winter", tagline: "Warm up by the forge.", from: [12, 15], to: [12, 30] },
  { id: "valentines", name: "Valentine's Day", tagline: "Bring your duo.", from: [2, 12], to: [2, 14] },
  { id: "spring", name: "Spring", tagline: "Fresh season, fresh runs.", from: [3, 20], to: [3, 26] },
  { id: "summer", name: "Summer", tagline: "Long days, longer sessions.", from: [6, 21], to: [6, 27] },
];

function inWindow(month: number, day: number, window: Window) {
  const value = month * 100 + day;
  const from = window.from[0] * 100 + window.from[1];
  const to = window.to[0] * 100 + window.to[1];
  // A window that wraps the new year (31 Dec to 2 Jan).
  return from <= to ? value >= from && value <= to : value >= from || value <= to;
}

/** The event on for this local date, or null. */
export function seasonFor(date: Date): Season | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const match = WINDOWS.find((window) => inWindow(month, day, window));
  return match ? { id: match.id, name: match.name, tagline: match.tagline } : null;
}

/** Every event, for the settings preview. */
export function allSeasons(): Season[] {
  return WINDOWS.map(({ id, name, tagline }) => ({ id, name, tagline }));
}

export function isSeasonId(value: unknown): value is SeasonId {
  return typeof value === "string" && (SEASON_IDS as readonly string[]).includes(value);
}
