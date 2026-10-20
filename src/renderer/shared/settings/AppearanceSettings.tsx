import type { Action } from '../reducer';
import type { Prefs } from '../types';
import './AppearanceSettings.css';

interface AppearanceSettingsProps {
  prefs: Prefs;
  dispatch: (action: Action) => void;
}

/** Theme and the behaviour toggles that used to sit in the toolbar. */
export function AppearanceSettings({ prefs, dispatch }: AppearanceSettingsProps) {
  return (
    <>
      <section className="settings__section">
        <h3>Tema</h3>
        <div className="settings__row">
          <p className="settings__hint">
            Tokens proprios, na mesma estrutura dos pacotes Atlaskit que o app original carrega.
          </p>
          <div className="segmented">
            {(['light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                className={prefs.theme === theme ? 'is-on' : ''}
                aria-pressed={prefs.theme === theme}
                onClick={() => dispatch({ type: 'prefs/set', patch: { theme } })}
              >
                {theme === 'light' ? 'Branco' : 'Escuro'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings__section">
        <h3>Comportamento</h3>
        <div className="settings__row">
          <div>
            <strong>Confirmar exclusao de cartao</strong>
            <p className="settings__hint">
              Pede uma segunda confirmacao antes de excluir um cartao.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={prefs.confirmCardDelete}
              onChange={(event) =>
                dispatch({ type: 'prefs/set', patch: { confirmCardDelete: event.target.checked } })
              }
            />
            <span />
          </label>
        </div>
      </section>
    </>
  );
}
