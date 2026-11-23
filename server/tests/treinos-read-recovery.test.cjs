const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'treinos-submit-state.test.cjs'), 'utf8').split("\ntest(")[0];
const context = { require, __dirname, URL };
vm.runInNewContext(source + '\nglobalThis.harness = harness;', context);

test('catalog read has a deadline and malformed data falls back with a warning', async () => {
  const h = context.harness(), reads = [];
  h.API.get = async (url, options) => { reads.push([url, options]); return { data: {} }; };
  await h.open();
  assert.equal(reads[0][1]?.timeoutMs, 15000);
  assert.equal(h.view.catalogoCache.length, 0);
  assert.ok(h.notices.some(([type]) => type === 'warning'));
  assert.ok(h.view.editor);
});

test('incomplete detail never opens an editable revision', async () => {
  const h = context.harness();
  h.API.get = async () => ({ data: { id: 20, name: 'Incomplete' } });
  await h.view.abrirModalEditar(20);
  assert.equal(h.Modal.opened, false);
  assert.ok(h.notices.some(([type]) => type === 'error'));
});

test('detail preserves missing metadata by refusing the incomplete response', async () => {
  const h = context.harness();
  h.API.get = async () => ({ data: { id: 20, name: 'Incomplete', exercises: [] } });
  await h.view.abrirModalEditar(20);
  assert.equal(h.Modal.opened, false);
});

test('malformed list cannot be reported as a successful check', async () => {
  const h = context.harness(), editor = await h.open();
  const saving = editor.save();
  h.requests[0].reject(Object.assign(new Error('timeout'), { timeout: true }));
  await saving;
  h.API.get = async () => ({ data: {} });
  await h.node('treino-check-saved').onclick();
  assert.equal(h.Modal.closes, 0);
  assert.match(editor.feedback.textContent, /Não foi possível/);
  assert.doesNotMatch(editor.feedback.textContent, /Consulta concluída/);
});

test('malformed prescription types never open the revision editor', async () => {
  const h = context.harness();
  h.API.get = async () => ({ data: { id: 20, name: 'Ficha', description: null, notes: null,
    exercises: [{ id: 1, name: 'Remada', sets: {}, reps: [], restSeconds: false }] } });
  await h.view.abrirModalEditar(20);
  assert.equal(h.Modal.opened, false);
});

test('complete prescription remains available and partial optional fields prevent editing', async () => {
  const h = context.harness();
  const exercise = { id: 1, name: 'Remada', sets: 3, reps: '8-12', restSeconds: 60,
    muscleGroup: 'Costas', suggestedLoad: '10 kg', notes: 'Preservar observação' };
  const workout = { id: 20, name: 'Ficha', description: null, notes: null, exercises: [exercise] };
  assert.equal(h.view.detalheLido({ data: workout }, 20).exercises[0], exercise);
  for (const key of ['muscleGroup', 'suggestedLoad', 'notes']) {
    const partial = { ...exercise }; delete partial[key];
    h.API.get = async () => ({ data: { ...workout, exercises: [partial] } });
    await h.view.abrirModalEditar(20);
    assert.equal(h.Modal.opened, false);
  }
});

test('checking identifies returned sheets and labels the pending read accurately', async () => {
  const h = context.harness(), editor = await h.open();
  const saving = editor.save(); h.requests[0].reject(new Error('offline')); await saving;
  let resolve;
  h.API.get = () => new Promise(done => { resolve = done; });
  const checking = h.node('treino-check-saved').onclick();
  assert.match(editor.button.textContent, /Consultando fichas/);
  assert.equal(h.node('treino-check-saved').disabled, true);
  resolve({ data: [{ id: 24, name: '<Ficha A>' }] }); await checking;
  assert.match(editor.feedback.textContent, /#24.*<Ficha A>/);
  assert.equal(h.node('treino-check-saved').disabled, false);
  assert.equal(h.Modal.closes, 0);
});

test('checking uncertain save preserves draft on read failure and on a valid result', async () => {
  const h = context.harness(), editor = await h.open();
  const saving = editor.save();
  h.requests[0].reject(Object.assign(new Error('timeout'), { timeout: true }));
  await saving;
  let options;
  h.API.get = async (url, opts) => { options = opts; throw new Error('offline'); };
  await h.node('treino-check-saved').onclick();
  assert.equal(options.timeoutMs, 15000);
  assert.equal(h.Modal.closes, 0);
  assert.equal(h.node('treino-nome').value, 'Ficha A');
  assert.match(editor.feedback.textContent, /offline/);
  h.API.get = async () => ({ data: [] });
  await h.node('treino-check-saved').onclick();
  assert.equal(h.Modal.closes, 0);
  assert.equal(editor.button.disabled, true);
  assert.equal(h.requests.length, 1);
  assert.match(editor.feedback.textContent, /0/);
});
