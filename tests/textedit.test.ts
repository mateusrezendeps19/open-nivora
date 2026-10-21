import assert from 'node:assert/strict';
import test from 'node:test';
import {
  continueList,
  indentList,
  insertCodeBlock,
  insertLink,
  toggleLinePrefix,
  toggleWrap,
  type TextState,
} from '../src/renderer/shared/textEdit';

/** `[` e `]` marcam a selecao, `|` o cursor: le e escreve o estado como texto. */
function at(marked: string): TextState {
  const caret = marked.indexOf('|');
  if (caret >= 0) {
    const value = marked.replace('|', '');
    return { value, start: caret, end: caret };
  }
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return { value: marked.replace('[', '').replace(']', ''), start, end };
}

function show({ value, start, end }: TextState): string {
  if (start === end) return `${value.slice(0, start)}|${value.slice(start)}`;
  return `${value.slice(0, start)}[${value.slice(start, end)}]${value.slice(end)}`;
}

test('negrito envolve a selecao e a mantem selecionada', () => {
  assert.equal(show(toggleWrap(at('um [dois] tres'), '**', 'negrito')), 'um **[dois]** tres');
});

test('negrito de novo tira o negrito, com ou sem os asteriscos selecionados', () => {
  assert.equal(show(toggleWrap(at('um **[dois]** tres'), '**', 'negrito')), 'um [dois] tres');
  assert.equal(show(toggleWrap(at('um [**dois**] tres'), '**', 'negrito')), 'um [dois] tres');
});

test('sem selecao, insere um texto de exemplo ja selecionado', () => {
  assert.equal(show(toggleWrap(at('a |b'), '*', 'italico')), 'a *[italico]*b');
});

test('lista com marcadores em todas as linhas tocadas, e de volta', () => {
  const listed = toggleLinePrefix(at('[um\ndois]'), 'bullet');
  assert.equal(listed.value, '- um\n- dois');
  assert.equal(toggleLinePrefix(listed, 'bullet').value, 'um\ndois');
});

test('lista numerada numera na ordem e substitui o marcador anterior', () => {
  assert.equal(toggleLinePrefix(at('[- um\n- dois\n- tres]'), 'ordered').value, '1. um\n2. dois\n3. tres');
});

test('o cursor acompanha o texto quando o prefixo entra', () => {
  assert.equal(show(toggleLinePrefix(at('ab|c'), 'quote')), '> ab|c');
});

test('titulo e citacao', () => {
  assert.equal(toggleLinePrefix(at('|Titulo'), 'heading').value, '## Titulo');
  assert.equal(toggleLinePrefix(at('## |Titulo'), 'heading').value, 'Titulo');
});

test('link usa a selecao como texto e deixa a url selecionada', () => {
  assert.equal(show(insertLink(at('ver [site] agora'))), 'ver [site]([https://]) agora');
});

test('bloco de codigo fica em linhas proprias', () => {
  assert.equal(insertCodeBlock(at('a [x = 1] b')).value, 'a \n```\nx = 1\n```\n b');
});

test('enter numa lista continua a lista', () => {
  assert.equal(show(continueList(at('- um|')!)), '- um\n- |');
  assert.equal(show(continueList(at('  3. tres|')!)), '  3. tres\n  4. |');
});

test('enter num item vazio sai da lista', () => {
  assert.equal(show(continueList(at('- um\n- |')!)), '- um\n|');
});

test('enter fora de lista fica com o comportamento normal', () => {
  assert.equal(continueList(at('texto|')), null);
});

test('tab aninha o item e shift+tab o devolve', () => {
  const nested = indentList(at('- um\n- do|is'), false)!;
  assert.equal(show(nested), '- um\n  - do|is');
  assert.equal(show(indentList(nested, true)!), '- um\n- do|is');
  assert.equal(indentList(at('texto|'), false), null);
});

test('lista numa linha vazia comeca a lista', () => {
  // O caso mais comum: Enter e depois o botao, antes de escrever o item.
  assert.equal(show(toggleLinePrefix(at('Titulo\n|'), 'bullet')), 'Titulo\n- |');
  assert.equal(show(toggleLinePrefix(at('|'), 'ordered')), '1. |');
});

test('tab sem nenhum item na selecao nao e da lista', () => {
  assert.equal(indentList(at('|'), false), null);
});
