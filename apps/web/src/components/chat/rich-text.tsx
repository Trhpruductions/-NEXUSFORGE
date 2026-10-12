"use client";

import { Fragment, useState, type ReactNode } from "react";
import { plainText } from "@/lib/plain-text";

/**
 * Discord-style message formatting, rendered as React elements (never as HTML, so
 * nothing in a message can inject markup or script).
 *
 * Blocks:  ```code```, > quote, # / ## / ### headings, - or * or 1. lists
 * Inline:  **bold**, *italic* / _italic_, __underline__, ~~strike~~, `code`,
 *          ||spoiler||, links, @mentions (@everyone/@here, @user, @role)
 */

export type MentionContext = {
  /** The reader's username, to highlight mentions of them. */
  selfUsername?: string | null;
  /** Role names in this forge, so @Role Name renders as a role mention. */
  roleNames?: string[];
  /** user id -> username, for bot output like <@uuid>. */
  usernamesById?: Record<string, string>;
  /** This forge's custom emoji: name -> image URL, for :name:. */
  emojis?: Record<string, string>;
};

/** A custom emoji image (or its :name: text if it no longer exists). */
export function CustomEmoji({ name, emojis, size = 22 }: { name: string; emojis?: Record<string, string>; size?: number }) {
  const src = emojis?.[name];
  if (!src) return <>{`:${name}:`}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`:${name}:`} title={`:${name}:`} width={size} height={size} loading="lazy" className="object-contain" style={{ width: size, height: size, display: "inline-block", verticalAlign: "text-bottom" }} />;
}

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"\]]/;

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={shown ? undefined : "Spoiler, click to reveal"}
      onClick={() => setShown(true)}
      onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setShown(true)}
      className={`rounded px-0.5 transition ${shown ? "bg-white/10" : "cursor-pointer bg-slate-600 text-transparent [&_*]:invisible"}`}
    >
      {children}
    </span>
  );
}

type Token = { re: RegExp; render: (match: RegExpExecArray, key: string, ctx: MentionContext) => ReactNode };

