import { useEffect, type RefObject } from 'react';

/**
 * Closes a popover on a mousedown outside it and on Escape - what the list
 * menu was missing, and what every popover on the board needs.
 *
 * `trigger` is the button that opens it: a mousedown there is that button's
 * own toggle, and treating it as outside would close the popover only for the
 * click to open it again.
 *
 * The mousedown is listened for in the capture phase, so a handler below that
 * stops the event - a card starting a drag, say - cannot keep it open.
 */
export function useDismiss(
  popover: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popover.current?.contains(target) || trigger.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [popover, trigger, onClose]);
}
