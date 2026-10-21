import { LOCALES } from '../i18n';
import { useI18n } from '../i18n/context';
import type { Action } from '../reducer';
import type { Prefs } from '../types';
import './AppearanceSettings.css';

interface AppearanceSettingsProps {
  prefs: Prefs;
  dispatch: (action: Action) => void;
}

/** Theme, language and the behaviour toggles that used to sit in the toolbar. */
export function AppearanceSettings({ prefs, dispatch }: AppearanceSettingsProps) {
  const { m, locale } = useI18n();

  return (
    <>
      <section className="settings__section">
        <h3>{m.appearance.theme}</h3>
        <div className="settings__row">
          <p className="settings__hint">
            {m.appearance.themeHint}
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
                {theme === 'light' ? m.appearance.light : m.appearance.dark}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings__section">
        <h3>{m.appearance.language}</h3>
        <div className="settings__row">
          <p className="settings__hint">{m.appearance.languageHint}</p>
          {/*
            Each name in its own language and never translated, so whoever
            switched to a language they cannot read can still find their own.
          */}
          <div className="segmented" role="radiogroup" aria-label={m.appearance.language}>
            {LOCALES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                lang={entry.id}
                className={locale === entry.id ? 'is-on' : ''}
                aria-checked={locale === entry.id}
                onClick={() => dispatch({ type: 'prefs/set', patch: { locale: entry.id } })}
              >
                {entry.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings__section">
        <h3>{m.appearance.behaviour}</h3>
        <div className="settings__row">
          <div>
            <strong>{m.appearance.confirmDelete}</strong>
            <p className="settings__hint">
              {m.appearance.confirmDeleteHint}
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
