import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bridge, hasShell } from '../shared/bridge';
import { WindowChannel } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import { useDocument, useTheme } from '../shared/useDocument';
import '../shared/styles/tokens.css';
import '../shared/styles/base.css';
import './newcard.css';

/**
 * The `newcard` window: 500x325, frameless, non-resizable - the geometry found
 * in the real app's main bundle. It writes through the same `app-store`
 * document, and the main window picks the change up from the store broadcast.
 */
function NewCard() {
  const { doc, activeBoard, dispatch, loaded } = useDocument();
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState('');
  const [saved, setSaved] = useState(false);
  const { ipc } = bridge();

  useTheme(doc.prefs.theme);

  const lists = useMemo(() => activeBoard?.lists ?? [], [activeBoard]);

  // Default to the first list once the document is in.
  useEffect(() => {
    if (!listId && lists.length > 0) setListId(lists[0].id);
  }, [listId, lists]);

  function submit(closeAfter: boolean) {
    const next = title.trim();
    if (!next || !listId) return;
    dispatch({ type: 'card/add', listId, title: next, atTop: true });
    setTitle('');
    setSaved(true);
    if (closeAfter && hasShell()) {
      // Give the debounced write time to reach the main process.
      setTimeout(() => ipc.send(WindowChannel.TRIGGER_CLOSE), 400);
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
            value={doc.activeBoardId ?? ''}
            onChange={(event) => {
              dispatch({ type: 'board/select', boardId: event.target.value });
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
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(!event.ctrlKey && !event.metaKey);
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
            : saved
              ? 'Cartao adicionado.'
              : 'Enter adiciona e fecha - Ctrl+Enter mantem aberto'}
        </span>
        <div className="newcard__actions">
          <button
            type="button"
            className="btn"
            onClick={() => submit(false)}
            disabled={!title.trim() || !listId}
          >
            Adicionar outro
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => submit(true)}
            disabled={!title.trim() || !listId}
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
