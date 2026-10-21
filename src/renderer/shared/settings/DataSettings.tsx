import { useEffect, useState } from 'react';
import { bridge, hasShell } from '../bridge';
import { AppChannel, StoreOp } from '../channels';
import type { BoardDocument } from '../types';
import './DataSettings.css';

interface AppConfig {
  appId: string;
  desktopVersion: string;
  platform: string;
  locale: string;
  isDev: boolean;
}

interface DataSettingsProps {
  doc: BoardDocument;
}

/** Where the data lives and what version is running. */
export function DataSettings({ doc }: DataSettingsProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [storePath, setStorePath] = useState('');
  const { ipc } = bridge();

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
      acc.rules += board.automations.length;
      for (const list of board.lists) {
        acc.cards += list.cards.length;
        for (const card of list.cards) {
          acc.attachments += card.attachments.length;
          // Counted apart, not subtracted: this tab is about what the file
          // holds, and an archived card is still in it.
          if (card.archivedAt) acc.archived += 1;
        }
      }
      return acc;
    },
    { boards: 0, lists: 0, cards: 0, archived: 0, rules: 0, attachments: 0 },
  );

  return (
    <>
      <section className="settings__section">
        <h3>Conteudo</h3>
        <dl className="facts">
          <dt>Quadros</dt>
          <dd>{totals.boards}</dd>
          <dt>Listas</dt>
          <dd>{totals.lists}</dd>
          <dt>Cartoes</dt>
          <dd>{totals.cards}</dd>
          <dt>Arquivados</dt>
          <dd>{totals.archived}</dd>
          <dt>Anexos</dt>
          <dd>{totals.attachments}</dd>
          <dt>Regras</dt>
          <dd>{totals.rules}</dd>
          <dt>Arquivo</dt>
          <dd className="facts__path">{storePath || 'localStorage do navegador'}</dd>
        </dl>
      </section>

      <section className="settings__section">
        <h3>Sobre</h3>
        <dl className="facts">
          <dt>Versao</dt>
          <dd>{config?.desktopVersion ?? '-'}</dd>
          <dt>appId</dt>
          <dd>{config?.appId ?? '-'}</dd>
          <dt>Plataforma</dt>
          <dd>{config?.platform ?? '-'}</dd>
          <dt>Locale</dt>
          <dd>{config?.locale ?? doc.prefs.locale}</dd>
          <dt>Documento</dt>
          <dd>versao {doc.version}</dd>
        </dl>
        <p className="settings__note">
          O shell desta janela foi reconstruido a partir da analise do app.asar do Trello feita pelo
          REA: inventario de janelas, contrato IPC e titlebar sem moldura. A interface de quadros,
          os anexos, o fundo e as automacoes sao implementacao original.
        </p>
      </section>
    </>
  );
}
