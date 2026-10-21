import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Messages } from '../shared/i18n';
import { useI18n } from '../shared/i18n/context';
import {
  continueList,
  indentList,
  insertCodeBlock,
  insertLink,
  toggleLinePrefix,
  toggleWrap,
  type TextState,
} from '../shared/textEdit';
import { RichText } from './RichText';
import './RichEditor.css';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * A single line with no toolbar until it is first focused, the way the
   * comment box in Trello sits until it is clicked. It does not fold back up
   * when the focus leaves - see the `opened` state.
   */
  compact?: boolean;
  /** Ctrl+Enter. */
  onSubmit?: () => void;
  /** Escape. Without it, Escape goes on to close the card as it always has. */
  onCancel?: () => void;
  className?: string;
}

interface Tool {
  label: string;
  icon: ReactNode;
  apply: (state: TextState) => TextState;
  /**
   * Only in the full editor. The comment box lives in the card's side column,
   * 300px wide at the main window's minimum size, and the whole toolbar needs
   * more than that: titles and code blocks are what a comment can do without
   * a button for, and both still render when typed by hand.
   */
  fullOnly?: boolean;
}

const svg = (path: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    {path}
  </svg>
);

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' } as const;

/*
 * The groups follow Trello's toolbar: text style, inline marks, block kinds,
 * then insertions. The shortcuts in the labels are the ones the textarea
 * actually answers to. A function of the language, because the word a mark
 * wraps when nothing is selected is in it too.
 */
