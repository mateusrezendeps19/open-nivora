import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sweepAssets } from '../shared/assets';
import { backgroundStyle } from '../shared/background';
import { bridge, hasShell } from '../shared/bridge';
import { FindInPageChannel, WindowChannel } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import { referencedAssets } from '../shared/document';
import { useDocument, useTheme } from '../shared/useDocument';
import type { SettingsTab } from '../shared/settings/Settings';
import { BoardCanvas } from './BoardCanvas';
import { CardModal } from './CardModal';
import { SettingsPanel } from './SettingsPanel';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import './App.css';

export function App() {
  const { doc, activeBoard, dispatch, loaded, persisted } = useDocument();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const swept = useRef(false);
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

  // Files left behind by cards or backgrounds removed in an earlier session.
  // Guarded by `persisted`, since a seeded document references nothing and the
  // sweep would then look like every file is an orphan.
  useEffect(() => {
    if (!loaded || !persisted || swept.current) return;
    swept.current = true;
    void sweepAssets(referencedAssets(doc));
  }, [doc, loaded, persisted]);

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
        setSettingsTab(null);
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
    <div className="app">
      <TitleBar title={`${activeBoard.title} - Nivora`}>
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onNewCard={openNewCard}
          onFind={openFind}
          onSettings={() => setSettingsTab('appearance')}
        />
      </TitleBar>

      <div className="app__body" style={backgroundStyle(activeBoard.background)}>
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

      {settingsTab && (
        <SettingsPanel
          doc={doc}
          board={activeBoard}
          initialTab={settingsTab}
          onClose={() => setSettingsTab(null)}
          dispatch={dispatch}
        />
      )}

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
