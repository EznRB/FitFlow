const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

const license = { id: 2, short_name: 'CC-BY-SA 4', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en' };
const exercise = (id, extra = {}) => ({ id, category: { id: 10, name: 'Abs' },
  muscles: [{ id: 11, name: 'Biceps femoris' }, { id: 8, name: 'Gluteus maximus' }],
  muscles_secondary: [{ id: 6, name: 'Rectus abdominis' }], equipment: [{ id: 10, name: 'Kettlebell' }],
  license, license_author: 'Autor base', images: [],
  translations: [{ id: id + 100, language: 2, name: 'Swing', description: '<p>Use <b>controle</b>.</p>', license: 2, license_author: 'Autor texto' }], ...extra });

function load() {
  const module = { exports: {} };
  const file = path.join(__dirname, '../src/services/wger.service.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'),
    { module, exports: module.exports, require: (id) => id === '../config/prisma' ? { prisma: {} } :
        id === '@prisma/client' ? { PrismaClient: class {} } : createRequire(file)(id),
      fetch, AbortController, URL, setTimeout, clearTimeout, console });
  return module.exports;
}
function setup(pages) {
  const rows = new Map(); const calls = [];
  const db = { catalogoExercicio: {
    findUnique: async ({ where }) => rows.get(where.source_externalId.externalId) || null,
    upsert: async ({ where, create, update }) => {
      const key = where.source_externalId.externalId;
      const row = rows.has(key) ? { ...rows.get(key), ...update } : { ...create, id: rows.size + 1 };
      rows.set(key, row); return row;
    },
    updateMany: async ({ where, data }) => {
      const row = rows.get(where.externalId);
      if (row && row.curated === where.curated) Object.assign(row, data);
    },
  } };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/license/')) return { ok: true, json: async () => ({ results: [license], next: null }) };
    const item = pages.shift(); if (item instanceof Error) throw item;
    return { ok: true, json: async () => item };
  };
  return { rows, calls, db, fetchImpl, service: load().createWgerService({ prisma: db, fetchImpl }) };
}

