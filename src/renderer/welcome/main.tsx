import { createRoot } from 'react-dom/client';
import { bridge, hasShell } from '../shared/bridge';
import { WindowChannel } from '../shared/channels';
import { TitleBar } from '../shared/components/TitleBar';
import icon from '../../../resources/icon.png';
import '../shared/styles/tokens.css';
import '../shared/styles/base.css';
import './welcome.css';

/** The `welcome` window: 900x620, frameless, non-resizable. */
function Welcome() {
  const { ipc } = bridge();

  return (
    <div className="welcome">
      <TitleBar title="Bem-vindo" />

      <div className="welcome__body">
        <h1 className="welcome__brand">
          <img src={icon} alt="" />
          Taskly
        </h1>
        <p className="welcome__lead">
          Um clone de quadros kanban cujo shell desktop foi reconstruido a partir da engenharia
          reversa do app oficial do Trello instalado nesta maquina.
        </p>

        <div className="welcome__grid">
          <article>
            <h2>Reconstruido das evidencias</h2>
            <p>
              Inventario de dez janelas, contrato IPC, titlebar sem moldura e geometria, extraidos
              do app.asar com o REA.
            </p>
          </article>
          <article>
            <h2>Interface original</h2>
            <p>
              Quadros, listas, cartoes, arrastar e soltar, etiquetas, prazos e checklists sao
              implementacao propria, nao codigo copiado.
            </p>
          </article>
          <article>
            <h2>Offline por padrao</h2>
            <p>
              Tudo fica em um unico JSON no diretorio userData do Electron. Sem conta, sem servidor,
              sem rede.
            </p>
          </article>
          <article>
            <h2>Atalhos</h2>
            <p>
              Ctrl+N novo cartao, Ctrl+F localizar, Ctrl+K filtrar, Ctrl+, preferencias.
            </p>
          </article>
        </div>

        {hasShell() && (
          <button
            type="button"
            className="btn btn--primary welcome__cta"
            onClick={() => ipc.send(WindowChannel.TRIGGER_CLOSE)}
          >
            Comecar
          </button>
        )}
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root nao encontrado');
createRoot(container).render(<Welcome />);
