const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const localApiBase = "http://127.0.0.1:4000";

function resolveBrowserApiBase(): string {
  if (typeof window === "undefined") {
    return configuredApiBase ?? localApiBase;
  }

  if (configuredApiBase) {
    return configuredApiBase;
  }

  const runningLocally = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (runningLocally) {
    return localApiBase;
  }

  // In hosted browser contexts without explicit API config, prefer same-origin over localhost.
  return window.location.origin;
}

export const API_BASE_URL = resolveBrowserApiBase();
