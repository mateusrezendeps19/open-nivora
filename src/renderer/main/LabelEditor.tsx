import { useEffect, useRef, useState } from 'react';
import type { Action } from '../shared/reducer';
import { LABEL_COLORS, type Label } from '../shared/types';
import './LabelEditor.css';

interface LabelEditorProps {
  labels: Label[];
  /** How many cards and rules use a label, for the delete confirmation. */
  usage: (labelId: string) => { cards: number; rules: number };
  dispatch: (action: Action) => void;
  onClose: () => void;
}

/** What the confirmation says deleting will do; nothing is hidden behind "tem certeza". */
function removalText(name: string, usage: { cards: number; rules: number }): string {
  let text = `Excluir a etiqueta ${name}?`;
  if (usage.cards) {
    text += ` Ela sai de ${usage.cards} ${usage.cards === 1 ? 'cartao' : 'cartoes'}.`;
  }
  if (usage.rules === 1) text += ' 1 automacao que depende dela muda ou e removida.';
  if (usage.rules > 1) text += ` ${usage.rules} automacoes que dependem dela mudam ou sao removidas.`;
  return `${text} Nao da para desfazer.`;
}

/**
 * Creating and editing the labels, as a popover over the card.
 *
 * It overlays the card instead of pushing it down - opening the editor must
 * not move the rest of the card under the pointer - and it has a size of its
 * own: the list scrolls inside, so twenty labels make the same panel as six.
 *
 * Labels live on the document, not on a board, so an edit here shows up on
 * every board at once - which is why the panel says so rather than letting the
 * change look local to the card that opened it.
 *
 * Deleting asks first and says what it touches: the label leaves every card
 * on every board, and the rules that depend on it change or go (see
 * `rulesWithoutLabel`). There is no undo, as in Trello.
 */
export function LabelEditor({ labels, usage, dispatch, onClose }: LabelEditorProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [newColor, setNewColor] = useState<string>(LABEL_COLORS[0]);

  useEffect(() => {
    // The card body is the scrolling surface, so a panel opened near its
    // bottom edge would otherwise be half out of view.
    panelRef.current?.scrollIntoView({ block: 'nearest' });

    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target || panelRef.current?.contains(target)) return;
      // The button that opened the panel toggles it on click; closing here
      // first would let that click reopen it straight away.
      if (target.closest('.modal__section-action')) return;
      onClose();
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [onClose]);

  function startEdit(label: Label) {
    setEditingId(label.id);
    setDraft(label.name);
    setCreating(false);
    setRemovingId(null);
  }

  function remove(label: Label) {
    dispatch({ type: 'label/remove', labelId: label.id });
    setRemovingId(null);
    setEditingId(null);
  }

  function commitName(label: Label) {
    const name = draft.trim();
    if (name && name !== label.name) {
      dispatch({ type: 'label/update', labelId: label.id, patch: { name } });
    }
    setEditingId(null);
  }

  function create() {
    const name = draft.trim();
    if (!name) return;
    dispatch({ type: 'label/add', name, color: newColor });
    setDraft('');
    setCreating(false);
  }

  function palette(selected: string, onPick: (color: string) => void) {
    return (
      <div className="labels__palette" role="group" aria-label="Cor da etiqueta">
        {LABEL_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            className={`labels__swatch${option === selected ? ' labels__swatch--on' : ''}`}
            style={{ background: option }}
            aria-label={`Cor ${option}`}
            aria-pressed={option === selected}
            onClick={() => onPick(option)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="labels"
      ref={panelRef}
      role="dialog"
      aria-label="Editar etiquetas"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // Escape belongs to the panel while it is open; without this it
        // reaches the window listener and closes the whole card.
        event.stopPropagation();
        if (editingId || creating || removingId) {
          setEditingId(null);
          setCreating(false);
          setRemovingId(null);
          return;
        }
        onClose();
      }}
    >
      <header className="labels__head">
        <strong>Etiquetas</strong>
        <button type="button" className="labels__close" aria-label="Fechar" onClick={onClose}>
          x
        </button>
      </header>

      <p className="labels__hint">Valem para todos os quadros.</p>

      <ul className="labels__list">
        {labels.map((label) => (
          <li key={label.id} className="labels__row">
            {removingId === label.id ? (
              <div className="labels__confirm" role="alertdialog" aria-label={`Excluir ${label.name}`}>
                <p>{removalText(label.name, usage(label.id))}</p>
                <div className="labels__confirm-actions">
                  <button type="button" className="btn btn--danger" onClick={() => remove(label)}>
                    Excluir
                  </button>
                  <button type="button" className="btn btn--subtle" onClick={() => setRemovingId(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : editingId === label.id ? (
              <div className="labels__edit">
                <input
                  className="field"
                  autoFocus
                  value={draft}
                  aria-label={`Nome de ${label.name}`}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commitName(label)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitName(label);
                  }}
                />
                {palette(label.color, (color) =>
                  dispatch({ type: 'label/update', labelId: label.id, patch: { color } }),
                )}
                {/*
                  mousedown is cancelled so the name field keeps the focus: its
                  blur commits and closes this row, which would unmount the
                  button before the click that was meant for it.
                */}
                <button
                  type="button"
                  className="labels__remove"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    commitName(label);
                    setRemovingId(label.id);
                  }}
                >
                  Excluir etiqueta
                </button>
              </div>
            ) : (
              <>
                <span className="labels__chip" style={{ background: label.color }}>
                  {label.name}
                </span>
                <button
                  type="button"
                  className="labels__pencil"
                  aria-label={`Editar ${label.name}`}
                  onClick={() => startEdit(label)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M11.3 2.6a1.4 1.4 0 0 1 2 2l-7 7-2.7.7.7-2.7z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <footer className="labels__foot">
        {creating ? (
          <div className="labels__row labels__row--new">
            <input
              className="field"
              autoFocus
              value={draft}
              placeholder="Nome da etiqueta"
              aria-label="Nome da nova etiqueta"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') create();
              }}
            />
            {palette(newColor, setNewColor)}
            <button
              type="button"
              className="btn btn--primary"
              disabled={!draft.trim()}
              onClick={create}
            >
              Criar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="labels__new"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
              setDraft('');
            }}
          >
            + Criar uma nova etiqueta
          </button>
        )}
      </footer>
    </div>
  );
}
