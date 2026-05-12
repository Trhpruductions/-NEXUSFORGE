const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const localApiBase = "http://127.0.0.1:4000";

function isLocalApiUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
}

function resolveBrowserApiBase(): string {
  if (typeof window === "undefined") {
    return configuredApiBase ?? localApiBase;
  }

  const runningLocally = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (runningLocally && !isLocalApiUrl(configuredApiBase)) {
    return localApiBase;
  }

  return configuredApiBase ?? localApiBase;
}

export const API_BASE_URL = resolveBrowserApiBase();
