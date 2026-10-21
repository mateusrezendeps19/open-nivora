import { useRef, useState, type RefObject } from 'react';
import type { Action } from '../shared/reducer';
import type { Board, List } from '../shared/types';
import { useI18n } from '../shared/i18n/context';
import { useDismiss } from './useDismiss';
import './ListMenu.css';

interface ListMenuProps {
  list: List;
  /** Where the list sits on its board, counting from 0. */
  listIndex: number;
  board: Board;
  boards: Board[];
  /** The "..." button: a mousedown on it is its own toggle, not a click outside. */
  trigger: RefObject<HTMLElement | null>;
  onClose: () => void;
  dispatch: (action: Action) => void;
}

type Panel = 'actions' | 'copy' | 'move';

/**
 * The list's "..." menu, with Trello's two sub-panels: Copiar lista and Mover
 * lista open in place of the action list, with a way back, the way Trello's
 * popover swaps its content instead of stacking a second popover.
 *
 * It closes on a mousedown anywhere outside it and on Escape. It used to
 * close only by pressing "..." again: nothing listened outside it at all.
 */
export function ListMenu({
  list,
  listIndex,
  board,
  boards,
  trigger,
  onClose,
  dispatch,
}: ListMenuProps) {
  const [panel, setPanel] = useState<Panel>('actions');
  const [name, setName] = useState(list.title);
  const [targetId, setTargetId] = useState(board.id);
  const menuRef = useRef<HTMLDivElement>(null);
  const { m } = useI18n();

  useDismiss(menuRef, trigger, onClose);

  // The board picked in Mover lista can be deleted from another window while
  // the panel is open; fall back rather than hold an id that matches nothing.
  const target = boards.find((entry) => entry.id === targetId) ?? board;
  const sameBoard = target.id === board.id;
  // On its own board the list takes one of the places it already has; on
  // another it adds a place, and lands last unless told otherwise.
  const places = sameBoard ? board.lists.length : target.lists.length + 1;
  const [place, setPlace] = useState(listIndex);
  const safePlace = Math.min(place, places - 1);

  function copy() {
    const title = name.trim();
    if (!title) return;
    dispatch({ type: 'list/copy', listId: list.id, title });
    onClose();
  }

  function move() {
    dispatch({ type: 'list/transfer', listId: list.id, toBoardId: target.id, toIndex: safePlace });
    onClose();
  }

  const back = (
    <button
      type="button"
      className="list-menu__icon"
      aria-label={m.list.back}
      title={m.list.back}
      onClick={() => setPanel('actions')}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  const heading = (title: string, withBack: boolean) => (
    <header className="list-menu__head">
      {withBack ? back : <span className="list-menu__spacer" />}
      <h4>{title}</h4>
      <button
        type="button"
        className="list-menu__icon"
        aria-label={m.common.close}
        title={m.common.close}
        onClick={onClose}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );

  return (
    <div className="list-menu" ref={menuRef} role="dialog" aria-label={m.list.actions}>
      {panel === 'actions' && (
        <>
          {heading(m.list.actions, false)}
          <div className="list-menu__items" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                dispatch({ type: 'card/add', listId: list.id, title: m.list.newCardTitle, atTop: true });
                onClose();
              }}
            >
              {m.list.addAtTop}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setName(list.title);
                setPanel('copy');
              }}
            >
              {m.list.copy}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setTargetId(board.id);
                setPlace(listIndex);
                setPanel('move');
              }}
            >
              {m.list.move}
            </button>
            <hr />
            <button
              type="button"
              role="menuitem"
              className="list-menu__danger"
              onClick={() => {
                dispatch({ type: 'list/remove', listId: list.id });
                onClose();
              }}
            >
              {m.list.remove}
            </button>
          </div>
        </>
      )}

      {panel === 'copy' && (
        <form
          className="list-menu__form"
          onSubmit={(event) => {
            event.preventDefault();
            copy();
          }}
        >
          {heading(m.list.copy, true)}
          <label className="list-menu__label" htmlFor={`copy-${list.id}`}>
            {m.list.name}
          </label>
          <textarea
            id={`copy-${list.id}`}
            className="field list-menu__name"
            rows={2}
            value={name}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              // Enter creates, as in the composers; a list name has no lines.
              if (event.key === 'Enter') {
                event.preventDefault();
                copy();
              }
            }}
          />
          <p className="list-menu__hint">
            {m.list.copyHint}
          </p>
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            {m.list.createList}
          </button>
        </form>
      )}

      {panel === 'move' && (
        <form
          className="list-menu__form"
          onSubmit={(event) => {
            event.preventDefault();
            move();
          }}
        >
          {heading(m.list.move, true)}
          <label className="list-menu__label" htmlFor={`move-board-${list.id}`}>
            {m.list.board}
          </label>
          <select
            id={`move-board-${list.id}`}
            className="field"
            value={target.id}
            onChange={(event) => {
              const next = boards.find((entry) => entry.id === event.target.value) ?? board;
              setTargetId(next.id);
              // Back home it goes where it is; elsewhere it goes last.
              setPlace(next.id === board.id ? listIndex : next.lists.length);
            }}
          >
            {boards.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
                {entry.id === board.id ? m.common.current : ''}
              </option>
            ))}
          </select>
          <label className="list-menu__label" htmlFor={`move-place-${list.id}`}>
            {m.list.position}
          </label>
          <select
            id={`move-place-${list.id}`}
            className="field"
            value={safePlace}
            onChange={(event) => setPlace(Number(event.target.value))}
          >
            {Array.from({ length: places }, (_, index) => (
              <option key={index} value={index}>
                {index + 1}
                {sameBoard && index === listIndex ? m.common.current : ''}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={sameBoard && safePlace === listIndex}
          >
            {m.list.moveSubmit}
          </button>
        </form>
      )}
    </div>
  );
}