const tools = (t: Messages['rich']): Tool[][] => [
  [
    {
      label: t.heading,
      icon: <span className="rich__glyph rich__glyph--heading">T</span>,
      apply: (s) => toggleLinePrefix(s, 'heading'),
      fullOnly: true,
    },
  ],
  [
    {
      label: t.bold,
      icon: <span className="rich__glyph rich__glyph--bold">B</span>,
      apply: (s) => toggleWrap(s, '**', t.boldSample),
    },
    {
      label: t.italic,
      icon: <span className="rich__glyph rich__glyph--italic">I</span>,
      apply: (s) => toggleWrap(s, '*', t.italicSample),
    },
    {
      label: t.strike,
      icon: <span className="rich__glyph rich__glyph--strike">S</span>,
      apply: (s) => toggleWrap(s, '~~', t.strikeSample),
    },
    {
      label: t.code,
      icon: svg(<path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" {...stroke} />),
      apply: (s) => toggleWrap(s, '`', t.codeSample),
    },
  ],
  [
    {
      label: t.bullet,
      icon: svg(
        <>
          <circle cx="3" cy="4" r="1.2" fill="currentColor" />
          <circle cx="3" cy="8" r="1.2" fill="currentColor" />
          <circle cx="3" cy="12" r="1.2" fill="currentColor" />
          <path d="M6.5 4H14M6.5 8H14M6.5 12H14" {...stroke} />
        </>,
      ),
      apply: (s) => toggleLinePrefix(s, 'bullet'),
    },
    {
      label: t.ordered,
      icon: svg(
        <>
          <text x="0.5" y="6" fontSize="5.5" fill="currentColor" fontFamily="sans-serif">1</text>
          <text x="0.5" y="13.5" fontSize="5.5" fill="currentColor" fontFamily="sans-serif">2</text>
          <path d="M6.5 4H14M6.5 8H14M6.5 12H14" {...stroke} />
        </>,
      ),
      apply: (s) => toggleLinePrefix(s, 'ordered'),
    },
    {
      label: t.quote,
      icon: svg(<path d="M3 3.5v9M6.5 5H13M6.5 8H13M6.5 11H11" {...stroke} />),
      apply: (s) => toggleLinePrefix(s, 'quote'),
    },
  ],
  [
    {
      label: t.link,
      icon: svg(
        <path
          d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.3-2.3a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.2 9.1a2.6 2.6 0 0 0 3.7 3.7l.9-.9"
          {...stroke}
        />,
      ),
      apply: (s) => insertLink(s, t.linkSample),
    },
    {
      label: t.codeBlock,
      icon: svg(
        <>
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" {...stroke} />
          <path d="M6 6.5 4.5 8 6 9.5M10 6.5 11.5 8 10 9.5" {...stroke} />
        </>,
      ),
      apply: (s) => insertCodeBlock(s, t.codeSample),
      fullOnly: true,
    },
  ],
];

/**
 * A Markdown textarea with Trello's formatting toolbar over it.
 *
 * Trello's own editor is WYSIWYG and is not in the asar - it comes from
 * trello.com like the rest of the board - so this is ours. What it keeps from
 * Trello is the contract: the text is stored as Markdown, the toolbar writes
 * that Markdown for you, and what you read afterwards is the formatted result
 * (RichText). "Visualizar" shows that result before saving.
 *
 * The textarea grows with its content (`field-sizing`) instead of scrolling,
 * because nothing inside the card body may be a second scroller.
 */
export function RichEditor({
  value,
  onChange,
  ariaLabel,
  placeholder,
  autoFocus,
  compact,
  onSubmit,
  onCancel,
  className,
}: RichEditorProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const { m } = useI18n();
  const t = m.rich;
  const toolbar = useMemo(() => tools(t), [t]);
  /**
   * Once open, a compact box stays open. Folding the toolbar away on blur
   * moves everything under the box up by the toolbar's height in the middle
   * of the click that took the focus away: the button pressed is no longer
   * under the pointer when the button comes up, and the click is lost. That
   * is what happened to "Editar" on the comment right below this box.
   */
  const [opened, setOpened] = useState(false);
  /** Where the selection goes once React has rendered the new value. */
  const pending = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || !pending.current) return;
    area.setSelectionRange(pending.current.start, pending.current.end);
    pending.current = null;
  });

  /**
   * Replaces only the part of the text that changed, through `insertText`,
   * so the edit goes on the textarea's own undo stack and Ctrl+Z takes the
   * bold back off. Setting the value from React would empty that stack on
   * every button press. If the command is refused, the value is set directly
   * and only undo is lost.
   */
  function apply(next: TextState) {
    const area = areaRef.current;
    if (!area) return;
    const old = area.value;
    let head = 0;
    while (head < old.length && head < next.value.length && old[head] === next.value[head]) head += 1;
    let tail = 0;
    while (
      tail < old.length - head &&
      tail < next.value.length - head &&
      old[old.length - 1 - tail] === next.value[next.value.length - 1 - tail]
    ) {
      tail += 1;
    }

    area.focus();
    if (old !== next.value) {
      area.setSelectionRange(head, old.length - tail);
      const text = next.value.slice(head, next.value.length - tail);
      const done = document.execCommand(text ? 'insertText' : 'delete', false, text);
      // Only the fallback parks the selection for after a render, because only
      // the fallback is guaranteed to cause one. A selection parked by an edit
      // that rendered nothing - a button that changed no text - waited for the
      // next render there was, which was the next keystroke's, and threw the
      // caret back to where that button had left it: typing came out
      // scrambled. When the command worked, the selection is set right here.
      if (!done || area.value !== next.value) {
        onChange(next.value);
        pending.current = { start: next.start, end: next.end };
      }
    }
    area.setSelectionRange(next.start, next.end);
  }

  const current = (): TextState => {
    const area = areaRef.current!;
    return { value: area.value, start: area.selectionStart, end: area.selectionEnd };
  };

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    // The window listens for Ctrl+K (search) and Escape (close the card); while
    // typing here, those keys belong to the editor.
    const take = (next: TextState | null) => {
      event.preventDefault();
      event.stopPropagation();
      if (next) apply(next);
    };

    if (mod && key === 'enter') {
      if (!onSubmit) return;
      take(null);
      onSubmit();
      return;
    }
    if (mod && !event.shiftKey && key === 'b') return take(toggleWrap(current(), '**', t.boldSample));
    if (mod && !event.shiftKey && key === 'i') return take(toggleWrap(current(), '*', t.italicSample));
    if (mod && !event.shiftKey && key === 'e') return take(toggleWrap(current(), '`', t.codeSample));
    if (mod && event.shiftKey && key === 'x') return take(toggleWrap(current(), '~~', t.strikeSample));
    if (mod && !event.shiftKey && key === 'k') return take(insertLink(current(), t.linkSample));

    if (key === 'escape' && onCancel) {
      take(null);
      onCancel();
      return;
    }
    if (key === 'enter' && !mod && !event.shiftKey && !event.nativeEvent.isComposing) {
      const next = continueList(current());
      if (next) take(next);
      return;
    }
    if (key === 'tab' && !mod) {
      const next = indentList(current(), event.shiftKey);
      if (next) take(next);
    }
  }

  return (
    <div
      className={[
        'rich',
        compact && !opened && !value ? 'rich--folded' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onFocus={() => setOpened(true)}
    >
      <div className="rich__toolbar" role="toolbar" aria-label={t.toolbar}>
        {toolbar.map((all) => all.filter((tool) => !compact || !tool.fullOnly))
          .filter((group) => group.length > 0)
          .map((group, index) => (
          <div key={index} className="rich__group">
            {group.map((tool) => (
              <button
                key={tool.label}
                type="button"
                className="rich__tool"
                title={tool.label}
                aria-label={tool.label}
                disabled={preview}
                // Keeps the focus, and with it the selection the tool acts on,
                // in the textarea.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => apply(tool.apply(current()))}
              >
                {tool.icon}
              </button>
            ))}
          </div>
        ))}
        <button
          type="button"
          className={`rich__tool rich__mode${preview ? ' rich__mode--on' : ''}`}
          aria-pressed={preview}
          // An icon and not the word: the comment box sits in the narrow side
          // column, where "Visualizar" in letters pushed the toolbar onto a
          // second row.
          title={preview ? t.backToEdit : t.preview}
          aria-label={preview ? t.backToEdit : t.preview}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            // The textarea is about to unmount with the focus in it. Moving
            // the focus here first keeps it inside the editor, so a parent
            // that saves when focus leaves (the description) does not read
            // switching to the preview as the user walking away.
            event.currentTarget.focus();
            setPreview((on) => !on);
            if (preview) requestAnimationFrame(() => areaRef.current?.focus());
          }}
        >
          {svg(
            <>
              <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z" {...stroke} />
              <circle cx="8" cy="8" r="2" {...stroke} />
            </>,
          )}
        </button>
      </div>

      {preview ? (
        <div className="rich__preview" tabIndex={0}>
          {value.trim() ? (
            <RichText source={value} />
          ) : (
            <p className="rich__empty">{t.previewEmpty}</p>
          )}
        </div>
      ) : (
        <textarea
          ref={areaRef}
          className="rich__input"
          rows={compact ? 1 : 4}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  );
}
