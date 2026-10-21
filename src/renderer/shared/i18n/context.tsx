import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { messages, toLocale, type Locale, type Messages } from './index';

interface I18n {
  locale: Locale;
  m: Messages;
}

const I18nContext = createContext<I18n>({ locale: toLocale(null), m: messages(null) });

/**
 * Hands the strings of the document's language to everything under it. Each
 * window renders one at its root, from `doc.prefs.locale`, so a language
 * picked in the preferences window reaches the board the moment the document
 * does - the same way the theme does.
 */
export function I18nProvider({ locale, children }: { locale: unknown; children: ReactNode }) {
  const value = useMemo(() => ({ locale: toLocale(locale), m: messages(locale) }), [locale]);

  // Screen readers and the spellchecker go by the page's own language.
  useEffect(() => {
    document.documentElement.lang = value.locale;
  }, [value.locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
