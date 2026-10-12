const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function browser(api = {}) {
  const nodes = new Map(), modals = [], messages = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { id, innerHTML: '', textContent: '', value: '', isConnected: true, disabled: false,
      classList: { add() {} }, querySelectorAll: () => [], querySelector: selector => node(selector.startsWith('#') ? selector.slice(1) : selector), reportValidity: () => true });
    return nodes.get(id);
  }
  const modal = { revision: 0, opened: false, isOpen() { return this.opened; }, open(title, html, buttons) {
    this.revision++; this.opened = true; modals.push({ title, html, buttons });
    for (const id of ['form-carga-aluno', 'aluno-carga-peso', 'aluno-carga-reps', 'aluno-carga-obs', 'aluno-carga-feedback']) { const old = nodes.get(id); if (old) old.isConnected = false; nodes.delete(id); }
    if (html.includes('form-carga-aluno')) {
      const form = node('form-carga-aluno'); for (const id of ['aluno-carga-peso', 'aluno-carga-reps', 'aluno-carga-obs', 'aluno-carga-feedback']) node(id);
      const owned = new Map([...nodes].filter(([id]) => id.startsWith('aluno-carga-')));
      form.querySelector = selector => owned.get(selector.replace(/^#/, '')) || null;
      form.querySelectorAll = () => [...owned.values()].filter(n => n.id !== 'aluno-carga-feedback');
    }
  }, close() { this.revision++; this.opened = false; const form = nodes.get('form-carga-aluno'); if (form) form.isConnected = false; nodes.delete('form-carga-aluno'); } };
  const context = vm.createContext({ window: {}, document: { getElementById: id => nodes.get(id) || null }, Auth: { generation: 1, sessionEpoch: 'session-a', getSessionEpoch() { return this.sessionEpoch; }, user: { id: 7, role: 'student' } }, API: api,
    Modal: modal, Toast: { success: text => messages.push(text), error: text => messages.push(text) }, App: { currentPage: 'aluno-treino', navigateTo() {} }, FitFlowScience: { summarizeLogs: () => ({ knownVolumeKg: 0, completeRecords: 0, incompleteRecords: 1 }) } });
  for (const name of ['security.js', 'aluno-painel.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', name), 'utf8'), context);
  vm.runInContext('this.ui = AlunoUI; this.panel = AlunoPainelView; this.workouts = AlunoTreinoView; this.monthly = AlunoMensalidadeView; this.checkins = AlunoCheckinView; this.history = AlunoHistoricoView;', context);
  return { context, node, nodes, modals, messages };
}
function openLoad(h, id = 3) { h.node('aluno-treino-container'); h.context.workouts.abrirRegistroCarga(id, `Exercício ${id}`); h.node('aluno-carga-peso').value = '20'; h.node('aluno-carga-reps').value = '8'; h.node('aluno-carga-obs').value = 'Nota'; return h.modals.at(-1); }
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
  const modal = openLoad(h); const form = h.node('form-carga-aluno'); h.node('aluno-carga-peso').value = '0'; h.node('aluno-carga-reps').value = '';
  const request = modal.buttons[1].action(); await modal.buttons[1].action();
  assert.equal(writes.length, 1); assert.equal(writes[0].body.weight, 0); assert.equal(writes[0].body.repsCompleted, null);
  h.nodes.delete('form-carga-aluno'); pending.resolve({}); await request;
  assert.equal(form.innerHTML, '');
});
test('registro avulso de sessão antiga não fecha modal ou atualiza página da nova conta', async () => {
  const pending = deferred(); let closes = 0, reads = 0, successes = 0;
  const h = browser({ get: async () => { reads++; }, post: () => pending.promise });
  h.context.Modal.close = () => { closes++; }; h.context.Toast.success = () => { successes++; };
  const modal = openLoad(h); const request = modal.buttons[1].action();
  h.context.Auth.user.id = 8; h.context.Auth.generation++;
  pending.resolve({}); await request;
  assert.equal(closes, 0); assert.equal(reads, 0); assert.equal(successes, 0);
});

test('vigência de hoje não aparece vencida; negativos e ausência têm rótulos distintos no painel e mensalidade', () => {
  for (const [remaining, expected] of [[0, 'Vence hoje'], [-1, 'Vencida'], [null, '—']]) {
    const h = browser(), data = panel('Aluno'); data.mensalidade.diasRestantes = remaining;
    h.context.panel.dados = data; const dashboard = h.node('aluno-painel-container'); h.context.panel.renderizar(dashboard);
    assert.ok(dashboard.innerHTML.includes(expected)); if (remaining === 0 || remaining === null) assert.ok(!dashboard.innerHTML.includes('Vencida'));
    const monthly = h.node('aluno-mensalidade-container'); h.context.monthly.renderizar(monthly, { diasRestantes: remaining, statusVisual: remaining === 0 ? 'vencendo' : 'indefinido', plano: null, historicoPagamentos: [] });
    assert.ok(monthly.innerHTML.includes(remaining === null ? 'Não informado' : expected)); if (remaining === 0 || remaining === null) assert.ok(!monthly.innerHTML.includes('Vencida'));
  }
});

