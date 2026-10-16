/**
 * The email template registry. One entry per kind; each renders { subject, text, html }.
 * Every user-supplied value is escaped in the HTML version, and the footer only shows contact
 * addresses that are actually configured. Unsubscribe links appear only in OPTIONAL mail.
 */
import { env } from "../config/env.js";
import { brandLogoUrl, codeBoxHtml, ctaButtonHtml, emailFrame, escapeHtml, textToHtml } from "./email-template.js";
import { EMAIL_KINDS, OPTIONAL_PREFERENCE_BY_KIND, TEMPLATE_CATEGORY, type EmailCategory, type EmailKind } from "./email-policy.js";

export type EmailContext = {
  /** Public web origin, without a trailing slash. Footer links are built from it. */
  appUrl: string;
  supportEmail?: string;
  securityEmail?: string;
  updatesEmail?: string;
  logoUrl?: string | null;
};

export function emailContextFromEnv(): EmailContext {
  const appUrl = env.APP_WEB_URL.replace(/\/+$/, "");
  return {
    appUrl,
    supportEmail: env.SUPPORT_EMAIL,
    securityEmail: env.SECURITY_EMAIL,
    updatesEmail: env.UPDATES_EMAIL,
    logoUrl: brandLogoUrl(appUrl),
  };
}

export type RenderedEmail = { subject: string; text: string; html: string };

export type CodePurpose = "VERIFY_EMAIL" | "VERIFY_PHONE" | "LOGIN" | "SENSITIVE_CHANGE" | "RESET_PASSWORD";

export type EmailKindData = {
  "verification-code": { purpose: CodePurpose; code: string };
  "email-change-requested": { code: string };
  "verify-email-link": { username?: string; link: string; expiresIn: string };
  "password-reset": { username?: string; link: string; expiresIn: string };
  "password-changed": { username?: string; when: string };
  "email-changed": { username?: string; newEmailMasked: string; when: string };
  welcome: { username?: string };
  "planned-maintenance": { username?: string; title: string; startsAt: string; endsAt?: string; details: string; link?: string };
  "service-notice": { username?: string; title: string; body: string; link?: string };
  "release-notes": { username?: string; version: string; highlights: string[]; link?: string };
  "product-announcement": { username?: string; title: string; body: string; link?: string; linkLabel?: string };
};

export const CODE_FOOTNOTE = "This code expires in 10 minutes. Never share it with anyone, including Nexus Forge staff. We will never ask for it.";

// Warm, plain wording: say what the code is for, and what to do if it wasn't the person asking.
const CODE_COPY: Record<CodePurpose, { subject: string; intro: string }> = {
  VERIFY_EMAIL: { subject: "Welcome! Confirm your email", intro: "Welcome to Nexus Forge Gaming. Enter this code to confirm your email address and get started." },
  VERIFY_PHONE: { subject: "Confirm your phone number", intro: "Enter this code to confirm your phone number." },
  LOGIN: { subject: "Your sign-in code", intro: "Someone is trying to sign in to your account. If that's you, enter this code. If it isn't, change your password right away." },
  SENSITIVE_CHANGE: { subject: "Confirm your account change", intro: "You asked to change something on your account. Enter this code to confirm it." },
  RESET_PASSWORD: { subject: "Reset your password", intro: "Enter this code to choose a new password. If you didn't ask for this, you can ignore this email. Your password stays the same until you set a new one." },
};

/** What a template produces before it is turned into text and HTML. */
type Block = {
  subject: string;
  greeting?: string;
  paragraphs: string[];
  bullets?: string[];
  code?: string;
  action?: { label: string; url: string };
  notes: string[];
};

type Builder<K extends EmailKind> = (data: EmailKindData[K], ctx: EmailContext) => Block;

const SECURITY_CONTACT_KINDS: ReadonlySet<EmailKind> = new Set<EmailKind>(["password-reset", "password-changed", "email-changed", "email-change-requested"]);

/** Subjects end up in mail headers: no line breaks, no runaway length. */
export function sanitizeSubject(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 150);
}

/** Required action links come from our own app, so anything that is not http(s) is a bug. */
function requiredUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) throw new Error("Email links must be http or https");
  return value;
}

