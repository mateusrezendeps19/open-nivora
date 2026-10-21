import { useState } from 'react';
import { assetsAvailable, assetUrl, pickAssets } from '../assets';
import { useI18n } from '../i18n/context';
import type { Action } from '../reducer';
import { BOARD_COLORS, GRADIENTS, type Board } from '../types';
import './BackgroundSettings.css';

interface BackgroundSettingsProps {
  board: Board;
  dispatch: (action: Action) => void;
}

/**
 * Board background: solid colors, gradients, or an image from disk.
 *
 * Trello also offers Unsplash photos, which needs the network and an API key.
 * Taskly is offline, so the equivalent is picking a local file, which gets
 * copied into the asset store.
 */
export function BackgroundSettings({ board, dispatch }: BackgroundSettingsProps) {
  const [busy, setBusy] = useState(false);
  const { m } = useI18n();
  const current = board.background;

  function set(background: Board['background']) {
    // The old image goes once nothing points at it - another board may use
    // the same file. The main window decides that (App), even when this runs
    // in the preferences window, because the change reaches it from here.
    dispatch({ type: 'board/background', boardId: board.id, background });
  }

  async function pickImage() {
    setBusy(true);
    try {
      const [picked] = await pickAssets('image');
      if (picked) set({ kind: 'image', value: picked.asset });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="settings__lead">
        {m.background.leadBefore}
        <strong>{board.title}</strong>
        {m.background.leadAfter}
      </p>

      <section className="settings__section">
        <h3>{m.background.colors}</h3>
        <div className="bg__grid bg__grid--colors">
          {BOARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`bg__swatch${
                current.kind === 'color' && current.value === color ? ' bg__swatch--on' : ''
              }`}
              style={{ background: color }}
              aria-label={m.common.color(color)}
              aria-pressed={current.kind === 'color' && current.value === color}
              onClick={() => set({ kind: 'color', value: color })}
            />
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h3>{m.background.gradients}</h3>
        <div className="bg__grid">
          {GRADIENTS.map((gradient) => (
            <button
              key={gradient.id}
              type="button"
              className={`bg__swatch bg__swatch--wide${
                current.kind === 'gradient' && current.value === gradient.id
                  ? ' bg__swatch--on'
                  : ''
              }`}
              style={{ backgroundImage: gradient.css }}
              aria-label={m.background.gradientNames[gradient.id] ?? gradient.name}
              aria-pressed={current.kind === 'gradient' && current.value === gradient.id}
              onClick={() => set({ kind: 'gradient', value: gradient.id })}
            >
              <span>{m.background.gradientNames[gradient.id] ?? gradient.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h3>{m.background.image}</h3>
        {assetsAvailable() ? (
          <div className="bg__image">
            {current.kind === 'image' && (
              <img
                className="bg__preview"
                src={assetUrl(current.value)}
                alt={m.background.currentAlt}
              />
            )}
            <div className="bg__image-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={pickImage}
                disabled={busy}
              >
                {busy
                  ? m.background.opening
                  : current.kind === 'image'
                    ? m.background.changeImage
                    : m.background.pickImage}
              </button>
              {current.kind === 'image' && (
                <button
                  type="button"
                  className="btn btn--subtle"
                  onClick={() => set({ kind: 'color', value: board.color })}
                >
                  {m.background.removeImage}
                </button>
              )}
            </div>
            <p className="settings__hint">
              {m.background.imageHint}
            </p>
          </div>
        ) : (
          <p className="settings__hint">
            {m.background.unavailable}
          </p>
        )}
      </section>
    </>
  );
}
