import type { IncomingMessage } from "node:http";
import morgan from "morgan";
import { anonymizeIP } from "./ip-security.js";
import { accessLogFormat, logTimestampsEnabled, redactUrlForLog } from "./log-format.js";

type LoggedRequest = IncomingMessage & { ip?: string; originalUrl?: string };

// Anonymized visitor address: enough to tell requests apart, never the address itself.
morgan.token("remote-addr-masked", (req: LoggedRequest) => {
  return anonymizeIP(req.ip || req.socket?.remoteAddress || "unknown").substring(0, 12) + "...";
});
// The request URL without its secrets: upload, email-link, store-notification and webhook tokens never reach the log.
morgan.token("safe-url", (req: LoggedRequest) => redactUrlForLog(req.originalUrl || req.url));

/** The HTTP access log (one line per request, with an ISO timestamp unless LOG_TIMESTAMPS is off). */
export function createAccessLogger(options: { stream?: { write: (line: string) => void }; withTimestamp?: boolean } = {}) {
  return morgan(accessLogFormat(options.withTimestamp ?? logTimestampsEnabled()), options.stream ? { stream: options.stream } : {});
}
