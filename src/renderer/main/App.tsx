import { useCallback, useEffect, useMemo, useState } from 'react';
import { bridge, hasShell } from '../shared/bridge';
import { FindInPageChannel, WindowChannel } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import { useDocument, useTheme } from '../shared/useDocument';
import { BoardCanvas } from './BoardCanvas';
import { CardModal } from './CardModal';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import './App.css';

export function App() {
  const { doc, activeBoard, dispatch, loaded } = useDocument();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { ipc } = bridge();

  useTheme(doc.prefs.theme);

  const openCard = useMemo(() => {
    if (!openCardId) return null;
    for (const list of activeBoard.lists) {
      const card = list.cards.find((c) => c.id === openCardId);
      if (card) return { card, list };
    }
    return null;
  }, [activeBoard, openCardId]);

  // A card deleted from elsewhere must not leave the modal pointing at nothing.
  useEffect(() => {
    if (openCardId && !openCard) setOpenCardId(null);
  }, [openCard, openCardId]);

  const openFind = useCallback(() => {
    if (hasShell()) ipc.send(WindowChannel.OPEN, 'find_in_page');
  }, [ipc]);

  const openNewCard = useCallback(() => {
    if (hasShell()) ipc.send(WindowChannel.OPEN, 'newcard');
  }, [ipc]);

  // Shortcuts. The real app bundles `mousetrap` for this; plain listeners are
  // enough for the set we support.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        openFind();
      } else if (mod && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openNewCard();
      } else if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.toolbar__search input')?.focus();
      } else if (event.key === 'Escape') {
        setOpenCardId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openFind, openNewCard]);

  // find_in_page asks the main window to highlight; Electron's findInPage only
  // scrolls to matches, so we also narrow the board by the same query.
  useEffect(() => {
    if (!hasShell()) return;
    const offQuery = ipc.on(FindInPageChannel.SET_QUERY, (value) => setQuery(String(value ?? '')));
    const offReset = ipc.on(FindInPageChannel.RESET, () => setQuery(''));
    return () => {
      offQuery();
      offReset();
    };
  }, [ipc]);

  if (!loaded) {
    return (
      <div className="app">
        <TitleBar title="Nivora" />
        <div className="app__loading">Carregando quadros...</div>
      </div>
    );
  }

  return (
    <div className="app" style={{ ['--board-color' as string]: activeBoard.color }}>
      <TitleBar title={`${activeBoard.title} - Nivora`}>
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onNewCard={openNewCard}
          onFind={openFind}
          theme={doc.prefs.theme}
          onToggleTheme={() =>
            dispatch({
              type: 'prefs/set',
              patch: { theme: doc.prefs.theme === 'dark' ? 'light' : 'dark' },
            })
          }
        />
      </TitleBar>

      <div className="app__body">
        {sidebarOpen && (
          <Sidebar
            boards={doc.boards}
            activeBoardId={activeBoard.id}
            onSelect={(boardId) => dispatch({ type: 'board/select', boardId })}
            onAdd={(title, color) => dispatch({ type: 'board/add', title, color })}
            onRename={(boardId, title) => dispatch({ type: 'board/rename', boardId, title })}
            onRemove={(boardId) => dispatch({ type: 'board/remove', boardId })}
          />
        )}

        <BoardCanvas
          board={activeBoard}
          labels={doc.labels}
          query={query}
          dispatch={dispatch}
          onOpenCard={setOpenCardId}
        />
      </div>

      {openCard && (
        <CardModal
          card={openCard.card}
          listTitle={openCard.list.title}
          labels={doc.labels}
          confirmDelete={doc.prefs.confirmCardDelete}
          onClose={() => setOpenCardId(null)}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}
