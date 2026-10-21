import type { ErrorReport } from "./error-log.js";

/**
 * Content-Security-Policy violation reports from browsers. They arrive in two shapes: the older `report-uri`
 * form ({ "csp-report": {...} }, kebab-case) and the Reporting API's batches ([{ type: "csp-violation",
 * body: {...} }], camelCase). Both become one ErrorReport per violation for the admin Errors page.
 *
 * Reports come from anyone's browser, so only the parts that say what was blocked are kept: the blocked
 * site (origin only, never the full address, which may carry tokens), the rule, and the page path.
 */

export type CspViolation = {
  directive: string;
  blocked: string;
  page: string | null;
  source: string | null;
  line: number | null;
  column: number | null;
  reportOnly: boolean;
};

/** Most violations taken from one request; a batch can hold more, but a few are enough to see a pattern. */
export const MAX_VIOLATIONS_PER_REQUEST = 10;

const KEYWORDS = new Set(["inline", "eval", "wasm-eval", "trusted-types-policy", "trusted-types-sink", "data", "blob", "self"]);

/** Browser extensions inject their own scripts and styles; their reports say nothing about our pages. */
function fromExtension(value: string | null): boolean {
  return Boolean(value && /^(chrome|moz|safari|safari-web|ms-browser)-extension:/i.test(value));
}

function text(value: unknown, max = 2048): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

function wholeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** "https://cdn.example.com/x.js?token=..." -> "https://cdn.example.com"; keywords like "inline" stay as they are. */
export function blockedLabel(raw: string | null): string {
  if (!raw) return "unknown";
  const value = raw.trim();
  if (KEYWORDS.has(value.toLowerCase())) return value.toLowerCase();
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ws:" || url.protocol === "wss:") return url.origin;
    return url.protocol.replace(/:$/, "");
  } catch {
    return "unknown";
  }
}

/** The address of a script without its query string, so a token in it never reaches the log. */
function sourceLabel(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return KEYWORDS.has(raw) ? raw : null;
  }
}

function pagePath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).pathname;
  } catch {
    return null;
  }
}

function directiveName(raw: string | null): string {
  const first = (raw ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return /^[a-z-]{1,40}$/.test(first) ? first : "unknown";
}

function fromFields(fields: Record<string, unknown>, keys: { directive: string[]; blocked: string; page: string; source: string; line: string; column: string; disposition: string }): CspViolation | null {
  const blockedRaw = text(fields[keys.blocked]);
  const sourceRaw = text(fields[keys.source]);
  if (fromExtension(blockedRaw) || fromExtension(sourceRaw)) return null;
  const directiveRaw = keys.directive.map((key) => text(fields[key], 200)).find(Boolean) ?? null;
  return {
    directive: directiveName(directiveRaw),
    blocked: blockedLabel(blockedRaw),
    page: pagePath(text(fields[keys.page])),
    source: sourceLabel(sourceRaw),
    line: wholeNumber(fields[keys.line]),
    column: wholeNumber(fields[keys.column]),
    reportOnly: text(fields[keys.disposition], 20) !== "enforce",
  };
}

const LEGACY_KEYS = { directive: ["effective-directive", "violated-directive"], blocked: "blocked-uri", page: "document-uri", source: "source-file", line: "line-number", column: "column-number", disposition: "disposition" };
const REPORTING_API_KEYS = { directive: ["effectiveDirective", "violatedDirective"], blocked: "blockedURL", page: "documentURL", source: "sourceFile", line: "lineNumber", column: "columnNumber", disposition: "disposition" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Both report shapes to a short list of violations. Anything malformed is dropped, never thrown. */
export function parseCspReports(body: unknown): CspViolation[] {
  const found: Array<CspViolation | null> = [];
  if (isRecord(body) && isRecord(body["csp-report"])) {
    found.push(fromFields(body["csp-report"], LEGACY_KEYS));
  } else if (Array.isArray(body)) {
    for (const item of body.slice(0, MAX_VIOLATIONS_PER_REQUEST * 2)) {
      if (isRecord(item) && item.type === "csp-violation" && isRecord(item.body)) found.push(fromFields(item.body, REPORTING_API_KEYS));
    }
  }
  return found.filter((violation): violation is CspViolation => violation !== null).slice(0, MAX_VIOLATIONS_PER_REQUEST);
}

/** One violation as an Errors-page entry. Repeats of the same rule, site and page group into one row. */
export function cspErrorReport(violation: CspViolation): ErrorReport {
  const where = violation.source ? `${violation.source}${violation.line !== null ? `:${violation.line}${violation.column !== null ? `:${violation.column}` : ""}` : ""}` : "no source file given";
  return {
    source: "csp",
    message: `Content policy: ${violation.directive} ${violation.reportOnly ? "would block" : "blocked"} ${violation.blocked}`,
    stack: `Rule: ${violation.directive}\nBlocked: ${violation.blocked}\nFrom: ${where}`,
    path: violation.page,
  };
}
