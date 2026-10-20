import { useEffect, useRef, useState } from 'react';
import './Composer.css';

interface ListComposerProps {
  onAdd: (title: string) => void;
}

/** The trailing "add another list" column. */
export function ListComposer({ onAdd }: ListComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit() {
    const next = title.trim();
    if (!next) return;
    onAdd(next);
    setTitle('');
    inputRef.current?.focus();
  }

  return (
    <div className="list-composer">
      {open ? (
        <>
          <input
            ref={inputRef}
            className="field"
            value={title}
            placeholder="Titulo da lista"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
              if (event.key === 'Escape') {
                setTitle('');
                setOpen(false);
              }
            }}
          />
          <div className="composer__actions">
            <button type="button" className="btn btn--primary" onClick={submit}>
              Adicionar lista
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
        </>
      ) : (
        <button type="button" className="list-composer__open" onClick={() => setOpen(true)}>
          + Adicionar outra lista
        </button>
      )}
    </div>
  );
}
