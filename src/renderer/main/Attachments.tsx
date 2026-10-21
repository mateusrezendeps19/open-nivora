import { useState, type DragEvent } from 'react';
import {
  assetsAvailable,
  assetUrl,
  formatBytes,
  importDroppedFiles,
  openAsset,
  pickAssets,
  revealAsset,
} from '../shared/assets';
import { useI18n } from '../shared/i18n/context';
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
  const { m, locale } = useI18n();
  const t = m.attachments;

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

  function detach(attachmentId: string) {
    // The file goes when nothing in the document points at it any more, which
    // App decides; another card may well be showing the same file.
    dispatch({ type: 'card/detach', cardId: card.id, attachmentId });
  }

  if (!available) {
    return (
      <section className="modal__section">
        <h3>{t.heading}</h3>
        <p className="attach__hint">{t.unavailable}</p>
      </section>
    );
  }

  return (
    <section className="modal__section">
      <h3>
        {t.heading}{' '}
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
        <p>{t.dropHere}</p>
        <div className="attach__actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void attach(pickAssets('any'))}
          >
            {t.pickFiles}
          </button>
          <button
            type="button"
            className="btn btn--subtle"
            disabled={busy}
            onClick={() => void attach(pickAssets('image'))}
          >
            {t.pickImage}
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
                    title={t.openWithSystem}
                    onClick={() => void openAsset(attachment.asset)}
                  >
                    {attachment.name}
                  </button>
                  <span className="attach__sub">
                    {formatBytes(attachment.size)} -{' '}
                    {new Date(attachment.addedAt).toLocaleDateString(locale)}
                    {isCover && t.isCover}
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
                      {isCover ? t.removeCover : t.useAsCover}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--subtle"
                    onClick={() => revealAsset(attachment.asset)}
                  >
                    {t.reveal}
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => detach(attachment.id)}
                  >
                    {m.common.remove}
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
