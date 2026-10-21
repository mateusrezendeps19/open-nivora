import type { Action } from '../shared/reducer';
import { Settings, type SettingsTab } from '../shared/settings/Settings';
import type { Board, BoardDocument } from '../shared/types';
import { useI18n } from '../shared/i18n/context';
import './SettingsPanel.css';

interface SettingsPanelProps {
  doc: BoardDocument;
  board: Board;
  initialTab?: SettingsTab;
  onClose: () => void;
  dispatch: (action: Action) => void;
}

/** Modal wrapper so settings can be changed without leaving the board. */
export function SettingsPanel({
  doc,
  board,
  initialTab,
  onClose,
  dispatch,
}: SettingsPanelProps) {
  const { m } = useI18n();

  return (
    <div
      className="settings__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="settings__modal"
        role="dialog"
        aria-modal="true"
        aria-label={m.settings.title}
      >
        <header className="settings__header">
          <h2>{m.settings.title}</h2>
          <button type="button" className="settings__close" aria-label={m.common.close} onClick={onClose}>
            x
          </button>
        </header>

        <Settings doc={doc} board={board} dispatch={dispatch} initialTab={initialTab} />
      </div>
    </div>
  );
}
