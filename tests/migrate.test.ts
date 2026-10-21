import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { migrateUserData } from '../electron/migrate';

function folders() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'taskly-migrate-'));
  const from = path.join(root, 'Nivora');
  const to = path.join(root, 'Taskly');
  mkdirSync(path.join(from, 'assets'), { recursive: true });
  mkdirSync(to);
  writeFileSync(path.join(from, 'boards.json'), '{"antigo":true}');
  writeFileSync(path.join(from, 'assets', 'abc.png'), 'imagem');
  return { root, from, to };
}

test('a pasta do nome antigo e copiada para a nova, com os anexos', () => {
  const { root, from, to } = folders();
  try {
    assert.equal(migrateUserData(from, to), true);
    assert.equal(readFileSync(path.join(to, 'boards.json'), 'utf8'), '{"antigo":true}');
    assert.equal(readFileSync(path.join(to, 'assets', 'abc.png'), 'utf8'), 'imagem');
    // Copia, nao move: a pasta antiga fica de backup.
    assert.equal(readFileSync(path.join(from, 'boards.json'), 'utf8'), '{"antigo":true}');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('nunca sobrescreve um documento que a pasta nova ja tem', () => {
  const { root, from, to } = folders();
  try {
    writeFileSync(path.join(to, 'boards.json'), '{"novo":true}');
    assert.equal(migrateUserData(from, to), false);
    assert.equal(readFileSync(path.join(to, 'boards.json'), 'utf8'), '{"novo":true}');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('sem pasta antiga, nao faz nada', () => {
  const { root, to } = folders();
  try {
    assert.equal(migrateUserData(path.join(root, 'nada'), to), false);
    assert.equal(migrateUserData(to, to), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
