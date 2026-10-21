/**
 * The application menu's own words, in the languages the renderer offers.
 *
 * A copy and not an import: the main process cannot import renderer code
 * (see channels.ts for the same arrangement). The items Electron builds from
 * a `role` - Editar, recarregar, zoom - are labelled by Electron itself, in
 * the system's language, and are not here.
 */
export interface MenuLabels {
  file: string;
  newCard: string;
  settings: string;
  view: string;
  find: string;
  help: string;
  report: string;
}

const LABELS: Record<'pt' | 'en' | 'es', MenuLabels> = {
  pt: {
    file: 'Arquivo',
    newCard: 'Novo cartao',
    settings: 'Configuracoes',
    view: 'Exibir',
    find: 'Localizar na pagina',
    help: 'Ajuda',
    report: 'Relatorio de engenharia reversa',
  },
  en: {
    file: 'File',
    newCard: 'New card',
    settings: 'Settings',
    view: 'View',
    find: 'Find in page',
    help: 'Help',
    report: 'Reverse engineering report',
  },
  es: {
    file: 'Archivo',
    newCard: 'Nueva tarjeta',
    settings: 'Configuracion',
    view: 'Ver',
    find: 'Buscar en la pagina',
    help: 'Ayuda',
    report: 'Informe de ingenieria inversa',
  },
};

/** By language, as the renderer's `toLocale` does; anything else is Portuguese. */
export function menuLabels(locale: unknown): MenuLabels {
  const language = typeof locale === 'string' ? locale.toLowerCase().split(/[-_]/)[0] : '';
  return language === 'en' ? LABELS.en : language === 'es' ? LABELS.es : LABELS.pt;
}

/** The `prefs.locale` of a stored document, or undefined when it has none. */
export function documentLocale(doc: unknown): unknown {
  return (doc as { prefs?: { locale?: unknown } } | null)?.prefs?.locale;
}
