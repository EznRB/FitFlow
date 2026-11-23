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

for (const [label, change] of [
  ['editor', async h => { await h.open(); }],
  ['aluno', h => { h.view.currentStudentId = 12; }],
  ['identidade', h => { h.Auth.user = { id: 8, role: 'instructor' }; }],
  ['perfil', h => { h.Auth.user.role = 'admin'; }],
  ['geração da autenticação', h => { h.Auth.generation++; }],
  ['geração da view', h => { h.view.generation++; }],
  ['epoch em memória', h => { h.Auth.sessionEpoch = 'second'; }],
  ['epoch no storage', h => { h.Auth.storedEpoch = 'second'; }]
]) {
  for (const outcome of ['resolve', 'reject']) {
    test(`Conferir fichas pendente ignora ${outcome} após trocar ${label}`, async () => {
      const h = context.harness(), first = await h.open();
      const saving = first.save();
      h.requests[0].reject(Object.assign(new Error('timeout'), { timeout: true }));
      await saving;

      const get = h.API.get, reads = [];
      let settle;
      h.API.get = (url, options) => {
        if (url === '/treinos/catalogo') return get(url, options);
        reads.push([url, options]);
        return new Promise((resolve, reject) => { settle = { resolve, reject }; });
      };
      const checking = h.node('treino-check-saved').onclick();
      assert.equal(reads.length, 1);
      assert.equal(reads[0][0], '/treinos?studentId=11');
      assert.equal(reads[0][1].timeoutMs, 15000);
      assert.equal(h.view.editor.checking, true);
      await change(h);

      // Snapshot the live destination after the context change. The production
      // handler must neither publish its old list nor mutate this draft in finally.
      const editor = h.view.editor;
      h.node('treino-nome').value = 'Rascunho preservado';
      h.node('exercicios-container').rows[0].querySelector('.ex-reps').value = '10-15';
      h.node('treinos-table-body').innerHTML = 'Lista do contexto atual';
      const snapshot = () => JSON.stringify({
        draft: h.view.rascunhoTreino(editor), feedback: editor.feedback.textContent,
        button: [editor.button.textContent, editor.button.disabled],
        check: [editor.check.textContent, editor.check.disabled, editor.check.hidden],
        busy: editor.form.getAttribute('aria-busy'),
        table: h.node('treinos-table-body').innerHTML,
        revision: h.Modal.revision, opened: h.Modal.opened, closes: h.Modal.closes,
        reloads: h.context.reloads, writes: h.requests.length, notices: h.notices
      });
      const before = snapshot();
      let renders = 0;
      const render = h.view.renderizarTabela;
      h.view.renderizarTabela = function (...args) { renders++; return render.apply(this, args); };
      if (outcome === 'resolve') settle.resolve({ data: [{ id: 99, name: 'Ficha da consulta antiga' }] });
      else settle.reject(new Error('Falha da consulta antiga'));
      await checking;

      assert.equal(h.view.editor, editor);
      assert.equal(snapshot(), before);
      assert.equal(renders, 0);
      assert.equal(reads.length, 1);
    });
  }
}
