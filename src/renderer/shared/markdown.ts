/**
 * The Markdown subset that descriptions and comments are written in.
 *
 * The text stays Markdown in the document, as Trello keeps it: a card written
 * before the editor existed is plain text, and plain text is already valid
 * here, so nothing has to be migrated. The editor toolbar only ever writes
 * this syntax (shared/textEdit.ts), and RichText draws it.
 *
 * This produces a tree, never HTML. RichText turns the tree into React
 * elements, so whatever a user types is text to React, and there is no string
 * of markup anywhere for a `<script>` or an `onerror=` to hide in.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'strike'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'break' };

export interface ListItem {
  content: Inline[];
  /** Lists indented under this item. */
  children: Block[];
}

export type Block =
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { type: 'quote'; children: Block[] }
  | { type: 'code'; text: string }
  | { type: 'rule' };

const FENCE = /^\s*```/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;

/** Indentation in columns, a tab counting as the four it usually renders as. */
function indentOf(line: string): number {
  let width = 0;
  for (const char of line) {
    if (char === ' ') width += 1;
    else if (char === '\t') width += 4;
    else break;
  }
  return width;
}

const startsBlock = (line: string) =>
  FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) ||
  LIST_ITEM.test(line);

export function parseMarkdown(source: string): Block[] {
  return parseBlocks(source.replace(/\r\n?/g, '\n').split('\n'));
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (FENCE.test(line)) {
      const body: string[] = [];
      i += 1;
      // An unclosed fence runs to the end, as it does everywhere else: the
      // alternative is guessing where the user meant it to stop.
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        children: parseInline(heading[2].trim()),
      });
      i += 1;
      continue;
    }

    // Before lists: "- - -" is a rule, and also looks like a list item.
    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(QUOTE.exec(lines[i++])![1]);
      blocks.push({ type: 'quote', children: parseBlocks(body) });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const start = i;
      const base = indentOf(line);
      i += 1;
      // A list runs while its lines are items or are indented under one; a
      // blank line ends it unless the list carries on right after.
      while (i < lines.length) {
        const next = lines[i];
        if (!next.trim()) {
          const after = lines[i + 1];
          if (after !== undefined && LIST_ITEM.test(after) && indentOf(after) >= base) {
            i += 1;
            continue;
          }
          break;
        }
        if (LIST_ITEM.test(next) ? indentOf(next) >= base : indentOf(next) > base) {
          i += 1;
          continue;
        }
        break;
      }
      blocks.push(...parseList(lines.slice(start, i).filter((entry) => entry.trim())));
      continue;
    }

    const body: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) body.push(lines[i++]);
    blocks.push({ type: 'paragraph', children: inlineLines(body) });
  }

  return blocks;
}

/**
 * Items at the indentation of the first line make the list; anything indented
 * further belongs to the item above it and is parsed again as blocks of its
 * own, which is what nests a list inside a list. A switch between bullets and
 * numbers at the same level starts a new list, as it reads.
 */
function parseList(lines: string[]): Block[] {
  const base = indentOf(lines[0]);
  const lists: Block[] = [];
  let current: Extract<Block, { type: 'list' }> | null = null;
  let item: ListItem | null = null;
  let nested: string[] = [];

  const flush = () => {
    if (item && nested.length) item.children = parseBlocks(dedent(nested));
    nested = [];
  };

  for (const line of lines) {
    const match = LIST_ITEM.exec(line);
    if (match && indentOf(line) <= base) {
      flush();
      const ordered = /\d/.test(match[2]);
      if (!current || current.ordered !== ordered) {
        current = { type: 'list', ordered, start: ordered ? Number.parseInt(match[2], 10) : 1, items: [] };
        lists.push(current);
      }
      item = { content: parseInline(match[3]), children: [] };
      current.items.push(item);
    } else {
      nested.push(line);
    }
  }
  flush();
  return lists;
}

function dedent(lines: string[]): string[] {
  const cut = Math.min(...lines.map(indentOf));
  return lines.map((line) => line.slice(Math.min(cut, line.length - line.trimStart().length)));
}

/** A single newline inside a paragraph is a line break, as Trello draws it. */
function inlineLines(lines: string[]): Inline[] {
  const out: Inline[] = [];
  lines.forEach((line, index) => {
    if (index > 0) out.push({ type: 'break' });
    out.push(...parseInline(line.trim()));
  });
  return out;
}

/**
 * Only these schemes become links. Anything else - `javascript:` above all -
 * stays the text the user typed.
 */
export function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

type Rule = {
  pattern: RegExp;
  build: (match: RegExpExecArray) => Inline | null;
};

/*
 * Earliest match wins; at the same position, the order here does - `**` has
 * to be tried before `*`, and code before everything, because nothing inside
 * backticks is formatting.
 */
const RULES: Rule[] = [
  { pattern: /`([^`\n]+)`/, build: (m) => ({ type: 'code', text: m[1] }) },
  {
    pattern: /\[([^\]\n]+)\]\(([^)\s]+)\)/,
    build: (m) => {
      const href = safeHref(m[2]);
      return href ? { type: 'link', href, children: parseInline(m[1]) } : null;
    },
  },
  // Inside bold, an asterisk is only allowed as a whole italic span, so that
  // `**muito *importante***` closes after the italic and not inside it.
  {
    pattern: /\*\*(?=\S)((?:[^*\n]|\*[^*\n]+\*)+?)(?<=\S)\*\*/,
    build: (m) => ({ type: 'strong', children: parseInline(m[1]) }),
  },
  { pattern: /__(?=\S)([^\n]*?\S)__/, build: (m) => ({ type: 'strong', children: parseInline(m[1]) }) },
  { pattern: /~~(?=\S)([^\n]*?\S)~~/, build: (m) => ({ type: 'strike', children: parseInline(m[1]) }) },
  { pattern: /\*(?=\S)([^*\n]*?\S)\*/, build: (m) => ({ type: 'em', children: parseInline(m[1]) }) },
  // Underscores only at word edges, or every snake_case name turns italic.
  {
    pattern: /(?<![\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/u,
    build: (m) => ({ type: 'em', children: parseInline(m[1]) }),
  },
  {
    pattern: /\b(?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)\]'"]/i,
    build: (m) => {
      const href = safeHref(m[0]);
      return href ? { type: 'link', href, children: [{ type: 'text', text: m[0] }] } : null;
    },
  },
];

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest) {
    let best: { index: number; match: RegExpExecArray; rule: Rule } | null = null;
    for (const rule of RULES) {
      const match = rule.pattern.exec(rest);
      if (match && (!best || match.index < best.index)) best = { index: match.index, match, rule };
    }
    const node = best ? best.rule.build(best.match) : null;
    if (!best || !node) {
      // A match that refuses to build (an unsafe link) is left as text, and the
      // scan moves past its first character so it is not found again.
      const cut = best ? best.index + 1 : rest.length;
      pushText(out, rest.slice(0, cut));
      rest = rest.slice(cut);
      continue;
    }
    pushText(out, rest.slice(0, best.index));
    out.push(node);
    rest = rest.slice(best.index + best.match[0].length);
  }
  return out;
}

function pushText(out: Inline[], text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last?.type === 'text') last.text += text;
  else out.push({ type: 'text', text });
}
