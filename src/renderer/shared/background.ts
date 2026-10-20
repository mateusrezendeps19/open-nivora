import type { CSSProperties } from 'react';
import { assetUrl } from './assets';
import { GRADIENTS, type Background } from './types';

/**
 * Turns a stored background into CSS.
 *
 * Every variant gets a translucent scrim on top: lists and cards sit directly
 * on the background, and a photo without one makes their text unreadable.
 */

const DARK_SCRIM = 'linear-gradient(0deg, rgb(0 0 0 / 0.34), rgb(0 0 0 / 0.34))';
const LIGHT_SCRIM = 'linear-gradient(0deg, rgb(255 255 255 / 0.3), rgb(255 255 255 / 0.3))';

export function backgroundTone(background: Background): 'dark' | 'light' {
  if (background.kind === 'gradient') {
    return GRADIENTS.find((gradient) => gradient.id === background.value)?.tone ?? 'dark';
  }
  if (background.kind === 'image') return 'dark';
  return luminance(background.value) > 0.6 ? 'light' : 'dark';
}

export function backgroundStyle(background: Background): CSSProperties {
  const scrim = backgroundTone(background) === 'light' ? LIGHT_SCRIM : DARK_SCRIM;

  switch (background.kind) {
    case 'gradient': {
      const gradient = GRADIENTS.find((candidate) => candidate.id === background.value);
      if (!gradient) return { background: '#0079bf' };
      return { backgroundImage: `${scrim}, ${gradient.css}` };
    }

    case 'image':
      return {
        backgroundImage: `${scrim}, url("${assetUrl(background.value)}")`,
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat',
      };

    case 'color':
    default:
      return {
        backgroundImage: `${scrim}, linear-gradient(135deg, ${background.value}, color-mix(in srgb, ${background.value} 55%, #000))`,
      };
  }
}

/** Relative luminance of a #rrggbb color, used to pick the scrim. */
function luminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0;
  const value = Number.parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
