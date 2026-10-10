const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const file = path.join(__dirname, '../src/services/exercicios.service.js');
const AppError = require('../src/utils/AppError');

function load(db) {
  const module = { exports: {} };
  const localRequire = createRequire(file);
  const helperFile = path.join(__dirname, '../src/services/wger.service.js');
  const helperModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(helperFile, 'utf8'), { module: helperModule,
    require: () => ({ prisma: {} }), URL, AbortController, setTimeout, clearTimeout, fetch });
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module,
    require: id => id === '../config/prisma' ? { prisma: db } : id === './wger.service' ? helperModule.exports : localRequire(id) });
  return module.exports;
}
const valid = { nome: 'Supino', grupo_muscular: 'Peito', instrucoes: '<p>Controle &amp; conforto</p>', imagem_url: 'https://example.test/supino.png' };

test('CRUD valida corpo, limites, ID integral e URL HTTPS antes de acessar o banco', async () => {
  let calls = 0;
  const service = load({ catalogoExercicio: { findUnique: async () => { calls++; return {}; }, create: async () => { calls++; } } });
  for (const input of [null, [], {}, { ...valid, nome: 'x'.repeat(101) },
    { ...valid, nome: '<script>foo</script>' }, { ...valid, grupo_muscular: ['Peito'] },
    { ...valid, instrucoes: {} }, { ...valid, instrucoes: 'x'.repeat(10001) },
    { ...valid, imagem_url: 'javascript:alert(1)' }, { ...valid, imagem_url: 'http://example.test/x' },
    { ...valid, imagem_url: 'https://user:pass@example.test/x' }]) {
    await assert.rejects(() => service.criar(input), error => error instanceof AppError && error.statusCode === 400);
  }
  for (const id of ['1junk', '1.5', '0', '', null, true, 1.2, '2147483648']) {
    await assert.rejects(() => service.buscarPorId(id), error => error.statusCode === 400);
  }
  assert.equal(calls, 0);
});
test('cadastro não aceita identidade externa enviada pelo cliente; edição ativa proteção de curadoria', async () => {
  const writes = [];
  const service = load({ catalogoExercicio: {
    create: async ({ data }) => { writes.push(data); return data; },
    findUnique: async () => ({ id: 9, source: 'wger', externalId: '123', curated: false }),
    update: async ({ data }) => { writes.push(data); return data; },
  } });
  const created = await service.criar({ ...valid, source: 'wger', externalId: '123', curated: false });
  assert.equal(created.source, 'local'); assert.equal(created.curated, true);
  assert.equal(created.externalId, undefined); assert.equal(created.instrucoes, 'Controle & conforto');
  await service.atualizar('9', { ...valid, source: 'local', curated: false, ativo: false });
  assert.equal(writes[1].curated, true); assert.equal(writes[1].source, undefined); assert.equal(writes[1].ativo, undefined);
});
test('listagem consulta somente banco local e recusa filtros com formato inesperado', async () => {
  let where;
  const service = load({ catalogoExercicio: { findMany: async args => { where = args.where; return []; } } });
  await service.listar(); assert.equal(where.ativo, true);
  await service.listar({ ativo: false, grupoMuscular: 'Múltiplos' });
  assert.equal(where.ativo, false); assert.equal(where.grupo_muscular, 'Múltiplos');
  await assert.rejects(() => service.listar({ ativo: 'false' }), error => error.statusCode === 400);
  await assert.rejects(() => service.listar({ grupoMuscular: ['Peito'] }), error => error.statusCode === 400);
});
