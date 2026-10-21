/**
 * What the editor toolbar does to the text, as pure functions over the value
 * and the selection: they take what is in the textarea and return what should
 * be, selection included. Nothing here touches the DOM, which is what lets
 * every button be tested without one (tests/textedit.test.ts).
 *
 * Every function is a toggle where that makes sense - pressing Negrito on bold
 * text takes the bold off - because that is what a formatting button means to
 * someone who has used any other editor.
 */

export interface TextState {
  value: string;
  start: number;
  end: number;
}

/**
 * Wrap the selection in `marker` (`**`, `*`, `~~`, a backtick), or unwrap it
 * if it already is. With nothing selected, a placeholder is inserted and left
 * selected, so typing replaces it.
 */
export function toggleWrap(state: TextState, marker: string, placeholder: string): TextState {
  const { value, start, end } = state;
  const size = marker.length;
  const selected = value.slice(start, end);

  // The markers sit just outside the selection: the usual case after a double
  // click on a word that is already bold.
  if (value.slice(start - size, start) === marker && value.slice(end, end + size) === marker) {
    return {
      value: value.slice(0, start - size) + selected + value.slice(end + size),
      start: start - size,
      end: end - size,
    };
  }

  // The markers are inside it: the selection took the asterisks too.
  if (selected.length >= size * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(size, selected.length - size);
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }

  const body = selected || placeholder;
  return {
    value: value.slice(0, start) + marker + body + marker + value.slice(end),
    start: start + size,
    end: start + size + body.length,
  };
}

export type LineKind = 'bullet' | 'ordered' | 'quote' | 'heading';

/** Any prefix a line can carry, so switching kinds replaces instead of stacking. */
const ANY_PREFIX = /^(\s*)(?:[-*+]\s+|\d{1,9}[.)]\s+|>\s?|#{1,3}\s+)/;

const PREFIX: Record<LineKind, RegExp> = {
  bullet: /^(\s*)[-*+]\s+/,
  ordered: /^(\s*)\d{1,9}[.)]\s+/,
  quote: /^(\s*)>\s?/,
  heading: /^(\s*)#{1,3}\s+/,
};

function lineRange(value: string, start: number, end: number) {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  // A selection that ends right after a newline does not take in the next line.
  const stop = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const next = value.indexOf('\n', stop);
  return { from, to: next === -1 ? value.length : next };
}

/**
 * Turn every line the selection touches into a list item, a quote or a
 * heading - or back into a plain line, when all of them already are one.
 * Numbered lists are numbered from 1 in the order the lines come.
 */
export function toggleLinePrefix(state: TextState, kind: LineKind): TextState {
  const { value, start, end } = state;
  const { from, to } = lineRange(value, start, end);
  const lines = value.slice(from, to).split('\n');
  // Blank lines do not vote: a selection of only blank lines - the caret on
  // the empty line just made with Enter - is a line to start the list on,
  // not a list to take apart.
  const written = lines.filter((line) => line.trim());
  const all = written.length > 0 && written.every((line) => PREFIX[kind].test(line));

  let counter = 0;
  const next = lines.map((line) => {
    if (all) return line.replace(PREFIX[kind], '$1');
    if (!line.trim() && lines.length > 1) return line;
    const bare = line.replace(ANY_PREFIX, '$1');
    const indent = /^\s*/.exec(bare)![0];
    const text = bare.slice(indent.length);
    counter += 1;
    const prefix =
      kind === 'bullet' ? '- ' : kind === 'ordered' ? `${counter}. ` : kind === 'quote' ? '> ' : '## ';
    return indent + prefix + text;
  });

  const replaced = next.join('\n');
  const delta = replaced.length - (to - from);
  // A caret on a single line follows its text across the new prefix; a
  // selection over several lines is kept around all of them.
  if (start === end && lines.length === 1) {
    const caret = Math.max(from, start + delta);
    return { value: value.slice(0, from) + replaced + value.slice(to), start: caret, end: caret };
  }
  return { value: value.slice(0, from) + replaced + value.slice(to), start: from, end: to + delta };
}

/** `[selection](url)`, with "url" selected so it can be pasted over. */
export function insertLink(state: TextState): TextState {
  const { value, start, end } = state;
  const label = value.slice(start, end) || 'texto do link';
  const url = 'https://';
  const before = value.slice(0, start) + `[${label}](`;
  return {
    value: before + url + ')' + value.slice(end),
    start: before.length,
    end: before.length + url.length,
  };
}

/** A fenced block on lines of its own around the selection. */
export function insertCodeBlock(state: TextState): TextState {
  const { value, start, end } = state;
  const body = value.slice(start, end) || 'codigo';
  const lead = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
  const tail = end < value.length && value[end] !== '\n' ? '\n' : '';
  const opening = `${lead}\`\`\`\n`;
  return {
    value: value.slice(0, start) + opening + body + '\n```' + tail + value.slice(end),
    start: start + opening.length,
    end: start + opening.length + body.length,
  };
}

const ITEM = /^(\s*)([-*+]|(\d{1,9})([.)]))(\s+)(.*)$/;

/**
 * Enter inside a list item: the next line starts as the next item, numbered
 * one higher. Enter on an item with nothing in it ends the list instead,
 * taking the empty marker away - the way out of a list without reaching for
 * the mouse. Null when the caret is not on an item, so Enter does its usual.
 */
export function continueList(state: TextState): TextState | null {
  const { value, start, end } = state;
  if (start !== end) return null;
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', start);
  const line = value.slice(from, lineEnd === -1 ? value.length : lineEnd);
  const match = ITEM.exec(line);
  if (!match) return null;

  const [, indent, bullet, number, close, gap, text] = match;
  if (!text.trim()) {
    return { value: value.slice(0, from) + value.slice(from + line.length), start: from, end: from };
  }
  const marker = number ? `${Number.parseInt(number, 10) + 1}${close}` : bullet;
  const insert = `\n${indent}${marker}${gap}`;
  return {
    value: value.slice(0, start) + insert + value.slice(end),
    start: start + insert.length,
    end: start + insert.length,
  };
}

/**
 * Tab and Shift+Tab on list items move them one level in or out, which is how
 * a list inside a list is made. Null off a list, so Tab keeps moving focus.
 */
export function indentList(state: TextState, outdent: boolean): TextState | null {
  const { value, start, end } = state;
  const { from, to } = lineRange(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const written = lines.filter((line) => line.trim());
  if (!written.length || !written.every((line) => ITEM.test(line))) return null;

  let first = 0;
  let total = 0;
  const next = lines.map((line, index) => {
    if (!line.trim()) return line;
    if (outdent) {
      const cut = Math.min(2, /^ */.exec(line)![0].length);
      if (index === 0) first = -cut;
      total -= cut;
      return line.slice(cut);
    }
    if (index === 0) first = 2;
    total += 2;
    return `  ${line}`;
  });

  return {
    value: value.slice(0, from) + next.join('\n') + value.slice(to),
    start: Math.max(from, start + first),
    end: Math.max(from, end + total),
  };
}
