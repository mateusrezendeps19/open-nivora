import assert from 'node:assert/strict';
import test from 'node:test';
import { previewMove, slotToIndex } from '../src/renderer/main/cardDrag';
import { emptyCard, emptyList } from '../src/renderer/shared/document';
import {
  activeFilterCount,
  EMPTY_FILTER,
  isShown,
  matchesFilter,
  withLabels,
  type CardFilter,
} from '../src/renderer/shared/filter';
import type { Card } from '../src/renderer/shared/types';

const NOW = Date.parse('2026-10-21T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();

function card(patch: Partial<Card>): Card {
  return { ...emptyCard(patch.title ?? 'cartao'), createdAt: iso(-DAY), ...patch };
}

const filter = (patch: Partial<CardFilter>): CardFilter => ({ ...EMPTY_FILTER, ...patch });
const pick = (cards: Card[], f: CardFilter) =>
  cards.filter((entry) => matchesFilter(entry, f, NOW)).map((entry) => entry.title);

test('sem nada marcado, o filtro deixa tudo passar', () => {
  assert.equal(matchesFilter(card({}), EMPTY_FILTER, NOW), true);
  assert.equal(activeFilterCount(EMPTY_FILTER), 0);
});

test('palavra-chave procura no titulo e na descricao, sem diferenciar maiusculas', () => {
  const cards = [
    card({ title: 'Relatorio' }),
    card({ title: 'Outro', description: 'ver o RELATORIO' }),
    card({ title: 'Nada' }),
  ];
  assert.deepEqual(pick(cards, filter({ keyword: ' relatorio ' })), ['Relatorio', 'Outro']);
});

test('concluido e nao concluido: um restringe, os dois juntos sao todos', () => {
  const cards = [card({ title: 'feito', done: true }), card({ title: 'aberto' })];
  assert.deepEqual(pick(cards, filter({ done: true })), ['feito']);
  assert.deepEqual(pick(cards, filter({ open: true })), ['aberto']);
  assert.deepEqual(pick(cards, filter({ done: true, open: true })), ['feito', 'aberto']);
});

test('prazos: as janelas olham para frente, e atrasado ignora o que ja foi concluido', () => {
  const cards = [
    card({ title: 'sem prazo' }),
    card({ title: 'atrasado', due: iso(-DAY) }),
    card({ title: 'atrasado mas feito', due: iso(-DAY), done: true }),
    card({ title: 'amanha', due: iso(12 * 60 * 60 * 1000) }),
    card({ title: 'em 5 dias', due: iso(5 * DAY) }),
    card({ title: 'em 20 dias', due: iso(20 * DAY) }),
    card({ title: 'em 60 dias', due: iso(60 * DAY) }),
  ];
  assert.deepEqual(pick(cards, filter({ due: ['none'] })), ['sem prazo']);
  assert.deepEqual(pick(cards, filter({ due: ['overdue'] })), ['atrasado']);
  assert.deepEqual(pick(cards, filter({ due: ['day'] })), ['amanha']);
  assert.deepEqual(pick(cards, filter({ due: ['week'] })), ['amanha', 'em 5 dias']);
  assert.deepEqual(pick(cards, filter({ due: ['month'] })), ['amanha', 'em 5 dias', 'em 20 dias']);
  // Dentro do grupo, as opcoes somam.
  assert.deepEqual(pick(cards, filter({ due: ['none', 'overdue'] })), ['sem prazo', 'atrasado']);
});

test('etiquetas: qualquer uma, todas, ou sem etiqueta', () => {
  const cards = [
    card({ title: 'vermelho', labelIds: ['red'] }),
    card({ title: 'os dois', labelIds: ['red', 'blue'] }),
    card({ title: 'nenhuma' }),
  ];
  assert.deepEqual(pick(cards, filter({ labels: ['red', 'blue'] })), ['vermelho', 'os dois']);
  assert.deepEqual(pick(cards, filter({ labels: ['red', 'blue'], labelMatch: 'all' })), ['os dois']);
  assert.deepEqual(pick(cards, filter({ noLabels: true })), ['nenhuma']);
  assert.deepEqual(pick(cards, filter({ noLabels: true, labels: ['blue'] })), ['os dois', 'nenhuma']);
});

test('atividade conta comentarios e eventos, nao so a criacao', () => {
  const old = card({ title: 'parado', createdAt: iso(-60 * DAY) });
  const revived = card({
    title: 'comentado ontem',
    createdAt: iso(-60 * DAY),
    activity: [{ id: 'a', kind: 'comment', text: 'oi', at: iso(-DAY), editedAt: null }],
  });
  const recent = card({ title: 'novo', createdAt: iso(-3 * DAY) });
  const cards = [old, revived, recent];
  assert.deepEqual(pick(cards, filter({ activity: 'week' })), ['comentado ontem', 'novo']);
  assert.deepEqual(pick(cards, filter({ activity: 'stale' })), ['parado']);
});

test('entre grupos o filtro estreita', () => {
  const cards = [
    card({ title: 'vermelho atrasado', labelIds: ['red'], due: iso(-DAY) }),
    card({ title: 'vermelho sem prazo', labelIds: ['red'] }),
    card({ title: 'azul atrasado', labelIds: ['blue'], due: iso(-DAY) }),
  ];
  assert.deepEqual(pick(cards, filter({ labels: ['red'], due: ['overdue'] })), ['vermelho atrasado']);
  assert.equal(activeFilterCount(filter({ labels: ['red'], due: ['overdue'] })), 2);
});

test('arquivado nunca aparece, com ou sem filtro', () => {
  assert.equal(isShown(card({ archivedAt: iso(-DAY) }), EMPTY_FILTER, NOW), false);
});

/*
 * O arraste conta a vaga entre os cartoes desenhados e a aplica na lista
 * inteira, que guarda tambem os arquivados e os escondidos pelo filtro.
 * Validado contra o bug devolvendo `slot` direto, sem conversao: o caso
 * "depois do ultimo visivel" falha.
 */
test('a vaga entre os visiveis cai no lugar certo da lista inteira', () => {
  const list = emptyList('L');
  const a = card({ title: 'a' });
  const hidden = card({ title: 'arquivado', archivedAt: iso(-DAY) });
  const b = card({ title: 'b' });
  const tail = card({ title: 'arquivado no fim', archivedAt: iso(-DAY) });
  list.cards = [a, hidden, b, tail];
  const moving = card({ title: 'novo' });
  const other = { ...emptyList('Outra'), cards: [moving] };
  const shown = (entry: Card) => isShown(entry, EMPTY_FILTER, NOW);

  const drawnAfter = (slot: number) => {
    const index = slotToIndex(list.cards, moving.id, shown, slot);
    const [result] = previewMove([list, other], moving.id, { listId: list.id, index });
    return result.cards.filter(shown).map((entry) => entry.title);
  };

  assert.deepEqual(drawnAfter(0), ['novo', 'a', 'b']);
  assert.deepEqual(drawnAfter(1), ['a', 'novo', 'b']);
  assert.deepEqual(drawnAfter(2), ['a', 'b', 'novo']);
  // Os escondidos de baixo continuam embaixo.
  const index = slotToIndex(list.cards, moving.id, shown, 2);
  assert.equal(index, 3);
});

test('uma lista sem nada visivel recebe o cartao no fim', () => {
  const hidden = card({ title: 'x', archivedAt: iso(-DAY) });
  assert.equal(slotToIndex([hidden], 'outro', () => false, 0), 1);
});

test('uma etiqueta excluida sai do filtro em vez de esconder tudo', () => {
  const ticked = filter({ labels: ['lbl-red', 'lbl-gone'] });
  const live = withLabels(ticked, ['lbl-red', 'lbl-green']);
  assert.deepEqual(live.labels, ['lbl-red']);
  assert.equal(activeFilterCount(withLabels(filter({ labels: ['lbl-gone'] }), ['lbl-red'])), 0);
  // Nada a tirar: o mesmo objeto, para nao refazer o quadro a toa.
  assert.equal(withLabels(live, ['lbl-red']), live);
});
