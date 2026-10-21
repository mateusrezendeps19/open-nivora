import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInline, parseMarkdown, safeHref } from '../src/renderer/shared/markdown';

test('texto puro continua sendo um paragrafo, com as quebras de linha', () => {
  // Cartoes escritos antes do editor nao podem mudar de cara.
  assert.deepEqual(parseMarkdown('primeira linha\nsegunda linha'), [
    {
      type: 'paragraph',
      children: [
        { type: 'text', text: 'primeira linha' },
        { type: 'break' },
        { type: 'text', text: 'segunda linha' },
      ],
    },
  ]);
});

test('negrito, italico, tachado e codigo inline', () => {
  assert.deepEqual(parseInline('a **b** *c* ~~d~~ `e`'), [
    { type: 'text', text: 'a ' },
    { type: 'strong', children: [{ type: 'text', text: 'b' }] },
    { type: 'text', text: ' ' },
    { type: 'em', children: [{ type: 'text', text: 'c' }] },
    { type: 'text', text: ' ' },
    { type: 'strike', children: [{ type: 'text', text: 'd' }] },
    { type: 'text', text: ' ' },
    { type: 'code', text: 'e' },
  ]);
});

test('nada dentro de crases vira formatacao', () => {
  assert.deepEqual(parseInline('`**x**`'), [{ type: 'code', text: '**x**' }]);
});

test('nomes com sublinhado nao viram italico', () => {
  assert.deepEqual(parseInline('use nome_do_campo aqui'), [
    { type: 'text', text: 'use nome_do_campo aqui' },
  ]);
});

test('formatacao aninhada', () => {
  assert.deepEqual(parseInline('**muito *importante***'), [
    {
      type: 'strong',
      children: [
        { type: 'text', text: 'muito ' },
        { type: 'em', children: [{ type: 'text', text: 'importante' }] },
      ],
    },
  ]);
});

test('links e enderecos soltos viram links; javascript: nao', () => {
  assert.deepEqual(parseInline('[site](https://exemplo.com)'), [
    { type: 'link', href: 'https://exemplo.com', children: [{ type: 'text', text: 'site' }] },
  ]);
  assert.deepEqual(parseInline('veja https://exemplo.com/a.'), [
    { type: 'text', text: 'veja ' },
    {
      type: 'link',
      href: 'https://exemplo.com/a',
      children: [{ type: 'text', text: 'https://exemplo.com/a' }],
    },
    { type: 'text', text: '.' },
  ]);
  // O texto fica como o usuario escreveu, sem link nenhum.
  const unsafe = parseInline('[clique](javascript:alert(1))');
  assert.ok(unsafe.every((node) => node.type === 'text'), JSON.stringify(unsafe));
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref('www.exemplo.com'), 'https://www.exemplo.com');
});

test('listas com marcadores, numeradas e aninhadas', () => {
  const blocks = parseMarkdown('- um\n- dois\n  1. dois.a\n  2. dois.b\n- tres');
  assert.equal(blocks.length, 1);
  const list = blocks[0];
  assert.equal(list.type, 'list');
  if (list.type !== 'list') return;
  assert.equal(list.ordered, false);
  assert.equal(list.items.length, 3);
  const nested = list.items[1].children[0];
  assert.equal(nested.type, 'list');
  if (nested.type !== 'list') return;
  assert.equal(nested.ordered, true);
  assert.deepEqual(
    nested.items.map((item) => item.content),
    [[{ type: 'text', text: 'dois.a' }], [{ type: 'text', text: 'dois.b' }]],
  );
});

test('a lista numerada comeca no numero escrito', () => {
  const [list] = parseMarkdown('3. tres\n4. quatro');
  assert.equal(list.type === 'list' && list.start, 3);
});

test('titulos, citacao, regua e bloco de codigo', () => {
  const blocks = parseMarkdown('## Titulo\n\n> citado\n> **forte**\n\n---\n\n```\nconst a = **1**;\n```');
  assert.deepEqual(
    blocks.map((block) => block.type),
    ['heading', 'quote', 'rule', 'code'],
  );
  const code = blocks[3];
  assert.equal(code.type === 'code' && code.text, 'const a = **1**;');
});

test('texto que parece markup nao vira markup', () => {
  // A protecao e estrutural: o parser so devolve uma arvore, e o RichText a
  // desenha como elementos React. O texto chega intacto para virar texto.
  assert.deepEqual(parseMarkdown('<img src=x onerror=alert(1)>'), [
    { type: 'paragraph', children: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }] },
  ]);
});
