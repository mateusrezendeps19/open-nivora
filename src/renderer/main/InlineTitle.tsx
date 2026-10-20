import { useEffect, useRef, useState } from 'react';

interface InlineTitleProps {
  value: string;
  className?: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
}

/** Click-to-edit text, used for list and board titles. */
export function InlineTitle({ value, className, ariaLabel, onCommit }: InlineTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Adopt external renames while not editing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => setEditing(true)}
        title={ariaLabel}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className={`${className ?? ''} field`}
      aria-label={ariaLabel}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
