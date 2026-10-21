import { useState } from 'react';
import type { Action } from '../reducer';
import type { Board, BoardDocument } from '../types';
import { AppearanceSettings } from './AppearanceSettings';
import { AutomationsSettings } from './AutomationsSettings';
import { BackgroundSettings } from './BackgroundSettings';
import { DataSettings } from './DataSettings';
import { useI18n } from '../i18n/context';
import './Settings.css';

export type SettingsTab = 'appearance' | 'background' | 'automations' | 'data';

const TABS: SettingsTab[] = ['appearance', 'background', 'automations', 'data'];

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
  const { m } = useI18n();

  return (
    <div className="settings">
      <nav className="settings__tabs" role="tablist" aria-label={m.settings.title}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`settings__tab${tab === id ? ' settings__tab--on' : ''}`}
            onClick={() => setTab(id)}
          >
            {m.settings[id]}
            {id === 'automations' && board.automations.length > 0 && (
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