/** Optional links (from admin-written announcements) are dropped when they are not http(s). */
function optionalUrl(value: string | undefined): string | undefined {
  return value && /^https?:\/\/[^\s<>"]+$/i.test(value) ? value : undefined;
}

const BUILDERS: { [K in EmailKind]: Builder<K> } = {
  "verification-code": (data) => {
    const copy = CODE_COPY[data.purpose];
    return { subject: copy.subject, paragraphs: [copy.intro], code: data.code, notes: [CODE_FOOTNOTE] };
  },
  "email-change-requested": (data) => ({
    subject: "Confirm your new email address",
    paragraphs: ["Someone asked to use this address for a Nexus Forge Gaming account. Enter this code to confirm the change. If you didn't ask for it, ignore this email and your account email stays the same."],
    code: data.code,
    notes: [CODE_FOOTNOTE],
  }),
  "verify-email-link": (data) => ({
    subject: "Confirm your email address",
    greeting: data.username,
    paragraphs: ["Confirm this email address for your Nexus Forge Gaming account."],
    action: { label: "Confirm my email", url: requiredUrl(data.link) },
    notes: [`This link expires in ${data.expiresIn}.`, "If you didn't create this account, you can ignore this email."],
  }),
  "password-reset": (data) => ({
    subject: "Reset your Nexus Forge Gaming password",
    greeting: data.username,
    paragraphs: ["Someone (hopefully you) asked to reset your Nexus Forge Gaming password. Choose a new one with the button below."],
    action: { label: "Choose a new password", url: requiredUrl(data.link) },
    notes: [`This link works once and expires in ${data.expiresIn}.`, "If it wasn't you, you can ignore this email. Your password hasn't changed."],
  }),
  "password-changed": (data) => ({
    subject: "Your Nexus Forge Gaming password was changed",
    greeting: data.username,
    paragraphs: [`The password for your Nexus Forge Gaming account was changed on ${data.when}.`],
    notes: ["If this was you, there's nothing to do.", "If it wasn't, reset your password right away and sign out the other sessions in Settings."],
  }),
  "email-changed": (data) => ({
    subject: "Your Nexus Forge Gaming email was changed",
    greeting: data.username,
    paragraphs: [`The email address on your account was changed on ${data.when} to ${data.newEmailMasked}.`],
    notes: ["If this was you, there's nothing to do.", "If it wasn't, reset your password right away and contact support."],
  }),
  welcome: (data, ctx) => ({
    subject: "Welcome to Nexus Forge Gaming",
    greeting: data.username,
    paragraphs: ["Your email is confirmed and your account is ready. Find a forge, say hello, and build your crew."],
    action: { label: "Open Nexus Forge Gaming", url: requiredUrl(ctx.appUrl) },
    notes: [],
  }),
  "planned-maintenance": (data) => ({
    subject: sanitizeSubject(`Scheduled maintenance: ${data.title}`),
    greeting: data.username,
    paragraphs: [`We have planned maintenance: ${data.title}.`, `When: ${data.startsAt}${data.endsAt ? ` until ${data.endsAt}` : ""}.`, data.details],
    action: optionalUrl(data.link) ? { label: "Read more", url: optionalUrl(data.link)! } : undefined,
    notes: ["Service may be interrupted during this window."],
  }),
  "service-notice": (data) => ({
    subject: sanitizeSubject(data.title),
    greeting: data.username,
    paragraphs: [data.body],
    action: optionalUrl(data.link) ? { label: "Read more", url: optionalUrl(data.link)! } : undefined,
    notes: [],
  }),
  "release-notes": (data) => ({
    subject: sanitizeSubject(`Nexus Forge Gaming ${data.version} release notes`),
    greeting: data.username,
    paragraphs: [`Here's what's new in version ${data.version}.`],
    bullets: data.highlights.slice(0, 20),
    action: optionalUrl(data.link) ? { label: "See the release notes", url: optionalUrl(data.link)! } : undefined,
    notes: [],
  }),
  "product-announcement": (data) => ({
    subject: sanitizeSubject(data.title),
    greeting: data.username,
    paragraphs: [data.body],
    action: optionalUrl(data.link) ? { label: data.linkLabel?.slice(0, 60) || "Learn more", url: optionalUrl(data.link)! } : undefined,
    notes: [],
  }),
};

type Footer = { text: string; html: string };

function buildFooter(kind: EmailKind, category: EmailCategory, ctx: EmailContext, unsubscribeUrl?: string): Footer {
  const textLines: string[] = [];
  const htmlLines: string[] = [];
  const addLine = (text: string, html = escapeHtml(text)) => {
    textLines.push(text);
    htmlLines.push(html);
  };
  const link = (label: string, url: string) => ({ text: `${label}: ${url}`, html: `${escapeHtml(label)}: <a href="${escapeHtml(url)}" style="color:#94a3b8">${escapeHtml(url)}</a>` });

  addLine(
    category === "OPTIONAL"
      ? "You're receiving this because you opted in to Nexus Forge Gaming email updates."
      : "You're receiving this because of activity on your Nexus Forge Gaming account. This is a required account email, so it can't be turned off.",
  );
  const privacy = link("Privacy", `${ctx.appUrl}/privacy`);
  const terms = link("Terms", `${ctx.appUrl}/terms`);
  const help = link("Help", `${ctx.appUrl}/support`);
  textLines.push(`${privacy.text}  |  ${terms.text}  |  ${help.text}`);
  htmlLines.push(`${privacy.html} &nbsp;|&nbsp; ${terms.html} &nbsp;|&nbsp; ${help.html}`);

  // Only the contacts the owner has actually configured are shown. Nothing is made up.
  if (ctx.supportEmail) addLine(`Contact support: ${ctx.supportEmail}`);
  if (ctx.securityEmail && SECURITY_CONTACT_KINDS.has(kind)) addLine(`Report account security problems: ${ctx.securityEmail}`);
  if (ctx.updatesEmail && category === "OPTIONAL") addLine(`Questions about these updates: ${ctx.updatesEmail}`);

  if (category === "OPTIONAL" && unsubscribeUrl) {
    const unsubscribe = link("Unsubscribe from these emails", unsubscribeUrl);
    textLines.push(unsubscribe.text);
    htmlLines.push(`<a href="${escapeHtml(unsubscribeUrl)}" style="color:#94a3b8">Unsubscribe from these emails</a>`);
  }

  return {
    text: textLines.join("\n"),
    html: htmlLines.map((line) => `<span style="display:block;margin:0 0 4px">${line}</span>`).join(""),
  };
}

function assemble(kind: EmailKind, block: Block, ctx: EmailContext, unsubscribeUrl?: string): RenderedEmail {
  const category = TEMPLATE_CATEGORY[kind];
  const subject = sanitizeSubject(block.subject);
  const footer = buildFooter(kind, category, ctx, unsubscribeUrl);

  const textParts: string[] = [];
  if (block.greeting) textParts.push(`Hi ${block.greeting},`);
  textParts.push(...block.paragraphs);
  if (block.bullets?.length) textParts.push(block.bullets.map((item) => `- ${item}`).join("\n"));
  if (block.code) textParts.push(`Your code: ${block.code}`);
  if (block.action) textParts.push(`${block.action.label}: ${block.action.url}`);
  textParts.push(...block.notes);
  const text = `${textParts.join("\n\n")}\n\n--\n${footer.text}`;

  const innerParts: string[] = [];
  if (block.greeting) innerParts.push(textToHtml(`Hi ${block.greeting},`));
  innerParts.push(...block.paragraphs.map((paragraph) => textToHtml(paragraph)));
  if (block.bullets?.length) {
    innerParts.push(`<ul style="margin:0 0 14px;padding-left:20px;line-height:1.6">${block.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
  }
  if (block.code) innerParts.push(codeBoxHtml(block.code));
  if (block.action) innerParts.push(ctaButtonHtml(block.action.label, block.action.url));
  innerParts.push(...block.notes.map((note) => textToHtml(note)));

  const html = emailFrame(subject, innerParts.join("\n"), { footerHtml: footer.html, logoUrl: ctx.logoUrl });
  return { subject, text, html };
}

/**
 * Renders one kind. An OPTIONAL kind must be given its signed unsubscribe link, and an ESSENTIAL
 * kind never gets one, so an essential email cannot carry an unsubscribe control by mistake.
 */
export function renderEmail<K extends EmailKind>(kind: K, data: EmailKindData[K], ctx: EmailContext, options: { unsubscribeUrl?: string } = {}): RenderedEmail {
  const category = TEMPLATE_CATEGORY[kind];
  if (category === "OPTIONAL" && !options.unsubscribeUrl) {
    throw new Error(`${kind} is optional mail and must carry an unsubscribe link`);
  }
  const block = (BUILDERS[kind] as Builder<EmailKind>)(data as never, ctx);
  return assemble(kind, block, ctx, category === "OPTIONAL" ? options.unsubscribeUrl : undefined);
}

/** Chooses the template for a one-time code, by the purpose the code was issued for. */
export function renderCodeEmail(
  purpose: CodePurpose | "CHANGE_EMAIL",
  code: string,
  ctx: EmailContext,
): { kind: EmailKind; rendered: RenderedEmail } {
  if (purpose === "CHANGE_EMAIL") {
    return { kind: "email-change-requested", rendered: renderEmail("email-change-requested", { code }, ctx) };
  }
  return { kind: "verification-code", rendered: renderEmail("verification-code", { purpose, code }, ctx) };
}

/** For the admin page: what each template is for, and whether it is optional. */
export const TEMPLATE_INFO: Record<EmailKind, { label: string; description: string }> = {
  "verification-code": { label: "Verification code", description: "A 6-digit code for email confirmation, sign-in, sensitive changes or password reset." },
  "email-change-requested": { label: "Email change code", description: "Sent to the NEW address when someone asks to change the account email." },
  "verify-email-link": { label: "Verify email (link)", description: "Link-based email confirmation. No current flow sends this yet." },
  "password-reset": { label: "Password reset link", description: "Single-use link, valid 30 minutes." },
  "password-changed": { label: "Password changed notice", description: "Security notice after a password change." },
  "email-changed": { label: "Email changed notice", description: "Security notice to the OLD address after an email change." },
  welcome: { label: "Welcome", description: "Sent once, after the email address is confirmed." },
  "planned-maintenance": { label: "Planned maintenance", description: "Service window notice." },
  "service-notice": { label: "Service notice", description: "General operational notice to an account." },
  "release-notes": { label: "Release notes (optional)", description: "Only to people who opted in to release notes." },
  "product-announcement": { label: "Product announcement (optional)", description: "Only to people who opted in to announcements." },
};

export function templateCatalog() {
  return EMAIL_KINDS.map((kind) => ({
    kind,
    category: TEMPLATE_CATEGORY[kind],
    label: TEMPLATE_INFO[kind].label,
    description: TEMPLATE_INFO[kind].description,
    optInKey: OPTIONAL_PREFERENCE_BY_KIND[kind] ?? null,
  }));
}

/** Placeholder data for the admin preview. No real account data, and the links are not real tokens. */
export function sampleData(ctx: EmailContext): { [K in EmailKind]: EmailKindData[K] } {
  const sampleLink = `${ctx.appUrl}/sample-link`;
  return {
    "verification-code": { purpose: "LOGIN", code: "123456" },
    "email-change-requested": { code: "123456" },
    "verify-email-link": { username: "Sample", link: sampleLink, expiresIn: "24 hours" },
    "password-reset": { username: "Sample", link: sampleLink, expiresIn: "30 minutes" },
    "password-changed": { username: "Sample", when: "Thu, 01 Jan 2026 12:00:00 GMT" },
    "email-changed": { username: "Sample", newEmailMasked: "sa••••@example.com", when: "Thu, 01 Jan 2026 12:00:00 GMT" },
    welcome: { username: "Sample" },
    "planned-maintenance": { username: "Sample", title: "Database upgrade", startsAt: "Saturday 10:00 UTC", endsAt: "10:30 UTC", details: "Chat and voice may be unavailable for a short time." },
    "service-notice": { username: "Sample", title: "A quick service notice", body: "Here is what happened and what we are doing about it." },
    "release-notes": { username: "Sample", version: "1.0.14", highlights: ["Faster startup", "Better voice reconnects"], link: sampleLink },
    "product-announcement": { username: "Sample", title: "Something new is here", body: "A short announcement goes here.", link: sampleLink, linkLabel: "See what's new" },
  };
}

/** Preview of one kind with placeholder data. Optional kinds get a placeholder unsubscribe link. */
export function renderSample(kind: EmailKind, ctx: EmailContext): RenderedEmail {
  const sample = sampleData(ctx)[kind];
  const options = TEMPLATE_CATEGORY[kind] === "OPTIONAL" ? { unsubscribeUrl: `${ctx.appUrl}/sample-unsubscribe` } : {};
  return renderEmail(kind, sample as never, ctx, options);
}
