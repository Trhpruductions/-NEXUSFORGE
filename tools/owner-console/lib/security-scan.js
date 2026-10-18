"use strict";

// Log lines that the app writes for security events. Each match becomes a SECURITY_LOG ticket.
// The text is scrubbed before it is stored or shown.

const crypto = require("node:crypto");
const { scrubText } = require("./secrets");

const RULES = [
  {
    id: "reused-refresh-token",
    match: /\[AUTH\] Reused refresh token/,
    severity: "HIGH",
    title: "Reused refresh token: a session was ended (possible token theft)",
  },
  {
    id: "high-value-transaction",
    match: /\[AUDIT\]\[ECONOMY\] High-value transaction/,
    severity: "MEDIUM",
    title: "High-value economy transaction (review)",
  },
  {
    id: "alert-email-failed",
    match: /\[SECURITY\] alert email failed/,
    severity: "MEDIUM",
    title: "Security alert email failed to send",
  },
  {
    id: "new-device-alert-failed",
    match: /\[AUTH\] new-device alert failed/,
    severity: "LOW",
    title: "New-device alert email failed to send",
  },
];

/**
 * Finds security lines in raw log lines.
 * @returns {Array<{ruleId, severity, title, ref, text, app, stream}>}
 */
function scanSecurityLines(lines, origin) {
  const hits = [];
  for (const line of lines) {
    if (!line) continue;
    const rule = RULES.find((candidate) => candidate.match.test(line));
    if (!rule) continue;
    const ref = crypto.createHash("sha256").update(`${origin.app}|${origin.stream}|${line}`).digest("hex").slice(0, 32);
    hits.push({
      ruleId: rule.id,
      severity: rule.severity,
      title: rule.title,
      ref,
      text: scrubText(line.slice(0, 600)),
      app: origin.app,
      stream: origin.stream,
    });
  }
  return hits;
}

module.exports = { scanSecurityLines, SECURITY_RULES: RULES };