test('segue next, mantém identidade externa e usa músculos explícitos sem adivinhar pelo nome/categoria', async () => {
  const s = setup([{ results: [exercise(9)], next: 'https://wger.de/api/v2/exerciseinfo/?limit=1&offset=1' },
    { results: [exercise(10)], next: null }]);
  const r = await s.service.sincronizar(1);
  assert.equal(r.inseridos, 2); assert.equal(r.completa, true);
  assert.equal(s.rows.size, 2); assert.equal(s.rows.get('9').grupo_muscular, 'Múltiplos');
  assert.equal(s.rows.get('9').locale, 'en'); assert.equal(s.rows.get('9').nome, 'Swing');
  assert.equal(s.rows.get('9').instrucoes, 'Use controle.');
  assert.deepEqual(Array.from(s.rows.get('9').sourceMetadata.primaryMuscles, x => x.id), [11, 8]);
  assert.equal(s.rows.get('9').sourceMetadata.text.license.code, 'CC-BY-SA-4.0');
});
test('sync repetido não duplica e conserva curadoria e desativação locais', async () => {
  const s = setup([{ results: [exercise(9)], next: null }, { results: [exercise(9, { translations: [
    { language: 7, name: 'Swing em português', description: 'Nova instrução', license: 2, license_author: 'Ana' } ] })], next: null }]);
  await s.service.sincronizar();
  Object.assign(s.rows.get('9'), { nome: 'Nome curado', instrucoes: 'Nota do professor', curated: true, ativo: false });
  const r = await s.service.sincronizar();
  assert.equal(r.atualizados, 1); assert.equal(s.rows.size, 1);
  assert.equal(s.rows.get('9').nome, 'Nome curado'); assert.equal(s.rows.get('9').locale, 'en');
  assert.equal(s.rows.get('9').instrucoes, 'Nota do professor'); assert.equal(s.rows.get('9').ativo, false);
  assert.equal(s.rows.get('9').sourceMetadata.text.locale, 'en');
  assert.equal(s.rows.get('9').sourceMetadata.upstream.text.locale, 'pt');
});
test('exclui licença desconhecida, tradução sem autoria e mídia sem HTTPS/autoria; prefere PT', async () => {
  const s = setup([{ results: [exercise(1, { license: { id: 99, url: 'https://example.com/license' } }),
    exercise(2, { translations: [{ language: 2, name: 'Sem autoria', license: 2 }] }),
    exercise(3, { translations: [{ language: 7, name: 'Nome PT', description: '<script>alert(1)</script><p>Texto &amp; válido</p>', license: 2, license_author: 'Ana' }],
      images: [{ id: 1, image: 'http://wger.de/a.png', license: 2, license_author: 'Ana' },
        { id: 2, image: 'https://wger.de/b.png', license: 2 },
        { id: 3, image: 'https://wger.de/c.png', license: 2, license_author: 'Ana' }] })], next: null }]);
  const r = await s.service.sincronizar(); assert.equal(r.inseridos, 1); assert.equal(r.ignorados, 2);
  const row = s.rows.get('3'); assert.equal(row.locale, 'pt'); assert.equal(row.nome, 'Nome PT');
  assert.equal(row.instrucoes, 'Texto & válido'); assert.equal(row.imagem_url, 'https://wger.de/c.png');
  assert.equal(row.sourceMetadata.media.length, 1); assert.equal(row.sourceMetadata.media[0].author, 'Ana');
});
test('rejeita paginação externa, ciclos e formato inválido sem requisitar destinos inseguros', async () => {
  for (const next of ['http://wger.de/api/v2/exerciseinfo/', 'https://evil.test/api/v2/exerciseinfo/',
    'https://wger.de/api/v2/exerciseinfo/?limit=100&ordering=id']) {
    const s = setup([{ results: [], next }]);
    const r = await s.service.sincronizar(); assert.equal(r.completa, false); assert.equal(r.indisponivel, true);
    assert.equal(s.calls.length, 2);
  }
  const s = setup([{ results: 'inválido', next: null }]);
  assert.equal((await s.service.sincronizar()).completa, false);
  const emptyNext = setup([{ results: [], next: '' }]);
  assert.equal((await emptyNext.service.sincronizar()).completa, false);
});
test('timeout/erro externo retorna estado parcial e preserva dados já sincronizados', async () => {
  const s = setup([{ results: [exercise(9)], next: 'https://wger.de/api/v2/exerciseinfo/?offset=1' }, new Error('rede')]);
  const r = await s.service.sincronizar(); assert.equal(r.inseridos, 1); assert.equal(r.completa, false);
  assert.equal(s.rows.size, 1); assert.ok(s.calls.every(c => c.options.signal && c.options.redirect === 'error'));
});
test('erros de banco não são tratados como indisponibilidade externa', async () => {
  const s = setup([{ results: [exercise(9)], next: null }]);
  const service = load().createWgerService({ prisma: { catalogoExercicio: {
    findUnique: async () => { throw new Error('banco indisponível'); } } },
    fetchImpl: async (url) => ({ ok: true, json: async () => url.includes('/license/') ? { results: [license], next: null } : { results: [exercise(9)], next: null } }) });
  await assert.rejects(() => service.sincronizar(), /banco/);
});
test('timeout aborta request e libera nova tentativa sem alterar registros locais', async () => {
  let aborted = false;
  const service = load().createWgerService({ prisma: {}, timeoutMs: 5,
    fetchImpl: async (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => {
      aborted = true; reject(new Error('abortado'));
    })) });
  const result = await service.sincronizar();
  assert.equal(aborted, true); assert.equal(result.indisponivel, true); assert.equal(result.inseridos, 0);
  assert.equal((await service.sincronizar()).completa, false);
});
test('atualiza somente descrição não curada e conserva edição feita durante sync', async () => {
  const s = setup([{ results: [exercise(9)], next: null }, { results: [exercise(9, { translations: [
    { language: 7, name: 'Nome atualizado PT', description: 'Nova descrição', license: 2, license_author: 'Ana' } ] })], next: null }]);
  await s.service.sincronizar(); await s.service.sincronizar();
  assert.equal(s.rows.get('9').nome, 'Nome atualizado PT'); assert.equal(s.rows.get('9').locale, 'pt');
  const originalUpsert = s.db.catalogoExercicio.upsert;
  s.db.catalogoExercicio.upsert = async args => {
    const row = await originalUpsert(args); Object.assign(row, { curated: true, nome: 'Edição concorrente' }); return row;
  };
  const concurrent = load().createWgerService({ prisma: s.db, fetchImpl: async url => ({ ok: true,
    json: async () => url.includes('/license/') ? { results: [license], next: null } : { results: [exercise(9)], next: null } }) });
  await concurrent.sincronizar(); assert.equal(s.rows.get('9').nome, 'Edição concorrente');
});
test('protege limites de páginas/registros e ignora identidade repetida em páginas', async () => {
  const s = setup([{ results: [exercise(9)], next: 'https://wger.de/api/v2/exerciseinfo/?offset=1' },
    { results: [exercise(9), exercise(10)], next: null }]);
  const result = await s.service.sincronizar(); assert.equal(result.inseridos, 2); assert.equal(result.ignorados, 1);
  const service = load().createWgerService({ prisma: {}, maxPages: 1,
    fetchImpl: async url => ({ ok: true, json: async () => url.includes('/license/') ? { results: [license], next: null } :
      { results: [], next: 'https://wger.de/api/v2/exerciseinfo/?offset=1' } }) });
  assert.equal((await service.sincronizar()).completa, false);
  const bounded = setup([{ results: [exercise(9), exercise(10)], next: null }]);
  const boundedService = load().createWgerService({ prisma: bounded.db, fetchImpl: bounded.fetchImpl, maxRecords: 1 });
  const partial = await boundedService.sincronizar();
  assert.equal(partial.completa, false); assert.equal(partial.inseridos, 1); assert.equal(bounded.rows.size, 1);
});
