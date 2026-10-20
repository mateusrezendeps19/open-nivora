import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sweepAssets } from '../shared/assets';
import { backgroundStyle } from '../shared/background';
import { bridge, hasShell } from '../shared/bridge';
import { FindInPageChannel, WindowChannel } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import { referencedAssets } from '../shared/document';
import type { Prefs } from '../shared/types';
import { useDocument, useTheme } from '../shared/useDocument';
import type { SettingsTab } from '../shared/settings/Settings';
import { BoardCanvas } from './BoardCanvas';
import { Calendar } from './Calendar';
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
  const swept = useRef(false);
  const { ipc } = bridge();

  useTheme(doc.prefs.theme);

  // The sidebar and the current view live in the document, so the window opens
  // the way it was left.
  const { sidebarCollapsed, view } = doc.prefs;
  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => dispatch({ type: 'prefs/set', patch }),
    [dispatch],
  );

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
          view={view}
          sidebarCollapsed={sidebarCollapsed}
          onQueryChange={setQuery}
          onViewChange={(next) => setPrefs({ view: next })}
          onToggleSidebar={() => setPrefs({ sidebarCollapsed: !sidebarCollapsed })}
          onNewCard={openNewCard}
          onFind={openFind}
          onSettings={() => setSettingsTab('appearance')}
        />
      </TitleBar>

      <div className="app__body" style={backgroundStyle(activeBoard.background)}>
        <Sidebar
          boards={doc.boards}
          activeBoardId={activeBoard.id}
          collapsed={sidebarCollapsed}
          onToggle={() => setPrefs({ sidebarCollapsed: !sidebarCollapsed })}
          onSelect={(boardId) => dispatch({ type: 'board/select', boardId })}
          onAdd={(title, color) => dispatch({ type: 'board/add', title, color })}
          onRename={(boardId, title) => dispatch({ type: 'board/rename', boardId, title })}
          onRemove={(boardId) => dispatch({ type: 'board/remove', boardId })}
        />

        {view === 'calendar' ? (
          <Calendar
            board={activeBoard}
            labels={doc.labels}
            query={query}
            dispatch={dispatch}
            onOpenCard={setOpenCardId}
          />
        ) : (
          <BoardCanvas
            board={activeBoard}
            labels={doc.labels}
            query={query}
            dispatch={dispatch}
            onOpenCard={setOpenCardId}
          />
        )}
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
