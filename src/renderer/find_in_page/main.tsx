import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bridge, hasShell } from '../shared/bridge';
import { FindInPageChannel } from '../shared/channels';
import { messages } from '../shared/i18n';
import { I18nProvider } from '../shared/i18n/context';
import { useDocument } from '../shared/useDocument';
import '../shared/styles/tokens.css';
import '../shared/styles/base.css';
import './find_in_page.css';

/**
 * The `find_in_page` window. The real app drives this over six literal
 * channels, all recovered intact from the bundle:
 *   find-in-page-set-query / -found / -close / -focus / -reset / -is-shown
 */
function FindInPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ active: number; total: number } | null>(null);
  const { ipc } = bridge();
  // Read for the language only; this window never writes.
  const { doc } = useDocument();
  const m = messages(doc.prefs.locale);

  // Debounced so every keystroke does not restart the search.
  useEffect(() => {
    if (!hasShell()) return;
    const timer = setTimeout(() => ipc.send(FindInPageChannel.SET_QUERY, query), 150);
    return () => clearTimeout(timer);
  }, [ipc, query]);

  useEffect(() => {
    if (!hasShell()) return;
    const offFound = ipc.on(FindInPageChannel.FOUND, (payload) => {
      const found = payload as { activeMatchOrdinal?: number; matches?: number } | undefined;
      setResult({ active: found?.activeMatchOrdinal ?? 0, total: found?.matches ?? 0 });
    });
    const offReset = ipc.on(FindInPageChannel.RESET, () => setResult(null));
    return () => {
      offFound();
      offReset();
    };
  }, [ipc]);

  function close() {
    if (hasShell()) ipc.send(FindInPageChannel.CLOSE);
  }

  return (
    <I18nProvider locale={doc.prefs.locale}>
      <div className="find">
        <input
          className="find__input"
          autoFocus
          value={query}
          placeholder={m.find.placeholder}
          aria-label={m.find.placeholder}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        />
        <span className="find__count">
          {query && result ? `${result.active}/${result.total}` : ''}
        </span>
        <button type="button" className="find__close" aria-label={m.common.close} onClick={close}>
          x
        </button>
      </div>
    </I18nProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');
createRoot(container).render(<FindInPage />);
