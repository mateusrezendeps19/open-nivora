import { createRoot } from 'react-dom/client';
import { TitleBar } from '../shared/components/TitleBar';
import { messages } from '../shared/i18n';
import { I18nProvider } from '../shared/i18n/context';
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
  const m = messages(doc.prefs.locale);

  return (
    <I18nProvider locale={doc.prefs.locale}>
      <div className="prefs">
        <TitleBar title={m.settings.title} />
        {loaded ? (
          <Settings doc={doc} board={activeBoard} dispatch={dispatch} />
        ) : (
          <div className="prefs__loading">{m.common.loading}</div>
        )}
      </div>
    </I18nProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');
createRoot(container).render(<Preferences />);
