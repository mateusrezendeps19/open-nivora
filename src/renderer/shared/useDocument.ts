import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { bridge, hasShell } from './bridge';
import { AppChannel, StoreOp } from './channels';
import { normalize, readLocal, seedDocument, writeLocal } from './document';
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
  const [doc, dispatch] = useReducer(reducer, null, seedDocument);
  const [loaded, setLoaded] = useState(false);
  const skipNextSave = useRef(true);
  const { ipc } = bridge();

  // Initial load.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const raw = hasShell()
        ? await ipc.invoke<unknown>(AppChannel.STORE, StoreOp.READ).catch(() => null)
        : readLocal();
      if (cancelled) return;
      dispatch({ type: 'replace', doc: normalize(raw) });
      setLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ipc]);

  // Debounced persist. The first pass after load must not write straight back.
  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (hasShell()) {
        void ipc.invoke(AppChannel.STORE, StoreOp.WRITE, doc).catch((error) => {
          bridge().logger.error('falha ao salvar o documento', error);
        });
      } else {
        writeLocal(doc);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [doc, ipc, loaded]);

  // Another window (newcard, preferences) wrote the document: adopt it.
  useEffect(() => {
    if (!hasShell()) return;
    return ipc.on(AppChannel.STORE, (op, payload) => {
      if (op !== StoreOp.WRITE) return;
      skipNextSave.current = true;
      dispatch({ type: 'replace', doc: normalize(payload) });
    });
  }, [ipc]);

  const activeBoard = useMemo(
    () => doc.boards.find((b) => b.id === doc.activeBoardId) ?? doc.boards[0],
    [doc],
  );

  const act = useCallback((action: Action) => dispatch(action), []);

  return { doc, activeBoard, dispatch: act, loaded };
}

/** Applies the persisted theme to the document element. */
export function useTheme(theme: BoardDocument['prefs']['theme']) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
}
