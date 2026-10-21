import { en } from './en';
import { es } from './es';
import { pt, type Messages } from './pt';

export type { Messages } from './pt';

/**
 * The languages the interface speaks. The ids are BCP 47 tags, the same ones
 * handed to `Intl` and `toLocaleDateString`, so a date on screen is always in
 * the language of the words around it. `pt-BR` was already the value of
 * `prefs.locale` before there was a choice, so existing documents need no
 * migration.
 */
export type Locale = 'pt-BR' | 'en-US' | 'es-ES';

export const DEFAULT_LOCALE: Locale = 'pt-BR';

/** Each name in its own language, which is how a language picker is read. */
export const LOCALES: { id: Locale; name: string }[] = [
  { id: 'pt-BR', name: 'Portugues' },
  { id: 'en-US', name: 'English' },
  { id: 'es-ES', name: 'Espanol' },
];

const MESSAGES: Record<Locale, Messages> = {
  'pt-BR': pt,
  'en-US': en,
  'es-ES': es,
};

/**
 * Any tag to one of ours, by language: `en-GB` reads English, `pt-PT`
 * Portuguese, `es-MX` Spanish. Anything else - or nothing - is the default,
 * so a document edited by hand cannot leave the app without words.
 */
export function toLocale(value: unknown): Locale {
  if (typeof value !== 'string') return DEFAULT_LOCALE;
  const language = value.toLowerCase().split(/[-_]/)[0];
  if (language === 'en') return 'en-US';
  if (language === 'es') return 'es-ES';
  return DEFAULT_LOCALE;
}

/**
 * The language a brand-new document starts in: the system's, when it is one
 * of ours. Only the first run asks; after that the choice is in the document.
 */
export function systemLocale(): Locale {
  return typeof navigator === 'undefined' ? DEFAULT_LOCALE : toLocale(navigator.language);
}

export function messages(locale: unknown): Messages {
  return MESSAGES[toLocale(locale)];
}
