import { api } from "@/lib/api";

const sent = new Set<string>();
const MAX_PER_PAGE_LOAD = 10;

/** The site was rebuilt while this tab was open, so an old file is gone. Not a bug; the page reloads itself. */
export function isStaleBuildError(error: unknown) {
  const err = error as { name?: string; message?: string } | null;
  return Boolean(err && (err.name === "ChunkLoadError" || /Failed to load chunk|Loading chunk [^ ]+ failed|Loading CSS chunk/i.test(err.message ?? "")));
}

/** Reloads the page once for a stale-build error. Returns true if a reload was started. */
export function reloadOnceForStaleBuild(): boolean {
  try {
    const key = "nf-stale-build-reload";
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, String(Date.now()));
    window.setTimeout(() => sessionStorage.removeItem(key), 60_000);
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

/** Noise that isn't our bug: browser extensions, cross-origin "Script error.", a benign Chrome warning. */
function isNoise(message: string, stack?: string) {
  return (
    /^Script error\.?$/i.test(message) ||
    /ResizeObserver loop/i.test(message) ||
    /(chrome|moz|safari(-web)?)-extension:\/\//.test(stack ?? "")
  );
}

/**
 * Tell Nexus Forge staff about a crash in this browser (shown at /admin/errors). Each problem is
 * sent once per page load, at most ten in total, and only the page path goes with it, never
 * the query string. Never throws.
 */
export function reportClientError(error: unknown, context?: string) {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
    const message = `${context ? `${context}: ` : ""}${err.message || "Unknown error"}`.slice(0, 1000);
    if (isNoise(err.message, err.stack) || isStaleBuildError(err)) return;
    const key = `${message}|${(err.stack ?? "").split("\n")[1] ?? ""}`;
    if (sent.has(key) || sent.size >= MAX_PER_PAGE_LOAD) return;
    sent.add(key);
    void api
      .post("/api/errors/client", { message, stack: err.stack?.slice(0, 8000) ?? null, path: window.location.pathname })
      .catch(() => undefined);
  } catch {
    /* reporting must never cause another error */
  }
}

/** Catch crashes that nothing else handled. Returns a function that removes the listeners. */
export function installErrorReporting() {
  const onError = (event: ErrorEvent) => {
    if (isStaleBuildError(event.error) && reloadOnceForStaleBuild()) return;
    reportClientError(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (isStaleBuildError(event.reason) && reloadOnceForStaleBuild()) return;
    // Failed API calls are already shown to the person and logged by the server.
    const reason = event.reason as { isAxiosError?: boolean } | undefined;
    if (reason?.isAxiosError) return;
    reportClientError(event.reason, "Unhandled promise");
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
