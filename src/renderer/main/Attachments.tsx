import { useState, type DragEvent } from 'react';
import {
  assetsAvailable,
  assetUrl,
  formatBytes,
  importDroppedFiles,
  openAsset,
  pickAssets,
  removeAsset,
  revealAsset,
} from '../shared/assets';
import type { Action } from '../shared/reducer';
import type { Card } from '../shared/types';
import './Attachments.css';

interface AttachmentsProps {
  card: Card;
  dispatch: (action: Action) => void;
}

/**
 * Card attachments. Files are copied into the asset store by the main process;
 * images get a thumbnail and can be promoted to the card cover.
 */
export function Attachments({ card, dispatch }: AttachmentsProps) {
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const available = assetsAvailable();

  async function attach(found: Promise<Card['attachments']>) {
    setBusy(true);
    try {
      const attachments = await found;
      if (attachments.length > 0) dispatch({ type: 'card/attach', cardId: card.id, attachments });
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropping(false);
    if (!available || event.dataTransfer.files.length === 0) return;
    void attach(importDroppedFiles(event.dataTransfer.files));
  }

  function detach(attachmentId: string, asset: string) {
    dispatch({ type: 'card/detach', cardId: card.id, attachmentId });
    // The document no longer points at the file, so delete it right away.
    void removeAsset(asset);
  }

  if (!available) {
    return (
      <section className="modal__section">
        <h3>Anexos</h3>
        <p className="attach__hint">
          Anexos precisam do app desktop; no navegador nao ha onde copiar o arquivo.
        </p>
      </section>
    );
  }

  return (
    <section className="modal__section">
      <h3>
        Anexos{' '}
        {card.attachments.length > 0 && (
          <span className="modal__progress-label">{card.attachments.length}</span>
        )}
      </h3>

      <div
        className={`attach__drop${dropping ? ' attach__drop--over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        <p>Arraste arquivos aqui</p>
        <div className="attach__actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void attach(pickAssets('any'))}
          >
            Escolher arquivos
          </button>
          <button
            type="button"
            className="btn btn--subtle"
            disabled={busy}
            onClick={() => void attach(pickAssets('image'))}
          >
            Escolher imagem
          </button>
        </div>
      </div>

      {card.attachments.length > 0 && (
        <ul className="attach__list">
          {card.attachments.map((attachment) => {
            const isCover = card.coverAttachmentId === attachment.id;
            return (
              <li key={attachment.id} className="attach__item">
                {attachment.isImage ? (
                  <img
                    className="attach__thumb"
                    src={assetUrl(attachment.asset)}
                    alt={attachment.name}
                    loading="lazy"
                  />
                ) : (
                  <span className="attach__thumb attach__thumb--file" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 16 16">
                      <path
                        d="M3 1.5h6l4 4v9h-10z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                      <path d="M9 1.5v4h4" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </span>
                )}

                <div className="attach__meta">
                  <button
                    type="button"
                    className="attach__name"
                    title="Abrir com o aplicativo do sistema"
                    onClick={() => void openAsset(attachment.asset)}
                  >
                    {attachment.name}
                  </button>
                  <span className="attach__sub">
                    {formatBytes(attachment.size)} -{' '}
                    {new Date(attachment.addedAt).toLocaleDateString('pt-BR')}
                    {isCover && ' - capa'}
                  </span>
                </div>

                <div className="attach__row-actions">
                  {attachment.isImage && (
                    <button
                      type="button"
                      className="btn btn--subtle"
                      onClick={() =>
                        dispatch({
                          type: 'card/cover',
                          cardId: card.id,
                          attachmentId: isCover ? null : attachment.id,
                        })
                      }
                    >
                      {isCover ? 'Tirar capa' : 'Usar como capa'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--subtle"
                    onClick={() => revealAsset(attachment.asset)}
                  >
                    Na pasta
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => detach(attachment.id, attachment.asset)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
