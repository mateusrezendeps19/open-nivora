import { createRoot } from 'react-dom/client';
import { TitleBar } from '../shared/components/TitleBar';
import { Settings } from '../shared/settings/Settings';
import { useDocument, useTheme } from '../shared/useDocument';
import '../shared/styles/tokens.css';
import '../shared/styles/base.css';
import './preferences.css';

/**
 * The `preferences` window: 900x640, frameless, matching the real geometry.
 *
 * It renders the same Settings component the board shows in its modal, so the
 * two surfaces cannot drift apart. Background and automations act on whichever
 * board is active.
 */
function Preferences() {
  const { doc, activeBoard, dispatch, loaded } = useDocument();

  useTheme(doc.prefs.theme);

  return (
    <div className="prefs">
      <TitleBar title="Configuracoes" />
      {loaded ? (
        <Settings doc={doc} board={activeBoard} dispatch={dispatch} />
      ) : (
        <div className="prefs__loading">Carregando...</div>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');
createRoot(container).render(<Preferences />);
