import { useState } from 'react';
import type { Action } from '../reducer';
import type { Board, BoardDocument } from '../types';
import { AppearanceSettings } from './AppearanceSettings';
import { AutomationsSettings } from './AutomationsSettings';
import { BackgroundSettings } from './BackgroundSettings';
import { DataSettings } from './DataSettings';
import './Settings.css';

export type SettingsTab = 'appearance' | 'background' | 'automations' | 'data';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Aparencia' },
  { id: 'background', label: 'Fundo' },
  { id: 'automations', label: 'Automacoes' },
  { id: 'data', label: 'Dados' },
];

interface SettingsProps {
  doc: BoardDocument;
  board: Board;
  dispatch: (action: Action) => void;
  initialTab?: SettingsTab;
}

/**
 * The single settings surface: theme, board background, automations and data.
 *
 * Rendered in two places from the same component, so the two never drift: as a
 * modal over the board (toolbar button) and as the whole body of the
 * `preferences` window (Ctrl+,).
 */
export function Settings({ doc, board, dispatch, initialTab = 'appearance' }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  return (
    <div className="settings">
      <nav className="settings__tabs" role="tablist" aria-label="Configuracoes">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`settings__tab${tab === entry.id ? ' settings__tab--on' : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
            {entry.id === 'automations' && board.automations.length > 0 && (
              <span className="settings__tab-badge">{board.automations.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="settings__panel" role="tabpanel">
        {tab === 'appearance' && <AppearanceSettings prefs={doc.prefs} dispatch={dispatch} />}
        {tab === 'background' && <BackgroundSettings board={board} dispatch={dispatch} />}
        {tab === 'automations' && (
          <AutomationsSettings
            board={board}
            labels={doc.labels}
            enabled={doc.prefs.automationsEnabled}
            dispatch={dispatch}
          />
        )}
        {tab === 'data' && <DataSettings doc={doc} />}
      </div>
    </div>
  );
}
