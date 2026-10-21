/**
 * Chromium draws its own drag image: a flat snapshot of the element, taken
 * when the drag starts, that cannot be tilted, scaled or restyled afterwards.
 * The board wants a card that lifts and tilts under the pointer, so the native
 * image is replaced with a 1x1 transparent GIF and the card is drawn by the
 * board itself (`.drag-layer` in BoardCanvas).
 *
 * Decoding is asynchronous even for a data URL, and `setDragImage` with an
 * image that has not decoded yet is ignored - which would leave the native
 * ghost *and* the board's own card on screen at once. So this reports whether
 * it took: on false the caller leaves the native drag image alone and keeps
 * the card in its slot, which is how the board behaved before.
 */
const transparent = new Image();
transparent.src =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function hideNativeDragImage(transfer: DataTransfer): boolean {
  if (!transparent.complete || transparent.naturalWidth === 0) return false;
  transfer.setDragImage(transparent, 0, 0);
  return true;
}
