/**
 * What goes into the server's log files (pm2 keeps everything the process prints):
 *
 * - Every line gets an ISO timestamp. pm2 is not set up to add one, so on 18 Oct 2026 there was no way to
 *   tell when 163 "database connection refused" errors had happened.
 * - Request URLs lose their secrets before they are logged. Upload links, email-verify and unsubscribe links,
 *   the Google Play notification URL and incoming webhooks carry a token in the URL, and the access log used
 *   to write them out in full.
 *
 * Set LOG_TIMESTAMPS=off if the process manager is ever configured to add its own timestamps.
 */

/** Already starts with an ISO time (2026-10-18T15:25:29.285Z): don't add a second one. */
const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;

/** Query parameter names whose values are credentials, matched anywhere in the name (X-Amz-Signature, refresh_token...). */
const SECRET_PARAM_PART = /(token|secret|password|passwd|signature|credential|apikey|api_key|api-key|session)/i;
/** Short names that are credentials in the routes and providers this server talks to (OAuth code, upload sig...). */
const SECRET_PARAM_NAMES = new Set(["code", "key", "sig", "auth", "state", "otp", "hash", "jwt"]);

/** Path segments that are credentials themselves. Each pattern keeps group 1 and replaces the rest of the match. */
const SECRET_PATH_PATTERNS: RegExp[] = [
  // Incoming webhooks: POST /api/webhooks/:id/:token
  /^(\/api\/webhooks\/[^/]+\/)[^/]+/,
];

/** A JSON web token anywhere in the path (three base64url parts, the first starting with "eyJ"). */
const JWT_IN_PATH = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

export const REDACTED = "[redacted]";

export function isSecretParam(name: string): boolean {
  const lower = name.toLowerCase();
  return SECRET_PARAM_NAMES.has(lower) || SECRET_PARAM_PART.test(lower);
}

/** A URL path (no query string) with the segments that are credentials replaced. */
export function redactPathForLog(path: string): string {
  let result = path;
  for (const pattern of SECRET_PATH_PATTERNS) result = result.replace(pattern, `$1${REDACTED}`);
  return result.replace(JWT_IN_PATH, REDACTED);
}

/** The request URL as it may be written to a log: same path and parameters, with every secret value replaced. */
export function redactUrlForLog(raw: string | undefined | null): string {
  if (!raw) return "";
  const queryStart = raw.indexOf("?");
  const path = redactPathForLog(queryStart === -1 ? raw : raw.slice(0, queryStart));
  if (queryStart === -1) return path;

  const query = raw.slice(queryStart + 1);
  const parts = query.split("&").map((part) => {
    const equals = part.indexOf("=");
    if (equals === -1) return part;
    const rawName = part.slice(0, equals);
    let name = rawName;
    try {
      name = decodeURIComponent(rawName.replace(/\+/g, " "));
    } catch {
      // A malformed name is checked as it was sent.
    }
    return isSecretParam(name) ? `${rawName}=${REDACTED}` : part;
  });
  return `${path}?${parts.join("&")}`;
}

/** False when LOG_TIMESTAMPS is off/false/0/no. */
export function logTimestampsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return !/^(0|false|off|no)$/i.test((env.LOG_TIMESTAMPS ?? "").trim());
}

/** The access log line: time, method, URL without secrets, status, size, duration and the masked visitor address. */
export function accessLogFormat(withTimestamp: boolean): string {
  return `${withTimestamp ? ":date[iso] " : ""}:method :safe-url :status :res[content-length] - :response-time ms [GHOST-IP: :remote-addr-masked]`;
}

/** console arguments with the time in front. Lines that already start with an ISO time are left alone. */
export function withTimestamp(args: unknown[], now: Date = new Date()): unknown[] {
  if (!args.length) return args;
  const first = args[0];
  if (typeof first === "string") {
    if (ISO_PREFIX.test(first)) return args;
    return [`${now.toISOString()} ${first}`, ...args.slice(1)];
  }
  return [now.toISOString(), ...args];
}

const INSTALLED = Symbol.for("nexusforge.consoleTimestamps");
const METHODS = ["log", "info", "warn", "error", "debug"] as const;

/**
 * Puts the time in front of everything printed through console.log/info/warn/error/debug.
 * Safe to call more than once: a console that already has timestamps is left as it is. Returns false then.
 */
export function installConsoleTimestamps(target: Console = console, clock: () => Date = () => new Date()): boolean {
  const marked = target as Console & { [INSTALLED]?: true };
  if (marked[INSTALLED]) return false;
  for (const method of METHODS) {
    const original = target[method].bind(target) as (...args: unknown[]) => void;
    target[method] = (...args: unknown[]) => original(...withTimestamp(args, clock()));
  }
  marked[INSTALLED] = true;
  return true;
}
