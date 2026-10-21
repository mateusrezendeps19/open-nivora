import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * A measured position in the content space of the flip root: the client rect
 * plus the scroll offsets of everything between the element and the root. Two
 * commits with a scroll in between would otherwise read as every card having
 * moved by the scroll amount.
 */
interface Spot {
  x: number;
  y: number;
}

/** Below this, the move is rounding, not a move. */
const THRESHOLD = 1;

function scrollSum(element: HTMLElement, root: HTMLElement): Spot {
  let x = 0;
  let y = 0;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    x += parent.scrollLeft;
    y += parent.scrollTop;
    if (parent === root) break;
  }
  return { x, y };
}

function measure(element: HTMLElement, root: HTMLElement): Spot {
  const rect = element.getBoundingClientRect();
  const scroll = scrollSum(element, root);
  return { x: rect.left + scroll.x, y: rect.top + scroll.y };
}

/**
 * FLIP over everything inside `root` carrying a `data-flip` key: after each
 * commit, anything that ended up somewhere else is put back where it was with
 * a transform and animated to zero, so it slides instead of jumping.
 *
 * This is what was missing from moving a card. The reducer is instant - the
 * card is in the other list on the next render - and the board redrew with
 * every neighbour in a new place at once. The drop indicator told the user
 * where the card *would* land, and then nothing showed it landing.
 *
 * Durations and easing are read from the recovered motion tokens at animation
 * time rather than written here, so `tokens.css` stays the one place they are
 * stated. Repositioning uses `--duration-long` with `--ease-inout-bold`, which
 * is what the real app's own reposition token is made of
 * (`--ds-flag-reposition: transform 250ms cubic-bezier(0.4, 0, 0, 1)`).
 */
export function useFlip(root: RefObject<HTMLElement | null>) {
  /** Layout positions as of the last commit. Never visual positions. */
  const previous = useRef(new Map<string, Spot>());
  /** Animations still in flight, so an interrupted one can be continued. */
  const flights = useRef(new Map<string, Animation>());
  /** Client-space starting points handed in by `seed`, for the next commit. */
  const seeds = useRef(new Map<string, Spot>());

  /**
   * Start the next animation of `key` from a point in client space instead of
   * from where it was last measured. The drop uses it: the card has to fly
   * from where the pointer let go of it, not from the slot it left behind.
   */
  const seed = useCallback((key: string, rect: { left: number; top: number }) => {
    seeds.current.set(key, { x: rect.left, y: rect.top });
  }, []);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;

    const elements: { key: string; element: HTMLElement }[] = [];
    for (const element of node.querySelectorAll<HTMLElement>('[data-flip]')) {
      const key = element.dataset.flip;
      if (key) elements.push({ key, element });
    }

    /*
     * An animation in flight translates the element, so its rect is where it
     * looks like it is and not where the layout put it. Its visual position is
     * where the next animation has to start from, and it has to be read before
     * the animation is cancelled - cancelling is what makes the measurement
     * below a layout measurement again.
     */
    const interrupted = new Map<string, Spot>();
    for (const { key, element } of elements) {
      const flight = flights.current.get(key);
      if (!flight) continue;
      if (flight.playState === 'running') interrupted.set(key, measure(element, node));
      flight.cancel();
      flights.current.delete(key);
    }

    const style = getComputedStyle(node);
    const duration = Number.parseFloat(style.getPropertyValue('--duration-long')) || 250;
    const easing = style.getPropertyValue('--ease-inout-bold').trim() || 'ease';
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const next = new Map<string, Spot>();
    const moving: HTMLElement[] = [];

    for (const { key, element } of elements) {
      const to = measure(element, node);
      next.set(key, to);

      // A seed is a client-space point, so it has to be lifted into the same
      // space the measurements are in before the two can be subtracted.
      const seeded = seeds.current.get(key);
      let from: Spot | undefined;
      if (seeded) {
        const scroll = scrollSum(element, node);
        from = { x: seeded.x + scroll.x, y: seeded.y + scroll.y };
      } else {
        from = interrupted.get(key) ?? previous.current.get(key);
      }
      if (!from) continue;

      const dx = from.x - to.x;
      const dy = from.y - to.y;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) continue;

      // A column that slides carries its cards with it, so a card inside one
      // must not also animate: it would travel the distance twice.
      if (moving.some((ancestor) => ancestor.contains(element))) continue;
      moving.push(element);
      if (still) continue;

      flights.current.set(
        key,
        element.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration, easing },
        ),
      );
    }

    previous.current = next;
    seeds.current.clear();
  });

  return seed;
}
