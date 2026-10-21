import assert from 'node:assert/strict';
import test from 'node:test';
import { menuLabels } from '../electron/menuLabels';
import { relativeTime } from '../src/renderer/shared/calendar';
import { emptyBoard, emptyCard, emptyList, normalize, seedDocument } from '../src/renderer/shared/document';
import { LOCALES, messages, toLocale } from '../src/renderer/shared/i18n';
import { pt } from '../src/renderer/shared/i18n/pt';
import { reducer } from '../src/renderer/shared/reducer';
import { DEFAULT_LABELS, type BoardDocument } from '../src/renderer/shared/types';

/** Every path to a leaf, so two languages can be compared shape for shape. */
function shape(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [`${prefix}:${typeof value}`];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => shape(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function fixture(locale: BoardDocument['prefs']['locale']): BoardDocument {
  const board = emptyBoard('Quadro', '#0079bf');
  const todo = emptyList('A fazer');
  const done = emptyList('Feito');
  todo.cards = [emptyCard('x')];
  board.lists = [todo, done];
  return {
    version: 2,
    boards: [board],
    activeBoardId: board.id,
    labels: DEFAULT_LABELS,
    prefs: {
      theme: 'dark',
      locale,
      confirmCardDelete: true,
      automationsEnabled: true,
      sidebarCollapsed: false,
      view: 'board',
    },
  };
}

test('cada idioma tem exatamente as mesmas mensagens que o portugues', () => {
  // O typecheck ja exige isso; aqui pega o que um cast deixaria passar, como
  // um gradiente ou uma etiqueta padrao esquecidos num Record.
  for (const { id } of LOCALES) {
    assert.deepEqual(shape(messages(id)), shape(pt), `mensagens de ${id}`);
  }
});

test('nenhuma mensagem fica vazia em nenhum idioma', () => {
  const blank = (value: unknown, path: string): string[] => {
    if (typeof value === 'string') return value.trim() ? [] : [path];
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, child]) => blank(child, `${path}.${key}`));
  };
  for (const { id } of LOCALES) {
    assert.deepEqual(blank(messages(id), id), [], `mensagens vazias em ${id}`);
  }
});

test('qualquer variante de um idioma cai no nosso, e o resto no portugues', () => {
  assert.equal(toLocale('en-GB'), 'en-US');
  assert.equal(toLocale('en'), 'en-US');
  assert.equal(toLocale('es-MX'), 'es-ES');
  assert.equal(toLocale('es_AR'), 'es-ES');
  assert.equal(toLocale('pt-PT'), 'pt-BR');
  assert.equal(toLocale('fr-FR'), 'pt-BR');
  assert.equal(toLocale(undefined), 'pt-BR');
  assert.equal(toLocale(42), 'pt-BR');
});

test('um documento sem idioma e de antes da escolha, e era portugues', () => {
  const doc = normalize(JSON.parse(JSON.stringify({ ...fixture('pt-BR'), prefs: { theme: 'dark' } })));
  assert.equal(doc.prefs.locale, 'pt-BR');
});

test('o idioma escolhido sobrevive ao normalize, e um invalido nao quebra o app', () => {
  assert.equal(normalize(fixture('es-ES')).prefs.locale, 'es-ES');
  const broken = { ...fixture('pt-BR'), prefs: { ...fixture('pt-BR').prefs, locale: 'klingon' } };
  assert.equal(normalize(broken).prefs.locale, 'pt-BR');
});

test('o primeiro uso comeca no idioma pedido, com conteudo e etiquetas nele', () => {
  const doc = seedDocument('en-US');
  assert.equal(doc.prefs.locale, 'en-US');
  assert.equal(doc.boards[0].title, 'My first board');
  assert.deepEqual(
    doc.boards[0].lists.map((list) => list.title),
    ['To do', 'In progress', 'Done'],
  );
  assert.equal(doc.labels.find((label) => label.id === 'lbl-green')?.name, 'Ready');
  // Os ids e as cores sao os mesmos em todo idioma; so o nome muda.
  assert.deepEqual(
    doc.labels.map((label) => [label.id, label.color]),
    DEFAULT_LABELS.map((label) => [label.id, label.color]),
  );
  // E sem documento nenhum, normalize semeia no idioma que recebeu.
  assert.equal(normalize(null, 'es-ES').boards[0].title, 'Mi primer tablero');
});

test('o historico e escrito no idioma em uso e nao muda quando ele muda', () => {
  const doc = fixture('en-US');
  const card = doc.boards[0].lists[0].cards[0];
  const feito = doc.boards[0].lists[1].id;

  const moved = reducer(doc, { type: 'card/move', cardId: card.id, toListId: feito, toIndex: 0 });
  const switched = reducer(moved, { type: 'prefs/set', patch: { locale: 'es-ES' } });
  const done = reducer(switched, { type: 'card/update', cardId: card.id, patch: { done: true } });

  assert.deepEqual(
    done.boards[0].lists[1].cards[0].activity.map((entry) => entry.text),
    ['Moved from A fazer to Feito', 'Marco como completada'],
  );
});

test('o tempo relativo do historico segue o idioma', () => {
  const now = new Date('2026-10-21T12:00:00');
  const ago = (minutes: number, locale: 'pt-BR' | 'en-US' | 'es-ES') =>
    relativeTime(new Date(now.getTime() - minutes * 60_000).toISOString(), now, locale);
  assert.equal(ago(0, 'en-US'), 'just now');
  assert.equal(ago(5, 'en-US'), '5 min ago');
  assert.equal(ago(120, 'es-ES'), 'hace 2 h');
  assert.equal(ago(5, 'pt-BR'), 'ha 5 min');
});

test('o menu nativo acompanha o idioma do documento', () => {
  assert.equal(menuLabels('en-US').file, 'File');
  assert.equal(menuLabels('es-ES').file, 'Archivo');
  assert.equal(menuLabels('pt-BR').file, 'Arquivo');
  assert.equal(menuLabels(undefined).file, 'Arquivo');
});
