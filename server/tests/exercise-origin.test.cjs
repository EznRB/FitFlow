const test = require('node:test');
const assert = require('node:assert/strict');
const { captureCatalogExercises } = require('../src/utils/exerciseOrigin');
const item = () => ({ id: 9, nome: 'Remada original', grupo_muscular: 'Costas', source: 'wger', externalId: '1027', locale: 'pt', curated: true,
  atualizado_em: new Date('2026-10-07T12:00:00Z'), instrucoes: 'Texto original', imagem_url: null,
  sourceMetadata: { text: { author: 'Autor original', license: { code: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } }, upstream: { text: { author: 'Atualização não utilizada' } } } });
function database(records = [item()], previous = []) {
  const queries = [];
  return { queries, catalogoExercicio: { findMany: async q => { queries.push(q); return records.filter(x => q.where.id.in.includes(x.id) && x.ativo !== false); } },
    exercise: { findMany: async q => previous.filter(x => x.workoutId === q.where.workoutId && q.where.id.in.includes(x.id)) } };
}
test('catálogo capturado do servidor separa prescrição adaptada, créditos utilizados e atualização externa', async () => {
  const record = item(), db = database([record]);
  const [result] = await captureCatalogExercises(db, [{ name: 'Remada adaptada', catalogExerciseId: 9, sourceExerciseId: null }]);
  assert.equal(result.name, 'Remada adaptada'); assert.equal(result.catalogExerciseId, 9);
  assert.equal(result.catalogSnapshot.originalName, 'Remada original');
  assert.equal(result.catalogSnapshot.sourceMetadata.text.author, 'Autor original');
  assert.equal(result.catalogSnapshot.sourceMetadata.upstream, undefined);
  assert.equal(result.sourceExerciseId, undefined);
  record.sourceMetadata.text.author = 'Alterado depois'; assert.equal(result.catalogSnapshot.sourceMetadata.text.author, 'Autor original');
});
test('manual e legado não ganham identidade pelo nome; catálogo ausente/inativo não vira manual', async () => {
  const db = database(); const [manual] = await captureCatalogExercises(db, [{ name: 'Remada original', catalogExerciseId: null }]);
  assert.equal(manual.catalogExerciseId, null); assert.equal(manual.catalogSnapshot, undefined); assert.equal(db.queries.length, 0);
  for (const records of [[], [{ ...item(), ativo: false }]]) await assert.rejects(
    captureCatalogExercises(database(records), [{ name: 'Remada', catalogExerciseId: 9 }]), e => e.statusCode === 400);
});
test('revisão preserva snapshot anterior mesmo após atualização ou desativação do catálogo', async () => {
  const [original] = await captureCatalogExercises(database(), [{ catalogExerciseId: 9 }]);
  const previous = { ...original, id: 11, workoutId: 5 };
  const db = database([], [previous]);
  const [revision] = await captureCatalogExercises(db, [{ name: 'Nova orientação', catalogExerciseId: 9, sourceExerciseId: 11 }], 5);
  assert.deepEqual(revision.catalogSnapshot, original.catalogSnapshot); assert.equal(db.queries.length, 0);
  assert.equal(revision.sourceExerciseId, undefined); assert.equal(revision.id, undefined);
});
test('referência à ficha anterior é verificada na transação e não copia exercício de outra autoria', async () => {
  const db = database([], [{ id: 11, workoutId: 6, catalogExerciseId: 9, catalogSnapshot: { version: 1 } }]);
  await assert.rejects(captureCatalogExercises(db, [{ catalogExerciseId: 9, sourceExerciseId: 11 }], 5), e => e.statusCode === 400);
  await assert.rejects(captureCatalogExercises(db, [{ catalogExerciseId: 9, sourceExerciseId: 11 }]), e => e.statusCode === 400);
});
test('mudança explícita de catálogo captura a nova origem, sem reutilizar créditos anteriores', async () => {
  const db = database([{ ...item(), id: 10, externalId: '2000' }], [{ id: 11, workoutId: 5, catalogExerciseId: 9, catalogSnapshot: { version: 1, originalName: 'Antigo' } }]);
  const [next] = await captureCatalogExercises(db, [{ catalogExerciseId: 10, sourceExerciseId: 11 }], 5);
  assert.equal(next.catalogSnapshot.catalogExerciseId, 10); assert.equal(next.catalogSnapshot.externalId, '2000');
});
