/** Local addresses the app is served from during development. Never accepted in production. */
export const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/**
 * The origins a browser may call from. CORS and the age gate both use this list, so they agree.
 * Production: the configured client origins plus the public web address. Other environments add the local dev ports.
 */
export function allowedOriginList(input: { clientOrigin: string; appWebUrl: string; nodeEnv: string }): string[] {
  const configuredOrigins = input.clientOrigin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  let appWebOrigin = "";
  try {
    appWebOrigin = new URL(input.appWebUrl).origin;
  } catch {
    appWebOrigin = "";
  }

  return Array.from(
    new Set(
      input.nodeEnv === "production"
        ? [...configuredOrigins, appWebOrigin].filter(Boolean)
        : [...configuredOrigins, "http://localhost:3300", "http://localhost:3001", "http://127.0.0.1:3300", "http://127.0.0.1:3001"],
    ),
  );
}

/**
 * Exact match against the list, never a substring: "https://nexusforge.app.example.net" and
 * "https://example.net/localhost" are not the app. A missing origin is allowed (non-browser callers).
 */
export function isAllowedOrigin(origin: string | undefined, allowed: string[], nodeEnv: string): boolean {
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  return nodeEnv !== "production" && LOCAL_ORIGIN_PATTERN.test(origin);
}
