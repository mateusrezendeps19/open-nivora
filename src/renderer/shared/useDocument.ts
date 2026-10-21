import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { bridge, hasShell } from './bridge';
import { AppChannel, StoreOp } from './channels';
import { normalize, readLocal, seedDocument, writeLocal } from './document';
import { systemLocale } from './i18n';
import { reducer, type Action } from './reducer';
import type { BoardDocument } from './types';

const SAVE_DEBOUNCE_MS = 250;

/**
 * Loads the board document, exposes a dispatch, and persists every change.
 *
 * In the shell it goes through the `app-store` channel, which the real Trello
 * desktop app also uses for its node-persist state; in a plain browser it falls
 * back to localStorage so the same bundle stays usable.
 */
export function useDocument() {
  const [doc, dispatch] = useReducer(reducer, null, () => seedDocument(systemLocale()));
  const [loaded, setLoaded] = useState(false);
  // False when the store had nothing to read and we fell back to the seed.
  // The asset sweep must not run in that case.
  const [persisted, setPersisted] = useState(false);
  /**
   * The last document that came from the store, kept by identity so the save
   * effect can tell it apart from one this window produced.
   *
   * This used to be a "skip the next save" boolean, which loses writes: React
   * batches, so two store updates arriving together collapse into a single
   * render that consumes one skip and leaves the flag raised, and the next
   * real edit in this window was then dropped instead of saved. Comparing
   * references has no such state to get out of step.
   */
  const fromStore = useRef<BoardDocument | null>(null);
  /** A change waiting out the save debounce, so it can be flushed early. */
  const pending = useRef<{ doc: BoardDocument; timer: ReturnType<typeof setTimeout> } | null>(null);
  const { ipc } = bridge();

  // Initial load.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const raw = hasShell()
        ? await ipc.invoke<unknown>(AppChannel.STORE, StoreOp.READ).catch(() => null)
        : readLocal();
      if (cancelled) return;
      const loadedDoc = normalize(raw, systemLocale());
      fromStore.current = loadedDoc;
      dispatch({ type: 'replace', doc: loadedDoc });
      setPersisted(!!raw);
      setLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ipc]);

  const persist = useCallback(
    (value: BoardDocument) => {
      if (hasShell()) {
        void ipc.invoke(AppChannel.STORE, StoreOp.WRITE, value).catch((error) => {
          bridge().logger.error('falha ao salvar o documento', error);
        });
      } else {
        writeLocal(value);
      }
    },
    [ipc],
  );

  // Debounced persist. A document that came from the store is not echoed back.
  useEffect(() => {
    if (!loaded) return;
    if (doc === fromStore.current) return;
    const timer = setTimeout(() => {
      pending.current = null;
      persist(doc);
    }, SAVE_DEBOUNCE_MS);
    pending.current = { doc, timer };
    return () => clearTimeout(timer);
  }, [doc, loaded, persist]);

  /**
   * Writes a pending change at once when this window stops being the active
   * one, instead of leaving it in the debounce.
   *
   * A satellite window reads the store as it opens, to offer the boards and
   * lists to choose from. An edit still waiting out its debounce here is not
   * in what it reads, so writing it on the way out keeps the two in step.
   */
  useEffect(() => {
    if (!loaded) return;

    function flush() {
      const entry = pending.current;
      if (!entry) return;
      pending.current = null;
      clearTimeout(entry.timer);
      persist(entry.doc);
    }

    function onVisibility() {
      if (document.hidden) flush();
    }

    window.addEventListener('blur', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loaded, persist]);

  // Another window (newcard, preferences) wrote the document: adopt it.
  useEffect(() => {
    if (!hasShell()) return;
    return ipc.on(AppChannel.STORE, (op, payload) => {
      // A satellite window asking this one, as the owner of the document, to
      // apply an action. It goes through the reducer like any local edit, so
      // automations run and the usual save path persists it.
      if (op === StoreOp.APPLY) {
        dispatch(payload as Action);
        return;
      }
      if (op !== StoreOp.WRITE) return;
      const incoming = normalize(payload);
      fromStore.current = incoming;
      dispatch({ type: 'replace', doc: incoming });
    });
  }, [ipc]);

  const activeBoard = useMemo(
    () => doc.boards.find((b) => b.id === doc.activeBoardId) ?? doc.boards[0],
    [doc],
  );

  const act = useCallback((action: Action) => dispatch(action), []);

  return { doc, activeBoard, dispatch: act, loaded, persisted };
}

/**
 * Commits one action from a satellite window, such as `newcard`.
 *
 * The action is handed to the window that owns the document rather than
 * written here. Two windows each reading the document, changing it and writing
 * it back lose updates: the second write drops the first one's change, which
 * is how a card added in `newcard` could vanish moments after the window said
 * it had been added. Only the owner writes, so there is nothing to overwrite.
 */
export async function commitToStore(action: Action): Promise<void> {
  if (!hasShell()) {
    writeLocal(reducer(normalize(readLocal()), action));
    return;
  }

  const { ipc } = bridge();
  const applied = await ipc.invoke<boolean>(AppChannel.STORE, StoreOp.APPLY, action);
  if (applied) return;

  // No board window to own the change. Nothing else is writing either, so
  // reading, applying and writing back is safe here.
  const raw = await ipc.invoke<unknown>(AppChannel.STORE, StoreOp.READ).catch(() => null);
  await ipc.invoke(AppChannel.STORE, StoreOp.WRITE, reducer(normalize(raw), action));
}

/** Applies the persisted theme to the document element. */
export function useTheme(theme: BoardDocument['prefs']['theme']) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
