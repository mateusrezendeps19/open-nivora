import { useState } from 'react';
import { assetsAvailable, assetUrl, pickAssets, removeAsset } from '../assets';
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
 * Nivora is offline, so the equivalent is picking a local file, which gets
 * copied into the asset store.
 */
export function BackgroundSettings({ board, dispatch }: BackgroundSettingsProps) {
  const [busy, setBusy] = useState(false);
  const current = board.background;

  function set(background: Board['background']) {
    // Replacing a custom image leaves the old file unreferenced; drop it now
    // rather than waiting for the next startup sweep.
    const previous = current.kind === 'image' ? current.value : null;
    dispatch({ type: 'board/background', boardId: board.id, background });
    if (previous && previous !== (background.kind === 'image' ? background.value : null)) {
      void removeAsset(previous);
    }
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
        Vale para o quadro <strong>{board.title}</strong>.
      </p>

      <section className="settings__section">
        <h3>Cores</h3>
        <div className="bg__grid bg__grid--colors">
          {BOARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`bg__swatch${
                current.kind === 'color' && current.value === color ? ' bg__swatch--on' : ''
              }`}
              style={{ background: color }}
              aria-label={`Cor ${color}`}
              aria-pressed={current.kind === 'color' && current.value === color}
              onClick={() => set({ kind: 'color', value: color })}
            />
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h3>Gradientes</h3>
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
              aria-label={gradient.name}
              aria-pressed={current.kind === 'gradient' && current.value === gradient.id}
              onClick={() => set({ kind: 'gradient', value: gradient.id })}
            >
              <span>{gradient.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h3>Imagem</h3>
        {assetsAvailable() ? (
          <div className="bg__image">
            {current.kind === 'image' && (
              <img
                className="bg__preview"
                src={assetUrl(current.value)}
                alt="Fundo atual do quadro"
              />
            )}
            <div className="bg__image-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={pickImage}
                disabled={busy}
              >
                {busy ? 'Abrindo...' : current.kind === 'image' ? 'Trocar imagem' : 'Escolher imagem'}
              </button>
              {current.kind === 'image' && (
                <button
                  type="button"
                  className="btn btn--subtle"
                  onClick={() => set({ kind: 'color', value: board.color })}
                >
                  Remover imagem
                </button>
              )}
            </div>
            <p className="settings__hint">
              A imagem e copiada para a pasta de dados do app, ate 25 MB. Nada sai da maquina.
            </p>
          </div>
        ) : (
          <p className="settings__hint">
            Imagem de fundo precisa do app desktop; no navegador nao ha onde copiar o arquivo.
          </p>
        )}
      </section>
    </>
  );
}
