import { useEffect, useState } from 'react';
import { bridge, hasShell } from '../bridge';
import { AppChannel, StoreOp } from '../channels';
import { useI18n } from '../i18n/context';
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
  const { m } = useI18n();
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
        <h3>{m.data.content}</h3>
        <dl className="facts">
          <dt>{m.data.boards}</dt>
          <dd>{totals.boards}</dd>
          <dt>{m.data.lists}</dt>
          <dd>{totals.lists}</dd>
          <dt>{m.data.cards}</dt>
          <dd>{totals.cards}</dd>
          <dt>{m.data.archived}</dt>
          <dd>{totals.archived}</dd>
          <dt>{m.data.attachments}</dt>
          <dd>{totals.attachments}</dd>
          <dt>{m.data.rules}</dt>
          <dd>{totals.rules}</dd>
          <dt>{m.data.file}</dt>
          <dd className="facts__path">{storePath || m.data.browserStorage}</dd>
        </dl>
      </section>

      <section className="settings__section">
        <h3>{m.data.about}</h3>
        <dl className="facts">
          <dt>{m.data.version}</dt>
          <dd>{config?.desktopVersion ?? '-'}</dd>
          <dt>appId</dt>
          <dd>{config?.appId ?? '-'}</dd>
          <dt>{m.data.platform}</dt>
          <dd>{config?.platform ?? '-'}</dd>
          <dt>{m.data.locale}</dt>
          <dd>{config?.locale ?? doc.prefs.locale}</dd>
          <dt>{m.data.document}</dt>
          <dd>{m.data.documentVersion(doc.version)}</dd>
        </dl>
        <p className="settings__note">{m.data.note}</p>
      </section>
    </>
  );
}
