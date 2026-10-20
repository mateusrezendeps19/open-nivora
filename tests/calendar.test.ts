import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMonths,
  dateKey,
  fromDateInput,
  groupByDay,
  monthMatrix,
  moveDue,
  startOfWeek,
  toDateInput,
  weekDays,
} from '../src/renderer/shared/calendar';
import { emptyCard, emptyList } from '../src/renderer/shared/document';
import type { List } from '../src/renderer/shared/types';

/** A local date, written the way the grid reads it. */
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

test('a semana comeca no domingo', () => {
  // 2026-10-20 is a Tuesday; its week starts on the 18th.
  assert.equal(dateKey(startOfWeek(local(2026, 10, 20))), '2026-10-18');
  assert.deepEqual(
    weekDays(local(2026, 10, 20)).map(dateKey),
    [
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
    ],
  );
});

test('a grade mensal cobre semanas inteiras ao redor do mes', () => {
  const weeks = monthMatrix(local(2026, 10, 20));
  assert.equal(weeks.length, 5);
  assert.equal(dateKey(weeks[0][0]), '2026-09-27');
  assert.equal(dateKey(weeks[4][6]), '2026-10-31');
  for (const week of weeks) assert.equal(week.length, 7);
});

test('passar de mes nao pula um mes curto a partir do dia 31', () => {
  assert.equal(dateKey(addMonths(local(2026, 1, 31), 1)), '2026-02-01');
  assert.equal(dateKey(addMonths(local(2026, 3, 1), -1)), '2026-02-01');
});

test('o prazo vai e volta do input de data no fuso local', () => {
  const iso = fromDateInput('2026-10-20');
  assert.ok(iso);
  // The naive `new Date('2026-10-20')` would be UTC midnight, which is still
  // the 19th anywhere west of Greenwich.
  assert.equal(new Date(iso).getDate(), 20);
  assert.equal(toDateInput(iso), '2026-10-20');
  assert.equal(fromDateInput(''), null);
});

test('mudar a data mantem a hora do prazo', () => {
  const iso = local(2026, 10, 20, 14, 30).toISOString();
  const moved = new Date(moveDue(iso, local(2026, 11, 3)));
  assert.equal(dateKey(moved), '2026-11-03');
  assert.equal(moved.getHours(), 14);
  assert.equal(moved.getMinutes(), 30);
});

test('cartoes sao agrupados pelo dia local e ordenados por hora', () => {
  const list = emptyList('A');
  const late = { ...emptyCard('tarde'), due: local(2026, 10, 20, 18, 0).toISOString() };
  const early = { ...emptyCard('cedo'), due: local(2026, 10, 20, 9, 0).toISOString() };
  const other = { ...emptyCard('outro dia'), due: local(2026, 10, 21, 9, 0).toISOString() };
  const none = emptyCard('sem prazo');
  list.cards = [late, early, other, none];

  const { byDay, undated, dated } = groupByDay([list as List]);
  assert.equal(dated, 3);
  assert.deepEqual(
    byDay.get('2026-10-20')!.map((entry) => entry.card.title),
    ['cedo', 'tarde'],
  );
  assert.equal(byDay.get('2026-10-21')!.length, 1);
  assert.deepEqual(
    undated.map((entry) => entry.card.title),
    ['sem prazo'],
  );
});

test('o filtro da busca vale para o calendario', () => {
  const list = emptyList('A');
  list.cards = [
    { ...emptyCard('comprar leite'), due: local(2026, 10, 20).toISOString() },
    { ...emptyCard('pagar conta'), due: local(2026, 10, 20).toISOString() },
    { ...emptyCard('sem prazo, com leite na descricao'), description: 'leite' },
  ];

  const { byDay, undated, dated } = groupByDay([list as List], 'leite');
  assert.equal(dated, 1);
  assert.equal(byDay.get('2026-10-20')!.length, 1);
  assert.equal(undated.length, 1);
});
