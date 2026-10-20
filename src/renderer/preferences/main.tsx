import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { bridge, hasShell } from '../shared/bridge';
import { AppChannel, StoreOp } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import { useDocument, useTheme } from '../shared/useDocument';
import '../shared/styles/tokens.css';
import '../shared/styles/base.css';
import './preferences.css';

interface AppConfig {
  appId: string;
  desktopVersion: string;
  platform: string;
  locale: string;
  isDev: boolean;
}

/** The `preferences` window: 900x640, frameless, matching the real geometry. */
function Preferences() {
  const { doc, dispatch, loaded } = useDocument();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [storePath, setStorePath] = useState('');
  const { ipc } = bridge();

  useTheme(doc.prefs.theme);

  useEffect(() => {
    if (!hasShell()) return;
    void ipc.invoke<AppConfig>(AppChannel.CONFIG).then(setConfig).catch(() => undefined);
    void ipc
      .invoke<string>(AppChannel.STORE, StoreOp.PATH)
      .then(setStorePath)
      .catch(() => undefined);
  }, [ipc]);

  const totals = doc.boards.reduce(
    (acc, board) => {
      acc.boards += 1;
      acc.lists += board.lists.length;
      acc.cards += board.lists.reduce((sum, list) => sum + list.cards.length, 0);
      return acc;
    },
    { boards: 0, lists: 0, cards: 0 },
  );

  return (
    <div className="prefs">
      <TitleBar title="Preferencias" />

      <div className="prefs__body">
        <section className="prefs__section">
          <h2>Aparencia</h2>
          <div className="prefs__row">
            <div>
              <h3>Tema</h3>
              <p>
                Tokens proprios, na mesma estrutura dos pacotes Atlaskit que o app original carrega.
              </p>
            </div>
            <div className="prefs__segmented">
              {(['dark', 'light'] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={doc.prefs.theme === theme ? 'is-on' : ''}
                  onClick={() => dispatch({ type: 'prefs/set', patch: { theme } })}
                >
                  {theme === 'dark' ? 'Escuro' : 'Claro'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="prefs__section">
          <h2>Comportamento</h2>
          <div className="prefs__row">
            <div>
              <h3>Confirmar exclusao de cartao</h3>
              <p>Pede uma segunda confirmacao antes de excluir um cartao.</p>
            </div>
            <label className="prefs__switch">
              <input
                type="checkbox"
                checked={doc.prefs.confirmCardDelete}
                onChange={(event) =>
                  dispatch({ type: 'prefs/set', patch: { confirmCardDelete: event.target.checked } })
                }
              />
              <span />
            </label>
          </div>
        </section>

        <section className="prefs__section">
          <h2>Dados</h2>
          <dl className="prefs__facts">
            <dt>Quadros</dt>
            <dd>{loaded ? totals.boards : '-'}</dd>
            <dt>Listas</dt>
            <dd>{loaded ? totals.lists : '-'}</dd>
            <dt>Cartoes</dt>
            <dd>{loaded ? totals.cards : '-'}</dd>
            <dt>Arquivo</dt>
            <dd className="prefs__path">{storePath || 'localStorage do navegador'}</dd>
          </dl>
        </section>

        <section className="prefs__section">
          <h2>Sobre</h2>
          <dl className="prefs__facts">
            <dt>Versao</dt>
            <dd>{config?.desktopVersion ?? '-'}</dd>
            <dt>appId</dt>
            <dd>{config?.appId ?? '-'}</dd>
            <dt>Plataforma</dt>
            <dd>{config?.platform ?? '-'}</dd>
            <dt>Locale</dt>
            <dd>{config?.locale ?? doc.prefs.locale}</dd>
          </dl>
          <p className="prefs__note">
            O shell desta janela foi reconstruido a partir da analise do app.asar do Trello feita
            pelo REA: inventario de janelas, contrato IPC e titlebar sem moldura. A interface de
            quadros e implementacao original.
          </p>
        </section>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');
createRoot(container).render(<Preferences />);
