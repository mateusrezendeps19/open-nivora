import { useEffect, useRef, useState } from 'react';
import './Composer.css';

interface CardComposerProps {
  onAdd: (title: string) => void;
}

/** Adds a card at the end of a list. Enter submits and stays open. */
export function CardComposer({ onAdd }: CardComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);

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
        + Adicionar cartao
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
        placeholder="Titulo do cartao"
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
          Adicionar
        </button>
        <button
          type="button"
          className="btn btn--subtle"
          onClick={() => {
            setTitle('');
            setOpen(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
