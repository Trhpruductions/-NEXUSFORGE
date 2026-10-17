import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small Markdown renderer for legal text: headings (#, ##, ###),
 * paragraphs, "- " and "1. " lists, simple | tables |, **bold**, *italic* and [links](https://...). It builds React
 * elements only (never HTML strings), so policy text can't inject markup or scripts.
 */

export type LegalHeading = { id: string; text: string; level: 2 | 3 };

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string; id: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

const tableCells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export function parseLegal(content: string): { blocks: Block[]; headings: LegalHeading[] } {
  const blocks: Block[] = [];
  const headings: LegalHeading[] = [];
  const used = new Set<string>();
  const uniqueId = (text: string) => {
    const base = slugify(text) || "section";
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  let paragraph: string[] = [];
  let list: string[] | null = null;
  let listKind: "ul" | "ol" = "ul";
  let table: string[][] | null = null;
  const flushList = () => {
    if (list) blocks.push({ kind: listKind, items: list });
    list = null;
  };
  const flushTable = () => {
    if (table?.length) blocks.push({ kind: "table", header: table[0], rows: table.slice(1) });
    table = null;
  };
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
    flushList();
    flushTable();
  };

  for (const raw of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = uniqueId(text);
      blocks.push({ kind: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text, id });
      if (level > 1) headings.push({ id, text, level: level as 2 | 3 });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (paragraph.length || list) flush();
      // The "|---|---|" line under the header is just a divider.
      if (!/^[\s|:-]+$/.test(line)) (table ??= []).push(tableCells(line));
      continue;
    }
    flushTable();
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      if (paragraph.length) {
        blocks.push({ kind: "p", text: paragraph.join(" ") });
        paragraph = [];
      }
      const kind = bullet ? "ul" : "ol";
      if (list && listKind !== kind) flushList();
      listKind = kind;
      (list ??= []).push(item[1]);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    flushList();
    // A line ending a "**Label:** value" run reads better as its own line.
    if (paragraph.length && /^\*\*[^*]+:\*\*/.test(line)) {
      blocks.push({ kind: "p", text: paragraph.join(" ") });
      paragraph = [];
    }
    paragraph.push(line.trim());
  }
  flush();
  return { blocks, headings };
}

function safeHref(href: string) {
  return /^(https:\/\/|mailto:|\/)/i.test(href) ? href : null;
}

/** **bold**, *italic*, [text](href) and highlighted [Placeholders]. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\)|\[[A-Z0-9][^\]]{0,160}\])/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("**")) nodes.push(<strong key={key} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    else if (token.includes("](")) {
      const label = token.slice(1, token.indexOf("]("));
      const href = safeHref(token.slice(token.indexOf("](") + 2, -1));
      nodes.push(href ? <a key={key} href={href} className="text-sky-300 underline underline-offset-2 hover:text-sky-200" rel="noopener noreferrer">{label}</a> : <Fragment key={key}>{label}</Fragment>);
    } else {
      // An unfilled placeholder: make it impossible to miss.
      nodes.push(<mark key={key} className="rounded bg-amber-400/20 px-1 text-amber-100">{token}</mark>);
    }
    last = at + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function LegalMarkdown({ content, onCopySection }: { content: string; onCopySection?: (id: string) => void }) {
  const { blocks } = parseLegal(content);
  return (
    <div className="legal-doc space-y-4 text-[15px] leading-7 text-slate-300">
      {blocks.map((block, i) => {
        if (block.kind === "h1") return <h1 key={i} id={block.id} className="nf-heading scroll-mt-24 text-2xl font-bold text-white sm:text-3xl">{block.text}</h1>;
        if (block.kind === "h2" || block.kind === "h3") {
          const Tag = block.kind;
          return (
            <Tag key={i} id={block.id} className={`group flex scroll-mt-24 items-center gap-2 font-semibold text-white ${block.kind === "h2" ? "border-t border-white/[0.06] pt-6 text-lg sm:text-xl" : "pt-2 text-base"}`}>
              <span>{block.text}</span>
              {onCopySection ? (
                <button type="button" onClick={() => onCopySection(block.id)} className="legal-noprint rounded px-1 text-xs font-normal text-slate-500 opacity-0 transition hover:text-sky-300 focus:opacity-100 group-hover:opacity-100" aria-label={`Copy link to ${block.text}`}>
                  #
                </button>
              ) : null}
            </Tag>
          );
        }
        if (block.kind === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-6 marker:text-violet-400">
              {block.items.map((item, j) => <li key={j}>{inline(item, `${i}-${j}`)}</li>)}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={i} className="list-decimal space-y-1.5 pl-6 marker:text-violet-400">
              {block.items.map((item, j) => <li key={j}>{inline(item, `${i}-${j}`)}</li>)}
            </ol>
          );
        }
        if (block.kind === "table") {
          return (
            <div key={i} className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.12em] text-slate-400">
                  <tr>{block.header.map((cell, j) => <th key={j} scope="col" className="px-3 py-2 font-semibold">{inline(cell, `${i}-h${j}`)}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {block.rows.map((row, r) => (
                    <tr key={r}>{row.map((cell, j) => <td key={j} className="px-3 py-2 align-top">{inline(cell, `${i}-${r}-${j}`)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={i}>{inline(block.text, String(i))}</p>;
      })}
    </div>
  );
}
