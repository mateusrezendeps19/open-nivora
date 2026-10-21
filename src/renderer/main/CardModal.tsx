import { useEffect, useRef, useState } from 'react';
import type { Action } from '../shared/reducer';
import type { Card, Label } from '../shared/types';
import { removeAsset } from '../shared/assets';
import { fromDateInput, toDateInput } from '../shared/calendar';
import { Attachments } from './Attachments';
import { CardActivity } from './CardActivity';
import { LabelEditor } from './LabelEditor';
import { RichEditor } from './RichEditor';
import { RichText } from './RichText';
import './CardModal.css';

interface CardModalProps {
  card: Card;
  listTitle: string;
  labels: Label[];
  confirmDelete: boolean;
  onClose: () => void;
  dispatch: (action: Action) => void;
}

export function CardModal({
  card,
  listTitle,
  labels,
  confirmDelete,
  onClose,
  dispatch,
}: CardModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [checkItem, setCheckItem] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [editingLabels, setEditingLabels] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Switching cards while the modal is open has to reload the drafts.
  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description);
    setConfirming(false);
    setEditingLabels(false);
  }, [card.id, card.description, card.title]);

  // Only a different card ends the editing; the description changing under
  // it is this editor's own save arriving back from the store.
  useEffect(() => {
    setEditingDescription(false);
  }, [card.id]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  function commitTitle() {
    const next = title.trim();
    if (next && next !== card.title) {
      dispatch({ type: 'card/update', cardId: card.id, patch: { title: next } });
    } else {
      setTitle(card.title);
    }
  }

  function commitDescription() {
    if (description !== card.description) {
      dispatch({ type: 'card/update', cardId: card.id, patch: { description } });
    }
  }

  function saveDescription() {
    commitDescription();
    setEditingDescription(false);
  }

  function cancelDescription() {
    setDescription(card.description);
    setEditingDescription(false);
  }

  function toggleLabel(labelId: string) {
    const next = card.labelIds.includes(labelId)
      ? card.labelIds.filter((value) => value !== labelId)
      : [...card.labelIds, labelId];
    dispatch({ type: 'card/update', cardId: card.id, patch: { labelIds: next } });
  }

  function remove() {
    if (confirmDelete && !confirming) {
      setConfirming(true);
      return;
    }
    // Delete the card's files too, or they would linger until the next sweep.
    for (const attachment of card.attachments) void removeAsset(attachment.asset);
    dispatch({ type: 'card/remove', cardId: card.id });
    onClose();
  }

  const done = card.checklist.filter((item) => item.done).length;
  const progress = card.checklist.length ? Math.round((done / card.checklist.length) * 100) : 0;

  return (
    <div
      className="modal__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Cartao ${card.title}`}
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="modal__header">
          <button
            type="button"
            className={`modal__done${card.done ? ' modal__done--on' : ''}`}
            aria-pressed={card.done}
            title={card.done ? 'Marcar como nao concluido' : 'Marcar como concluido'}
            onClick={() =>
              dispatch({ type: 'card/update', cardId: card.id, patch: { done: !card.done } })
            }
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 8.5 6.2 11.7 13 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {card.done ? 'Concluido' : 'Marcar como concluido'}
          </button>

          <textarea
            className="modal__title"
            rows={1}
            value={title}
            aria-label="Titulo do cartao"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTitle();
                event.currentTarget.blur();
              }
            }}
          />
          <p className="modal__context">
            na lista <strong>{listTitle}</strong>
          </p>
          <button type="button" className="modal__close" aria-label="Fechar" onClick={onClose}>
            x
          </button>
        </header>

        <div className="modal__body">
          <div className="modal__main">
            <section className="modal__section modal__section--labels">
              <h3>
                Etiquetas
                <button
                  type="button"
                  className="modal__section-action"
                  aria-expanded={editingLabels}
                  onClick={() => setEditingLabels((open) => !open)}
                >
                  {editingLabels ? 'Concluir' : 'Editar etiquetas'}
                </button>
              </h3>
              <div className="modal__labels">
                {labels.map((label) => {
                  const on = card.labelIds.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      className={`modal__label${on ? ' modal__label--on' : ''}`}
                      style={{ background: label.color }}
                      aria-pressed={on}
                      onClick={() => toggleLabel(label.id)}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>

              {editingLabels && (
                <LabelEditor
                  labels={labels}
                  dispatch={dispatch}
                  onClose={() => setEditingLabels(false)}
                />
              )}
            </section>

            <section className="modal__section">
              <h3>Prazo</h3>
              <div className="modal__due">
                <input
                  type="date"
                  className="field"
                  value={toDateInput(card.due)}
                  onChange={(event) =>
                    dispatch({
                      type: 'card/update',
                      cardId: card.id,
                      patch: {
                        due: fromDateInput(event.target.value, card.due),
                      },
                    })
                  }
                />
                {card.due && (
                  <button
                    type="button"
                    className="btn btn--subtle"
                    onClick={() =>
                      dispatch({ type: 'card/update', cardId: card.id, patch: { due: null } })
                    }
                  >
                    Remover
                  </button>
                )}
              </div>
            </section>

            {/*
              Read formatted, edited on demand, as in Trello. Leaving the
              editor by clicking elsewhere saves - the old textarea saved on
              blur, and nobody should lose a description for not pressing
              Salvar - but leaves it open. Folding it into the shorter
              formatted view at that moment would move everything below it
              up in the middle of the click that left, and that click would
              land on whatever slid under the pointer.
            */}
            <section
              className="modal__section"
              onBlur={(event) => {
                if (!editingDescription) return;
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                commitDescription();
              }}
            >
              <h3>
                Descricao
                {!editingDescription && card.description && (
                  <button
                    type="button"
                    className="modal__description-edit"
                    onClick={() => setEditingDescription(true)}
                  >
                    Editar
                  </button>
                )}
              </h3>
              {editingDescription ? (
                <>
                  <RichEditor
                    autoFocus
                    value={description}
                    ariaLabel="Descricao"
                    placeholder="Adicione mais detalhes..."
                    onChange={setDescription}
                    onSubmit={saveDescription}
                    onCancel={cancelDescription}
                    className="modal__description"
                  />
                  <div className="modal__description-actions">
                    <button type="button" className="btn btn--primary" onClick={saveDescription}>
                      Salvar
                    </button>
                    <button type="button" className="btn btn--subtle" onClick={cancelDescription}>
                      Cancelar
                    </button>
                  </div>
                </>
              ) : card.description ? (
                <div
                  className="modal__description-view"
                  role="button"
                  tabIndex={0}
                  aria-label="Editar descricao"
                  // A click on a link follows the link; anywhere else edits.
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('a')) return;
                    setEditingDescription(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && event.target === event.currentTarget) {
                      event.preventDefault();
                      setEditingDescription(true);
                    }
                  }}
                >
                  <RichText source={card.description} />
                </div>
              ) : (
                <button
                  type="button"
                  className="modal__description-empty"
                  onClick={() => setEditingDescription(true)}
                >
                  Adicione uma descricao mais detalhada...
                </button>
              )}
            </section>

            <Attachments card={card} dispatch={dispatch} />

            <section className="modal__section">
              <h3>
                Checklist{' '}
                {card.checklist.length > 0 && (
                  <span className="modal__progress-label">
                    {done}/{card.checklist.length}
                  </span>
                )}
              </h3>

              {card.checklist.length > 0 && (
                <div className="modal__progress">
                  <div className="modal__progress-bar" style={{ width: `${progress}%` }} />
                </div>
              )}

              <ul className="modal__checklist">
                {card.checklist.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() =>
                          dispatch({ type: 'checklist/toggle', cardId: card.id, itemId: item.id })
                        }
                      />
                      <span className={item.done ? 'modal__check-done' : ''}>{item.text}</span>
                    </label>
                    <button
                      type="button"
                      className="modal__check-remove"
                      aria-label={`Remover ${item.text}`}
                      onClick={() =>
                        dispatch({ type: 'checklist/remove', cardId: card.id, itemId: item.id })
                      }
                    >
                      x
                    </button>
                  </li>
                ))}
              </ul>

              <input
                className="field"
                value={checkItem}
                placeholder="Adicionar item e pressionar Enter"
                onChange={(event) => setCheckItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  const text = checkItem.trim();
                  if (!text) return;
                  dispatch({ type: 'checklist/add', cardId: card.id, text });
                  setCheckItem('');
                }}
              />
            </section>
          </div>

          <aside className="modal__side">
            <CardActivity card={card} dispatch={dispatch} />
          </aside>
        </div>

        <footer className="modal__footer">
          <span className="modal__created">
            Criado em {new Date(card.createdAt).toLocaleString('pt-BR')}
          </span>
          <button type="button" className="btn btn--danger" onClick={remove}>
            {confirming ? 'Confirmar exclusao' : 'Excluir cartao'}
          </button>
        </footer>
      </div>
    </div>
  );
}