test('ficha distingue carga zero, repetições ausentes e a data real do registro avulso', () => {
  const h = browser();
  const exercise = { id: 3, nome: 'Exercício', series: 2, reps: '8–12', descansoSegundos: 0,
    ultimaCarga: { peso: 0, reps: null, data: '2026-10-08T15:00:00.000Z' } };
  const html = h.context.workouts._renderExercicio(exercise, 0);
  assert.ok(html.includes('0 kg')); assert.ok(html.includes('repetições não informadas'));
  assert.ok(html.includes('08/10/2026')); assert.ok(html.includes('0 s'));
  for (const data of [null, 'inválida']) {
    exercise.ultimaCarga.data = data;
    assert.ok(h.context.workouts._renderExercicio(exercise, 0).includes('Data não informada'));
  }
  delete exercise.ultimaCarga;
  assert.ok(h.context.workouts._renderExercicio(exercise, 0).includes('Sem registro avulso'));
});

test('leitura do aluno não começa nem renderiza sob epoch de outra aba ou papel alterado', async () => {
  const pending = deferred(); let reads = 0;
  const h = browser({ get: () => { reads++; return pending.promise; } });
  h.context.Auth.sessionEpoch = 'original'; let shared = 'original';
  h.context.Auth.getSessionEpoch = () => shared;
  const container = h.node('aluno-painel-container');
  const request = h.context.panel.inicializar(); shared = 'outra-aba';
  pending.resolve({ data: panel('Obsoleta') }); await request;
  assert.ok(!container.innerHTML.includes('Olá, Obsoleta'));
  await h.context.panel.inicializar(); assert.equal(reads, 1);
  shared = 'original';
  const current = h.context.ui.capture(h.context.panel, container);
  h.context.Auth.user.role = 'admin'; assert.equal(current(), false);
});

test('ficha do aluno apresenta o snapshot de origem com créditos e mantém manual como desconhecido', () => {
  const h = browser(); h.context.FitFlowExerciseOrigin = require('../../client/js/exercise-origin');
  const exercise = { id: 3, nome: 'Nome adaptado', grupoMuscular: 'Peito', series: 2, reps: '8–12', catalogSnapshot: {
    version: 1, catalogExerciseId: 75, originalName: 'Nome da fonte', originalMuscleGroup: 'Peito', source: 'wger', locale: 'pt',
    sourceMetadata: { text: { author: 'Autor <teste>', license: { code: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } } }
  } };
  const html = h.context.workouts._renderExercicio(exercise, 0);
  assert.ok(html.includes('Nome da fonte')); assert.ok(html.includes('Autor &lt;teste&gt;'));
  assert.ok(html.includes('CC-BY-SA-4.0')); assert.ok(html.includes('Nome ou grupo adaptado'));
  delete exercise.catalogSnapshot;
  assert.ok(h.context.workouts._renderExercicio(exercise, 0).includes('Origem não registrada'));
});

test('callback antigo não grava valores do novo exercício nem cancela outro diálogo', async () => {
  const writes = [], h = browser({ post: async (url, body) => { writes.push(body); } });
  const old = openLoad(h, 3); openLoad(h, 4); h.node('aluno-carga-peso').value = '35';
  await old.buttons[1].action(); assert.equal(writes.length, 0);
  const revision = h.context.Modal.revision; old.buttons[0].action(); assert.equal(h.context.Modal.revision, revision); assert.equal(h.context.Modal.isOpen(), true);
});

test('cancelar antigo não fecha modal de outra tarefa', () => {
  const h = browser(); const old = openLoad(h); h.context.Modal.open('Outra tarefa', '<p>Outro conteúdo</p>', []);
  const revision = h.context.Modal.revision; old.buttons[0].action(); assert.equal(h.context.Modal.revision, revision); assert.equal(h.context.Modal.isOpen(), true);
});

test('envio de outro formulário não bloqueia novo exercício e resultado antigo não fecha o novo modal', async () => {
  const pending = deferred(), writes = [], h = browser({ post: (url, body) => { writes.push(body); return pending.promise; } });
  const old = openLoad(h, 3), first = old.buttons[1].action(); h.context.Modal.close();
  const next = openLoad(h, 4), second = next.buttons[1].action(); assert.equal(writes.length, 2); assert.equal(writes[1].exerciseId, 4);
  const revision = h.context.Modal.revision; pending.reject({ status: 400, message: 'Recusado' }); await Promise.all([first, second]);
  assert.equal(h.context.Modal.revision, revision); assert.equal(h.node('aluno-carga-feedback').textContent, 'Recusado');
});

