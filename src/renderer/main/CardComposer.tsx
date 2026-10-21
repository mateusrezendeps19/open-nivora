import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../shared/i18n/context';
import './Composer.css';

interface CardComposerProps {
  onAdd: (title: string) => void;
}

/** Adds a card at the end of a list. Enter submits and stays open. */
export function CardComposer({ onAdd }: CardComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const { m } = useI18n();

  useEffect(() => {
    if (open) areaRef.current?.focus();
  }, [open]);

  function submit() {
    const next = title.trim();
    if (!next) return;
    onAdd(next);
    setTitle('');
    areaRef.current?.focus();
  }

  if (!open) {
    return (
      <button type="button" className="composer__open" onClick={() => setOpen(true)}>
        {m.composer.addCard}
      </button>
    );
  }

  return (
    <div className="composer">
      <textarea
        ref={areaRef}
        className="composer__input field"
        rows={2}
        value={title}
        placeholder={m.composer.cardTitle}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape') {
            setTitle('');
            setOpen(false);
          }
        }}
      />
      <div className="composer__actions">
        <button type="button" className="btn btn--primary" onClick={submit}>
          {m.composer.add}
        </button>
        <button
          type="button"
          className="btn btn--subtle"
          onClick={() => {
            setTitle('');
            setOpen(false);
          }}
        >
          {m.common.cancel}
        </button>
      </div>
    </div>
  );
}
