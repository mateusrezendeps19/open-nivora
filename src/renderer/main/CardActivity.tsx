import { useState } from 'react';
import { relativeTime } from '../shared/calendar';
import type { Action } from '../shared/reducer';
import type { Card } from '../shared/types';
import './CardActivity.css';

interface CardActivityProps {
  card: Card;
  dispatch: (action: Action) => void;
}

/**
 * "Comentarios e atividade": one feed, newest first, holding both what the
 * user wrote and what the reducer logged.
 *
 * Only comments can be edited or deleted. The events are the record of what
 * happened to the card, and a history worth having is not one the card's owner
 * can rewrite.
 */
export function CardActivity({ card, dispatch }: CardActivityProps) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Newest first for reading, while the document keeps them in the order they
  // happened. A copy, because reverse mutates.
  const feed = [...card.activity].reverse();
  const comments = card.activity.reduce(
    (total, entry) => total + (entry.kind === 'comment' ? 1 : 0),
    0,
  );

  function submit() {
    const text = draft.trim();
    if (!text) return;
    dispatch({ type: 'comment/add', cardId: card.id, text });
    setDraft('');
  }

  function commitEdit(activityId: string) {
    const text = editDraft.trim();
    if (text) dispatch({ type: 'comment/update', cardId: card.id, activityId, text });
    setEditingId(null);
  }

  return (
    <section className="modal__section">
      <h3>
        Comentarios e atividade{' '}
        {comments > 0 && <span className="modal__progress-label">{comments}</span>}
      </h3>

      <div className="activity__compose">
        <textarea
          className="field"
          rows={2}
          value={draft}
          placeholder="Escreva um comentario..."
          aria-label="Escreva um comentario"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends and Shift+Enter breaks the line, as in the composers.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="btn btn--primary" disabled={!draft.trim()} onClick={submit}>
          Comentar
        </button>
      </div>

      {feed.length === 0 ? (
        <p className="activity__empty">Nada aconteceu com este cartao ainda.</p>
      ) : (
        <ul className="activity">
          {feed.map((entry) =>
            entry.kind === 'comment' ? (
              <li key={entry.id} className="activity__item activity__item--comment">
                {editingId === entry.id ? (
                  <>
                    <textarea
                      className="field"
                      rows={2}
                      autoFocus
                      value={editDraft}
                      aria-label="Editar comentario"
                      onChange={(event) => setEditDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          commitEdit(entry.id);
                        }
                        if (event.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <div className="activity__actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => commitEdit(entry.id)}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="btn btn--subtle"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="activity__text">{entry.text}</p>
                    <div className="activity__actions">
                      <span className="activity__when">
                        {relativeTime(entry.at)}
                        {entry.editedAt && ' (editado)'}
                      </span>
                      <button
                        type="button"
                        className="activity__link"
                        onClick={() => {
                          setEditingId(entry.id);
                          setEditDraft(entry.text);
                          setRemovingId(null);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="activity__link activity__link--danger"
                        onClick={() => {
                          if (removingId !== entry.id) {
                            setRemovingId(entry.id);
                            return;
                          }
                          dispatch({
                            type: 'comment/remove',
                            cardId: card.id,
                            activityId: entry.id,
                          });
                          setRemovingId(null);
                        }}
                      >
                        {removingId === entry.id ? 'Confirmar' : 'Excluir'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ) : (
              <li key={entry.id} className="activity__item">
                <span className="activity__dot" aria-hidden="true" />
                <p className="activity__event">
                  {entry.text} <span className="activity__when">{relativeTime(entry.at)}</span>
                </p>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
