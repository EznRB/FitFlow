const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function browser(api = {}) {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { id, innerHTML: '', textContent: '', value: '', isConnected: true, disabled: false,
      classList: { add() {} }, querySelectorAll: () => [], querySelector: selector => node(selector.startsWith('#') ? selector.slice(1) : selector), reportValidity: () => true });
    return nodes.get(id);
  }
  const context = vm.createContext({ window: {}, document: { getElementById: id => nodes.get(id) || null }, Auth: { generation: 1, user: { id: 7, role: 'student' } }, API: api,
    Modal: { open() {}, close() {} }, Toast: { success() {}, error() {} }, App: { navigateTo() {} }, FitFlowScience: { summarizeLogs: () => ({ knownVolumeKg: 0, completeRecords: 0, incompleteRecords: 1 }) } });
  for (const name of ['security.js', 'aluno-painel.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', name), 'utf8'), context);
  vm.runInContext('this.ui = AlunoUI; this.panel = AlunoPainelView; this.workouts = AlunoTreinoView; this.monthly = AlunoMensalidadeView; this.checkins = AlunoCheckinView; this.history = AlunoHistoricoView;', context);
  return { context, node, nodes };
}
function panel(name) { return { perfil: { nome: name, status: 'active' }, mensalidade: { diasRestantes: null }, treinos: [], checkins: { totalMes: 0, recentes: [] }, alertas: [] }; }
test('resposta de outra conta, mesmo com retorno à conta original, não renderiza dados', async () => {
  const pending = deferred(); const h = browser({ get: () => pending.promise });
  const container = h.node('aluno-painel-container'); const request = h.context.panel.inicializar();
  h.context.Auth.generation += 2;
  pending.resolve({ data: panel('Resposta de sessão encerrada') }); await request;
  assert.ok(!container.innerHTML.includes('Resposta de sessão encerrada'));
});
test('navegação invalida resposta e atualização mais recente vence no mesmo container', async () => {
  const pending = deferred(); let calls = 0;
  const h = browser({ get: () => ++calls === 1 ? pending.promise : Promise.resolve({ data: panel('Atual') }) });
  const container = h.node('aluno-painel-container'); const old = h.context.panel.inicializar();
  await h.context.panel.inicializar(); pending.resolve({ data: panel('Antigo') }); await old;
  assert.ok(container.innerHTML.includes('Olá, Atual')); assert.ok(!container.innerHTML.includes('Olá, Antigo'));
  const other = deferred(); h.context.API.get = () => other.promise;
  const leave = h.context.panel.inicializar(); container.isConnected = false;
  other.resolve({ data: panel('Página removida') }); await leave;
  assert.ok(!container.innerHTML.includes('Página removida'));
});
test('falha é explícita, escapada e fornece ação real para repetir', async () => {
  let calls = 0; const h = browser({ get: async () => { if (++calls === 1) throw new Error('<img src=x onerror=alert(1)>'); return { data: panel('Recuperado') }; } });
  const container = h.node('aluno-painel-container'); await h.context.panel.inicializar();
  assert.ok(container.innerHTML.includes('role="alert"')); assert.ok(container.innerHTML.includes('&lt;img')); assert.ok(!container.innerHTML.includes('<img'));
  await h.node('[data-retry]').onclick(); assert.equal(calls, 2); assert.ok(container.innerHTML.includes('Recuperado'));
});
test('plano e pagamentos não injetam HTML, decimais têm moeda e zero não vira dado ausente', () => {
  const h = browser(); const container = h.node('aluno-mensalidade-container'); const evil = '"><img src=x onerror=alert(1)>';
  h.context.monthly.renderizar(container, { statusVisual: '__proto__', diasRestantes: null, plano: { nome: evil, preco: '129.90' }, historicoPagamentos: [{ valor: '0.00', plano: evil, metodo: evil, status: evil }] });
  assert.ok(!container.innerHTML.includes('<img')); assert.ok(!container.innerHTML.includes('onclick='));
  assert.ok(container.innerHTML.includes('129,90')); assert.ok(container.innerHTML.includes('0,00')); assert.ok(container.innerHTML.includes('Situação não informada'));
  for (const value of [null, undefined, true, {}, [], '', ' ', Infinity]) assert.equal(h.context.ui.money(value), '—');
  assert.equal(h.context.ui.number(0), '0'); assert.equal(h.context.ui.date('2026-10-08T00:00:00.000Z', undefined, true), '08/10/2026');
});
test('abrir presença é somente leitura e resposta de painel antigo não dispara segunda consulta', async () => {
  const pending = deferred(); let gets = 0, posts = 0;
  const h = browser({ get: () => { gets++; return pending.promise; }, post: async () => { posts++; } });
  h.node('aluno-checkin-container'); const request = h.context.checkins.inicializar();
  h.context.Auth.user = { id: 8, role: 'student' }; h.context.Auth.generation++;
  pending.resolve({ data: panel('Conta antiga') }); await request;
  assert.equal(gets, 1); assert.equal(posts, 0);
});
test('duplo clique de presença envia uma gravação e conflito cancelado mantém aviso sem sucesso', async () => {
  const pending = deferred(); let posts = 0;
  const h = browser({ post: () => { posts++; return pending.promise; } });
  const container = h.node('aluno-checkin-container'); h.node('btn-aluno-checkin'); h.node('checkin-feedback');
  h.context.checkins.container = container;
  const request = h.context.checkins.fazerCheckin(); await h.context.checkins.fazerCheckin();
  pending.reject({ status: 409, message: 'Presença cancelada pela administração.' }); await request;
  assert.equal(posts, 1); assert.equal(h.node('btn-aluno-checkin').disabled, true);
  assert.equal(h.node('checkin-feedback').textContent, 'Presença cancelada pela administração.');
});
test('resultado de check-in não recarrega página de nova conta ou mostra seu sucesso', async () => {
  const pending = deferred(); let reads = 0;
  const h = browser({ get: async () => { reads++; }, post: () => pending.promise });
  const container = h.node('aluno-checkin-container'); h.context.checkins.container = container; h.node('btn-aluno-checkin'); h.node('checkin-feedback');
  const request = h.context.checkins.fazerCheckin(); h.context.Auth.generation++; h.context.Auth.user.id = 8;
  pending.resolve({}); await request; assert.equal(reads, 0); assert.equal(h.node('checkin-feedback').textContent, '');
});
test('registro avulso admite zero de carga externa, mantém repetições ausentes e evita duplo envio', async () => {
  const pending = deferred(); const writes = [];
  const h = browser({ post: (url, body) => { writes.push({ url, body }); return pending.promise; } });
  h.node('aluno-treino-container'); const form = h.node('form-carga-aluno'); h.node('aluno-carga-peso').value = '0'; h.node('aluno-carga-reps'); h.node('aluno-carga-obs'); h.node('aluno-carga-feedback');
  h.context.workouts.modalCurrent = () => true;
  const request = h.context.workouts.salvarCarga(3); await h.context.workouts.salvarCarga(3);
  assert.equal(writes.length, 1); assert.equal(writes[0].body.weight, 0); assert.equal(writes[0].body.repsCompleted, null);
  h.nodes.delete('form-carga-aluno'); pending.resolve({}); await request;
  assert.equal(form.innerHTML, '');
});
test('registro avulso de sessão antiga não fecha modal ou atualiza página da nova conta', async () => {
  const pending = deferred(); let closes = 0, reads = 0, successes = 0;
  const h = browser({ get: async () => { reads++; }, post: () => pending.promise });
  h.context.Modal.close = () => { closes++; }; h.context.Toast.success = () => { successes++; };
  h.node('aluno-treino-container'); h.context.workouts.abrirRegistroCarga(3, 'Exercício');
  h.node('form-carga-aluno'); h.node('aluno-carga-peso').value = '20'; h.node('aluno-carga-reps').value = '10'; h.node('aluno-carga-obs'); h.node('aluno-carga-feedback');
  const request = h.context.workouts.salvarCarga(3);
  h.context.Auth.user.id = 8; h.context.Auth.generation++;
  pending.resolve({}); await request;
  assert.equal(closes, 0); assert.equal(reads, 0); assert.equal(successes, 0);
});

