import { createRoot } from 'react-dom/client';
import { bridge, hasShell } from '../shared/bridge';
import { WindowChannel } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import { messages } from '../shared/i18n';
import { I18nProvider } from '../shared/i18n/context';
import { useDocument } from '../shared/useDocument';
import icon from '../../../resources/icon.png';
import '../shared/styles/tokens.css';
import '../shared/styles/base.css';
import './welcome.css';

/**
 * The `welcome` window: 900x620, frameless, non-resizable. It reads the
 * document only for the language, and never writes it.
 */
function Welcome() {
  const { ipc } = bridge();
  const { doc } = useDocument();
  const t = messages(doc.prefs.locale).welcome;

  return (
    <I18nProvider locale={doc.prefs.locale}>
      <div className="welcome">
        <TitleBar title={t.title} />

        <div className="welcome__body">
          <h1 className="welcome__brand">
            <img src={icon} alt="" />
            Taskly
          </h1>
          <p className="welcome__lead">{t.lead}</p>

          <div className="welcome__grid">
            <article>
              <h2>{t.rebuiltTitle}</h2>
              <p>{t.rebuilt}</p>
            </article>
            <article>
              <h2>{t.originalTitle}</h2>
              <p>{t.original}</p>
            </article>
            <article>
              <h2>{t.offlineTitle}</h2>
              <p>{t.offline}</p>
            </article>
            <article>
              <h2>{t.shortcutsTitle}</h2>
              <p>{t.shortcuts}</p>
            </article>
          </div>

          {hasShell() && (
            <button
              type="button"
              className="btn btn--primary welcome__cta"
              onClick={() => ipc.send(WindowChannel.TRIGGER_CLOSE)}
            >
              {t.start}
            </button>
          )}
        </div>
      </div>
    </I18nProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');
createRoot(container).render(<Welcome />);
