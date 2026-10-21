import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { removeAsset, sweepAssets } from '../shared/assets';
import { backgroundStyle } from '../shared/background';
import { bridge, hasShell } from '../shared/bridge';
import { FindInPageChannel, WindowChannel } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import { referencedAssets, releasedAssets } from '../shared/document';
import { EMPTY_FILTER, withLabels, type CardFilter } from '../shared/filter';
import { messages } from '../shared/i18n';
import { I18nProvider } from '../shared/i18n/context';
import { labelUsage } from '../shared/reducer';
import type { Prefs } from '../shared/types';
import { useDocument, useTheme } from '../shared/useDocument';
import type { SettingsTab } from '../shared/settings/Settings';
import { BoardCanvas } from './BoardCanvas';
import { ArchivePanel, archivedCards } from './ArchivePanel';
import { Calendar } from './Calendar';
import { CardModal } from './CardModal';
import { Fab } from './Fab';
import { SettingsPanel } from './SettingsPanel';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import './App.css';

export function App() {
  const { doc, activeBoard, dispatch, loaded, persisted } = useDocument();
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  /**
   * The board filter. Not saved: like Trello's, it is a way of looking at the
   * board right now, and a filter silently still applied the next morning
   * would read as cards having gone missing.
   */
  const [filter, setFilter] = useState<CardFilter>(EMPTY_FILTER);
  // The keyword is one field of the filter, but it is also the search box,
  // Ctrl+K and the Localizar window, which only ever deal in words.
  const setQuery = useCallback(
    (keyword: string) => setFilter((current) => ({ ...current, keyword })),
    [],
  );
  // Lifted out of the board and the calendar so the floating button, which is
  // outside both, can turn into a trash while a card is in flight.
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const swept = useRef(false);
  const { ipc } = bridge();

  useTheme(doc.prefs.theme);
  const m = messages(doc.prefs.locale);

  // The sidebar and the current view live in the document, so the window opens
  // the way it was left.
  const { sidebarCollapsed, view } = doc.prefs;
  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => dispatch({ type: 'prefs/set', patch }),
    [dispatch],
  );

  const archived = useMemo(() => archivedCards(activeBoard), [activeBoard]);
  // What everything draws against: the filter minus labels deleted since they were ticked.
  const shownFilter = useMemo(
    () => withLabels(filter, doc.labels.map((label) => label.id)),
    [filter, doc.labels],
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

  /**
   * A stored file is deleted when the document stops pointing at it, and
   * only then - see releasedAssets for why the place that dropped it cannot
   * decide. This window owns the document, so every change passes through
   * here, including ones made in the preferences window.
   *
   * Tracking starts from the first loaded document. Before that the document
   * is the seed, and a seed compared with the real one would be read as every
   * file having been dropped at once.
   */
  const lastDoc = useRef<typeof doc | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const before = lastDoc.current;
    lastDoc.current = doc;
    if (!before || before === doc) return;
    for (const asset of releasedAssets(before, doc)) void removeAsset(asset);
  }, [doc, loaded]);

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
        setArchiveOpen(false);
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
      <I18nProvider locale={doc.prefs.locale}>
        <div className="app">
          <TitleBar title="Taskly" />
          <div className="app__loading">{m.app.loadingBoards}</div>
        </div>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider locale={doc.prefs.locale}>
      <div className="app">
        <TitleBar title={`${activeBoard.title} - Taskly`}>
          <Toolbar
            filter={shownFilter}
            labels={doc.labels}
            view={view}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onViewChange={(next) => setPrefs({ view: next })}
            onFind={openFind}
            onSettings={() => setSettingsTab('appearance')}
          />
        </TitleBar>

        <div className="app__body" style={backgroundStyle(activeBoard.background)}>
          <Sidebar
            boards={doc.boards}
            activeBoardId={activeBoard.id}
            collapsed={sidebarCollapsed}
            archivedCount={archived.length}
            onToggle={() => setPrefs({ sidebarCollapsed: !sidebarCollapsed })}
            onOpenArchive={() => setArchiveOpen(true)}
            onSelect={(boardId) => dispatch({ type: 'board/select', boardId })}
            onAdd={(title, color) => dispatch({ type: 'board/add', title, color })}
            onRename={(boardId, title) => dispatch({ type: 'board/rename', boardId, title })}
            onRemove={(boardId) => dispatch({ type: 'board/remove', boardId })}
          />

          {view === 'calendar' ? (
            <Calendar
              board={activeBoard}
              labels={doc.labels}
              filter={shownFilter}
              dispatch={dispatch}
              onOpenCard={setOpenCardId}
              onCardDragChange={setDragCardId}
            />
          ) : (
            <BoardCanvas
              board={activeBoard}
              boards={doc.boards}
              labels={doc.labels}
              filter={shownFilter}
              onClearFilter={() => setFilter(EMPTY_FILTER)}
              dispatch={dispatch}
              onOpenCard={setOpenCardId}
              onCardDragChange={setDragCardId}
            />
          )}
        </div>

        {hasShell() && (
          <Fab
            board={activeBoard}
            dragCardId={dragCardId}
            confirmDelete={doc.prefs.confirmCardDelete}
            onNew={openNewCard}
            dispatch={dispatch}
          />
        )}

        {archiveOpen && (
          <ArchivePanel
            board={activeBoard}
            confirmDelete={doc.prefs.confirmCardDelete}
            onClose={() => setArchiveOpen(false)}
            dispatch={dispatch}
          />
        )}

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
            labelUsage={(labelId) => labelUsage(doc, labelId)}
            confirmDelete={doc.prefs.confirmCardDelete}
            onClose={() => setOpenCardId(null)}
            dispatch={dispatch}
          />
        )}
      </div>
    </I18nProvider>
  );
}