test('submit do formulário compartilha salvamento com footer, impede navegação e duplo envio', async () => {
  const pending = deferred(), writes = [], h = browser({ post: (url, body, options) => { writes.push({ body, options }); return pending.promise; } });
  const modal = openLoad(h), form = h.node('form-carga-aluno'); let prevented = 0;
  assert.equal(typeof form.onsubmit, 'function'); assert.match(modal.html, /<button[^>]*type="submit"/);
  const first = form.onsubmit({ preventDefault() { prevented++; } }); await modal.buttons[1].action();
  assert.equal(prevented, 1); assert.equal(writes.length, 1); assert.equal(writes[0].options.timeoutMs, 15000);
  h.nodes.delete('form-carga-aluno'); pending.resolve({}); await first;
});

test('ACK preserva rascunho modificado e confirma somente payload capturado antes da espera', async () => {
  const pending = deferred(), writes = [], h = browser({ post: (url, body) => { writes.push(body); return pending.promise; } });
  const modal = openLoad(h), request = modal.buttons[1].action();
  h.node('aluno-carga-peso').value = '25'; h.node('aluno-carga-obs').value = 'Rascunho novo';
  const revision = h.context.Modal.revision; pending.resolve({}); await request;
  assert.equal(writes[0].weight, 20); assert.equal(writes[0].notes, 'Nota'); assert.equal(h.context.Modal.revision, revision);
  assert.equal(h.node('aluno-carga-peso').value, '25'); assert.equal(h.node('aluno-carga-obs').value, 'Rascunho novo');
  assert.match(h.node('aluno-carga-feedback').textContent, /salvo/i); assert.match(h.node('aluno-carga-feedback').textContent, /mantid/i);
});

test('epoch, geração, navegação e revisão modal invalidam ações e resultados antigos', async () => {
  for (const invalidate of [h => { h.context.Auth.generation++; }, h => { h.context.Auth.getSessionEpoch = () => 'remoto'; }, h => { h.context.App.currentPage = 'aluno-painel'; }, h => { h.context.Modal.revision++; }]) {
    const writes = [], pending = deferred(), h = browser({ post: (url, body) => { writes.push(body); return pending.promise; } });
    const modal = openLoad(h), request = modal.buttons[1].action(); invalidate(h); await modal.buttons[1].action();
    const revision = h.context.Modal.revision; pending.resolve({}); await request; assert.equal(writes.length, 1); assert.equal(h.context.Modal.revision, revision); assert.equal(h.messages.length, 0);
  }
});

test('timeout da escrita legada conserva valores e orienta conferir histórico; não há retry automático ou alegação idempotente', async () => {
  const writes = [], h = browser({ post: async (url, body, options) => { writes.push({ url, body, options }); throw Object.assign(new Error('Tempo esgotado'), { timeout: true, status: 0 }); } });
  const modal = openLoad(h), revision = h.context.Modal.revision; await modal.buttons[1].action();
  assert.equal(writes.length, 1); assert.equal(writes[0].options?.timeoutMs, 15000); assert.equal(writes[0].body.idempotencyKey, undefined);
  assert.equal(h.node('aluno-carga-peso').value, '20'); assert.equal(h.context.Modal.revision, revision);
  assert.match(h.node('aluno-carga-feedback').textContent, /histórico/i); assert.match(h.node('aluno-carga-feedback').textContent, /antes de repetir/i);
});

test('ACK do contexto abandonado não libera promise do novo registro nem fecha seu modal', async () => {
  const first = deferred(), second = deferred(), writes = [], h = browser({ post: (url, body) => { writes.push(body); return writes.length === 1 ? first.promise : second.promise; } });
  const old = openLoad(h, 3), oldRequest = old.buttons[1].action(); const next = openLoad(h, 4), nextRequest = next.buttons[1].action();
  const context = h.context.workouts.loadModal, pending = context.pending, revision = h.context.Modal.revision;
  first.resolve({}); await oldRequest; assert.equal(context.pending, pending); assert.equal(h.context.Modal.revision, revision); assert.equal(h.messages.length, 0);
  await next.buttons[1].action(); assert.equal(writes.length, 2);
  h.context.Modal.close(); second.resolve({}); await nextRequest; assert.equal(context.pending, null);
});

test('sucesso normal fecha só o próprio modal, recarrega ficha e valida formulário antes do envio', async () => {
  let reads = 0, writes = 0; const h = browser({ post: async () => { writes++; }, get: async () => { reads++; return { data: panel('Aluno') }; } });
  const modal = openLoad(h), form = h.node('form-carga-aluno'); form.reportValidity = () => false;
  await modal.buttons[1].action(); assert.equal(writes, 0); form.reportValidity = () => true;
  await modal.buttons[1].action(); assert.equal(writes, 1); assert.equal(reads, 1); assert.equal(h.context.Modal.isOpen(), false); assert.equal(h.messages[0], 'Registro avulso salvo.');
});

