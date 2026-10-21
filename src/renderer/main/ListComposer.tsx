import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../shared/i18n/context';
import './Composer.css';

interface ListComposerProps {
  onAdd: (title: string) => void;
}

/** The trailing "add another list" column. */
export function ListComposer({ onAdd }: ListComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { m } = useI18n();

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
            placeholder={m.composer.listTitle}
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
              {m.composer.addList}
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
        </>
      ) : (
        <button type="button" className="list-composer__open" onClick={() => setOpen(true)}>
          {m.composer.addAnotherList}
        </button>
      )}
    </div>
  );
}
