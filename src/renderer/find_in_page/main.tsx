import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bridge, hasShell } from '../shared/bridge';
import { FindInPageChannel } from '../shared/channels';
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
    <div className="find">
      <input
        className="find__input"
        autoFocus
        value={query}
        placeholder="Localizar no quadro"
        aria-label="Localizar no quadro"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
      />
      <span className="find__count">
        {query && result ? `${result.active}/${result.total}` : ''}
      </span>
      <button type="button" className="find__close" aria-label="Fechar" onClick={close}>
        x
      </button>
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');
createRoot(container).render(<FindInPage />);
