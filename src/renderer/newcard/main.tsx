import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bridge, hasShell } from '../shared/bridge';
import { WindowChannel } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import { commitToStore, useDocument, useTheme } from '../shared/useDocument';
import '../shared/styles/tokens.css';
import '../shared/styles/base.css';
import './newcard.css';

/**
 * The `newcard` window: 500x325, frameless, non-resizable - the geometry found
 * in the real app's main bundle. It writes through the same `app-store`
 * document, and the main window picks the change up from the store broadcast.
 */
function NewCard() {
  const { doc, loaded } = useDocument();
  const [title, setTitle] = useState('');
  const [boardId, setBoardId] = useState('');
  const [listId, setListId] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { ipc } = bridge();

  useTheme(doc.prefs.theme);

  /**
   * Which board to add to is this window's own state, not an edit of the
   * document. Writing the whole document from here to move the selection
   * would be the same lost update the card itself used to hit, and the board
   * the user is looking at should not change while they type a card.
   */
  const board = useMemo(
    () => doc.boards.find((entry) => entry.id === boardId),
    [boardId, doc.boards],
  );
  const lists = useMemo(() => board?.lists ?? [], [board]);

  useEffect(() => {
    if (doc.boards.length === 0) return;
    if (!board) setBoardId(doc.activeBoardId ?? doc.boards[0].id);
  }, [board, doc.activeBoardId, doc.boards]);

  /**
   * Falls back to the first list whenever the selection is not one of the
   * lists on screen.
   *
   * It cannot just fill an empty selection: the first render happens against
   * the seed document, because the real one is still being read from the
   * store, so the list picked then belongs to a board that the load replaces
   * moments later. The id left behind matched no list, `card/add` found
   * nothing to append to, and the card was dropped while the window still
   * reported it as added.
   */
  useEffect(() => {
    if (lists.length === 0) {
      if (listId) setListId('');
      return;
    }
    if (!lists.some((list) => list.id === listId)) setListId(lists[0].id);
  }, [listId, lists]);

  /**
   * Guards the same mismatch at the point of use, so a card is never reported
   * as added when there is no list to add it to.
   *
   * `loaded` is part of it: until the document arrives from the store the
   * window is showing the seed, and a card added to it would be thrown away by
   * the `replace` that the load dispatches.
   */
  const canSubmit =
    loaded && !busy && title.trim().length > 0 && lists.some((list) => list.id === listId);

  /**
   * Commits straight to the store instead of to this window's copy, so the
   * card cannot be lost to a store update arriving while the save is still
   * debounced. Closing waits for the write to land, which also replaces the
   * timeout that used to guess at how long that takes.
   */
  async function submit(closeAfter: boolean) {
    const next = title.trim();
    if (!canSubmit) return;
    setTitle('');
    setBusy(true);
    try {
      // `card/add` lands on the active board, so a card going somewhere else
      // moves the selection there first. Both actions go to the window that
      // owns the document, in order.
      if (boardId !== doc.activeBoardId) await commitToStore({ type: 'board/select', boardId });
      await commitToStore({ type: 'card/add', listId, title: next, atTop: true });
      setSaved(true);
      if (closeAfter && hasShell()) ipc.send(WindowChannel.TRIGGER_CLOSE);
    } catch (error) {
      bridge().logger.error('falha ao adicionar o cartao', error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="newcard">
      <TitleBar title="Novo cartao" />

      <div className="newcard__body">
        <label className="newcard__field">
          <span>Quadro</span>
          <select
            className="field"
            value={boardId}
            onChange={(event) => {
              setBoardId(event.target.value);
              setListId('');
            }}
          >
            {doc.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.title}
              </option>
            ))}
          </select>
        </label>

        <label className="newcard__field">
          <span>Lista</span>
          <select
            className="field"
            value={listId}
            onChange={(event) => setListId(event.target.value)}
            disabled={lists.length === 0}
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
        </label>

        <label className="newcard__field">
          <span>Titulo</span>
          <textarea
            className="field"
            rows={3}
            autoFocus
            value={title}
            placeholder="O que precisa ser feito?"
            onChange={(event) => {
              setTitle(event.target.value);
              setSaved(false);
              setFailed(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit(!event.ctrlKey && !event.metaKey);
              }
              if (event.key === 'Escape' && hasShell()) {
                ipc.send(WindowChannel.TRIGGER_CLOSE);
              }
            }}
          />
        </label>
      </div>

      <footer className="newcard__footer">
        <span className="newcard__hint">
          {!loaded
            ? 'Carregando...'
            : failed
              ? 'Nao foi possivel adicionar o cartao.'
              : saved
                ? 'Cartao adicionado.'
                : 'Enter adiciona e fecha - Ctrl+Enter mantem aberto'}
        </span>
        <div className="newcard__actions">
          <button
            type="button"
            className="btn"
            onClick={() => void submit(false)}
            disabled={!canSubmit}
          >
            Adicionar outro
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void submit(true)}
            disabled={!canSubmit}
          >
            Adicionar
          </button>
        </div>
      </footer>
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');
createRoot(container).render(<NewCard />);