function buildTokens(ctx: MentionContext): Token[] {
  const roles = (ctx.roleNames ?? []).filter(Boolean).sort((a, b) => b.length - a.length);
  const escaped = roles.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const tokens: Token[] = [
    { re: /`([^`\n]+)`/, render: (m, key) => <code key={key} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em] text-amber-100">{m[1]}</code> },
    { re: /:([a-z0-9_]{2,30}):/, render: (m, key, c) => <CustomEmoji key={key} name={m[1]} emojis={c.emojis} /> },
    { re: /\|\|([\s\S]+?)\|\|/, render: (m, key, c) => <Spoiler key={key}>{renderInline(m[1], c, key)}</Spoiler> },
    { re: /\*\*([\s\S]+?)\*\*/, render: (m, key, c) => <strong key={key} className="font-semibold text-white">{renderInline(m[1], c, key)}</strong> },
    { re: /__([\s\S]+?)__/, render: (m, key, c) => <u key={key}>{renderInline(m[1], c, key)}</u> },
    { re: /~~([\s\S]+?)~~/, render: (m, key, c) => <s key={key} className="opacity-80">{renderInline(m[1], c, key)}</s> },
    { re: /(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])/, render: (m, key, c) => <em key={key}>{renderInline(m[1], c, key)}</em> },
    { re: /(?<![\w_])_(?!\s)([^_\n]+?)_(?![\w_])/, render: (m, key, c) => <em key={key}>{renderInline(m[1], c, key)}</em> },
    {
      re: URL_RE,
      render: (m, key) => (
        <a key={key} href={m[0]} target="_blank" rel="noopener noreferrer nofollow" className="text-sky-300 underline decoration-sky-300/40 hover:decoration-sky-300">
          {m[0]}
        </a>
      ),
    },
    // Bot output and some clients use <@user-id>.
    {
      re: /<@([0-9a-f-]{36})>/i,
      render: (m, key, c) => {
        const name = c.usernamesById?.[m[1]];
        const self = Boolean(name && c.selfUsername && name.toLowerCase() === c.selfUsername.toLowerCase());
        return <MentionPill key={key} label={`@${name ?? "user"}`} self={self} />;
      },
    },
    { re: /@(everyone|here)\b/, render: (m, key) => <MentionPill key={key} label={m[0]} self /> },
  ];
  if (escaped.length) {
    tokens.push({ re: new RegExp(`@(${escaped.join("|")})(?![\\w])`), render: (m, key) => <MentionPill key={key} label={m[0]} role /> });
  }
  tokens.push({
    re: /@([a-zA-Z0-9_]{2,32})\b/,
    render: (m, key, c) => <MentionPill key={key} label={m[0]} self={Boolean(c.selfUsername && m[1].toLowerCase() === c.selfUsername.toLowerCase())} />,
  });
  return tokens;
}

function MentionPill({ label, self = false, role = false }: { label: string; self?: boolean; role?: boolean }) {
  return (
    <span className={`rounded px-1 font-medium ${self ? "bg-amber-400/25 text-amber-100" : role ? "bg-violet-500/20 text-violet-200" : "bg-sky-500/15 text-sky-200"}`}>{label}</span>
  );
}

const tokenCache = new WeakMap<MentionContext, Token[]>();

/** Inline formatting: finds the earliest-starting token and recurses on what's around it. */
function renderInline(text: string, ctx: MentionContext, keyPrefix = "i"): ReactNode[] {
  let tokens = tokenCache.get(ctx);
  if (!tokens) {
    tokens = buildTokens(ctx);
    tokenCache.set(ctx, tokens);
  }
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    let best: { token: Token; match: RegExpExecArray } | null = null;
    for (const token of tokens) {
      const match = token.re.exec(rest);
      if (match && (!best || match.index < best.match.index)) best = { token, match };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.match.index > 0) out.push(rest.slice(0, best.match.index));
    out.push(best.token.render(best.match, `${keyPrefix}-${n++}`, ctx));
    rest = rest.slice(best.match.index + best.match[0].length);
  }
  return out;
}

/** True when a message mentions the reader (by name, @everyone/@here, or one of their roles). */
export function mentionsReader(raw: string, ctx: MentionContext & { selfRoleNames?: string[] }) {
  const text = plainText(raw);
  if (/@(everyone|here)\b/.test(text)) return true;
  if (ctx.selfUsername && new RegExp(`@${ctx.selfUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) return true;
  return (ctx.selfRoleNames ?? []).some((role) => text.includes(`@${role}`));
}

/** Renders a message body with Discord-style formatting. */
export function RichText({ content, context = {}, className = "" }: { content: string; context?: MentionContext; className?: string }) {
  const text = plainText(content);
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or end)
      blocks.push(
        <pre key={key++} className="my-1 max-w-full overflow-x-auto rounded-lg border border-white/10 bg-black/50 px-3 py-2 font-mono text-[12.5px] leading-relaxed text-slate-200">
          {lang ? <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-slate-500">{lang}</span> : null}
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Quote: consecutive "> " lines.
    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={key++} className="my-0.5 border-l-[3px] border-slate-500/70 pl-2.5 text-slate-300">
          {quoted.map((q, n) => (
            <Fragment key={n}>
              {n > 0 ? <br /> : null}
              {renderInline(q, context, `q${key}-${n}`)}
            </Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Headings.
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const size = heading[1].length === 1 ? "text-xl" : heading[1].length === 2 ? "text-lg" : "text-base";
      blocks.push(<p key={key++} className={`${size} mt-1 font-bold text-white`}>{renderInline(heading[2], context, `h${key}`)}</p>);
      i += 1;
      continue;
    }

    // Lists.
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i += 1;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key++} className={`my-0.5 space-y-0.5 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-slate-500`}>
          {items.map((item, n) => <li key={n}>{renderInline(item, context, `l${key}-${n}`)}</li>)}
        </ListTag>,
      );
      continue;
    }

    // Plain paragraph lines (kept line by line, like Discord).
    const para: string[] = [];
    while (i < lines.length && !lines[i].trimStart().startsWith("```") && !/^>\s?/.test(lines[i]) && !/^(#{1,3})\s+/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className="whitespace-pre-wrap">
        {para.map((p, n) => (
          <Fragment key={n}>
            {n > 0 ? "\n" : null}
            {renderInline(p, context, `p${key}-${n}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className={`break-words text-sm text-slate-100 [overflow-wrap:anywhere] ${className}`}>{blocks}</div>;
}
