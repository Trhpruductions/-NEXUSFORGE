/**
 * AutoMod: per-forge rules checked before a message is saved (new messages, thread
 * replies and edits). Kept free of I/O so the matching rules can be unit tested.
 *
 * Rule types:
 * - KEYWORDS: words or phrases; "*" is a wildcard ("scam*" matches "scammer").
 *   Matching ignores case and common character swaps (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s)
 *   and repeated letters, so "fr33 c0iiins" still hits "free coins".
 * - LINKS: any http(s) link or bare domain, except allowed domains (and their subdomains).
 * - INVITES: invite links to other forges or Discord servers.
 * - MENTION_SPAM: more than `mentionLimit` distinct mentions in one message.
 */

export type AutoModType = "KEYWORDS" | "LINKS" | "INVITES" | "MENTION_SPAM";

export type AutoModRule = {
  id: string;
  name: string;
  enabled: boolean;
  type: AutoModType;
  keywords: string[];
  allowList: string[];
  mentionLimit: number | null;
  blockMessage: boolean;
  alertModerators: boolean;
  timeoutMinutes: number | null;
  customMessage: string | null;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
};

export type AutoModContext = {
  content: string;
  channelId: string;
  roleIds: string[];
  /** Owner and anyone who can manage the forge are never filtered. */
  exempt: boolean;
  /** The forge's own invite code(s), which are always allowed. */
  ownInviteCodes: string[];
};

export type AutoModHit = { rule: AutoModRule; match: string };

const swaps: Record<string, string> = { "0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b" };

/** Lower-case, undo common look-alike swaps, collapse repeated letters. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[01!34@5$78]/g, (char) => swaps[char] ?? char)
    .replace(/(.)\1+/g, "$1");
}

function keywordPattern(keyword: string): RegExp | null {
  const clean = normalize(keyword.trim());
  if (!clean) return null;
  const escaped = clean.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "\\S*");
  // Whole words only, unless the keyword itself starts/ends with a wildcard.
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i");
}

export function matchKeyword(content: string, keywords: string[], allowList: string[] = []): string | null {
  let text = normalize(content);
  for (const allowed of allowList) {
    const pattern = keywordPattern(allowed);
    if (pattern) text = text.replace(new RegExp(pattern.source, "gi"), " ");
  }
  for (const keyword of keywords) {
    const pattern = keywordPattern(keyword);
    if (pattern && pattern.test(text)) return keyword;
  }
  return null;
}

const linkPattern = /\bhttps?:\/\/([^\s/?#<>]+)|\b((?:[a-z0-9-]+\.)+(?:com|net|org|gg|io|co|xyz|ru|tk|ly|me|tv|app|dev|link|site|online|shop|info|biz))\b/gi;

export function findBlockedLink(content: string, allowedDomains: string[]): string | null {
  const allowed = allowedDomains.map((domain) => domain.toLowerCase().replace(/^\*?\.?/, "").replace(/\/.*$/, ""));
  for (const match of content.matchAll(linkPattern)) {
    const host = (match[1] ?? match[2] ?? "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
    if (!host) continue;
    if (allowed.some((domain) => host === domain || host.endsWith(`.${domain}`))) continue;
    return match[0];
  }
  return null;
}

const invitePattern = /(?:discord(?:app)?\.com\/invite|discord\.gg|\/invite)\/([a-z0-9-]{2,32})/gi;

export function findForeignInvite(content: string, ownInviteCodes: string[]): string | null {
  const own = new Set(ownInviteCodes.map((code) => code.toLowerCase()));
  for (const match of content.matchAll(invitePattern)) {
    const code = match[1].toLowerCase();
    if (!match[0].toLowerCase().includes("discord") && own.has(code)) continue;
    return match[0];
  }
  return null;
}

export function countMentions(content: string) {
  return new Set(Array.from(content.matchAll(/@([a-zA-Z0-9_]+)/g)).map((match) => match[1].toLowerCase())).size;
}

/** The first rule a message breaks, or null. Rules apply in the order given. */
export function evaluateAutoMod(rules: AutoModRule[], context: AutoModContext): AutoModHit | null {
  if (context.exempt) return null;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.exemptChannelIds.includes(context.channelId)) continue;
    if (rule.exemptRoleIds.some((roleId) => context.roleIds.includes(roleId))) continue;
    let match: string | null = null;
    if (rule.type === "KEYWORDS") match = matchKeyword(context.content, rule.keywords, rule.allowList);
    else if (rule.type === "LINKS") match = findBlockedLink(context.content, rule.allowList);
    else if (rule.type === "INVITES") match = findForeignInvite(context.content, context.ownInviteCodes);
    else if (rule.type === "MENTION_SPAM" && rule.mentionLimit !== null) {
      const count = countMentions(context.content);
      if (count > rule.mentionLimit) match = `${count} mentions`;
    }
    if (match) return { rule, match };
  }
  return null;
}
