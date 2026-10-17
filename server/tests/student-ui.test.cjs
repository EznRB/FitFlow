const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function browser(api = {}) {
  const nodes = new Map(), modals = [], messages = [], listeners = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { id, innerHTML: '', textContent: '', value: '', isConnected: true, disabled: false,
      classList: { add() {} }, querySelectorAll: () => [], querySelector: selector => node(selector.startsWith('#') ? selector.slice(1) : selector), reportValidity: () => true });
    return nodes.get(id);
  }
  const modal = { revision: 0, opened: false, isOpen() { return this.opened; }, open(title, html, buttons) {
    this.revision++; this.opened = true; modals.push({ title, html, buttons });
    for (const id of [...nodes.keys()].filter(id => id === 'form-carga-aluno' || id.startsWith('aluno-carga-'))) { const old = nodes.get(id); if (old) old.isConnected = false; nodes.delete(id); }
    if (html.includes('form-carga-aluno')) {
      const form = node('form-carga-aluno'); for (const match of html.matchAll(/id="(aluno-carga-[^"]+)"/g)) node(match[1]);
      const owned = new Map([...nodes].filter(([id]) => id.startsWith('aluno-carga-')));
      form.querySelector = selector => owned.get(selector.replace(/^#/, '')) || null;
      form.querySelectorAll = () => [...owned.values()].filter(n => n.id !== 'aluno-carga-feedback');
    }
  }, close() { this.revision++; this.opened = false; const form = nodes.get('form-carga-aluno'); if (form) form.isConnected = false; nodes.delete('form-carga-aluno'); } };
  const context = vm.createContext({ window: { addEventListener: (name, action) => listeners.set(name, action) }, document: { getElementById: id => nodes.get(id) || null }, Auth: { generation: 1, sessionEpoch: 'session-a', getSessionEpoch() { return this.sessionEpoch; }, user: { id: 7, role: 'student' } }, API: api,
    Modal: modal, Toast: { success: text => messages.push(text), error: text => messages.push(text) }, App: { currentPage: 'aluno-treino', navigateTo() {} }, FitFlowScience: { summarizeLogs: () => ({ knownVolumeKg: 0, completeRecords: 0, incompleteRecords: 1 }) } });
  for (const name of ['security.js', 'aluno-painel.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', name), 'utf8'), context);
  vm.runInContext('this.ui = AlunoUI; this.panel = AlunoPainelView; this.workouts = AlunoTreinoView; this.monthly = AlunoMensalidadeView; this.checkins = AlunoCheckinView; this.history = AlunoHistoricoView;', context);
  return { context, node, nodes, modals, messages, listeners };
}
function openLoad(h, id = 3) { h.node('aluno-treino-container'); h.context.workouts.abrirRegistroCarga(id, `Exercício ${id}`); h.node('aluno-carga-peso').value = '20'; h.node('aluno-carga-reps').value = '8'; h.node('aluno-carga-obs').value = 'Nota'; return h.modals.at(-1); }
function panel(name) { return { perfil: { id: 17, nome: name, status: 'active' }, mensalidade: { diasRestantes: null }, treinos: [], checkins: { totalMes: 0, recentes: [] }, alertas: [] }; }
function renderCheckins(h, data = { total: 0, totalMes: 0, checkins: [] }) {
  const container = h.node('aluno-checkin-container');
  h.context.checkins.renderizar(container, data); return container;
}
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
  renderCheckins(h);
  const request = h.context.checkins.fazerCheckin(); await h.context.checkins.fazerCheckin();
  pending.reject({ status: 409, message: 'Presença cancelada pela administração.' }); await request;
  assert.equal(posts, 1); assert.equal(h.node('btn-aluno-checkin').disabled, true);
  assert.equal(h.node('checkin-feedback').textContent, 'Presença cancelada pela administração.');
});
test('resultado de check-in não recarrega página de nova conta ou mostra seu sucesso', async () => {
  const pending = deferred(); let reads = 0;
  const h = browser({ get: async () => { reads++; }, post: () => pending.promise });
  renderCheckins(h);
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

test('resultado incerto do avulso bloqueia repetição inclusive após fechar, navegar e reabrir', async () => {
  let writes = 0;
  const h = browser({ post: async () => { writes++; throw { timeout: true }; } });
  let modal = openLoad(h); await modal.buttons[1].action(); await modal.buttons[1].action();
  assert.equal(writes, 1);
  h.node('aluno-carga-peso').value = '27'; h.node('aluno-carga-peso').oninput();
  h.context.Modal.close(); h.context.App.currentPage = 'aluno-painel'; h.context.App.currentPage = 'aluno-treino';
  h.context.workouts.abrirRegistroCarga(3, 'Exercício 3'); modal = h.modals.at(-1);
  assert.equal(h.node('aluno-carga-peso').value, '27');
  await modal.buttons[1].action(); assert.equal(writes, 1);
  assert.match(h.node('aluno-carga-feedback').textContent, /não confirmado/i);
});

test('avulso libera repetição somente após consultar histórico e confirmar revisão explícita', async () => {
  let writes = 0, reads = 0;
  const h = browser({ post: async () => { writes++; throw { timeout: true }; }, get: async (url, options) => {
    reads++; assert.equal(url, '/aluno/historico-carga?exerciseId=3'); assert.equal(options.timeoutMs, 15000);
    return { data: [{ exercicioId: 3, exercicioNome: '<img>', registros: [{ peso: 20, reps: 8, data: '2026-10-17' }] }] };
  } });
  const modal = openLoad(h); await modal.buttons[1].action();
  const context = h.context.workouts.loadModal;
  await h.context.workouts.confirmarRevisaoCarga(context); await modal.buttons[1].action(); assert.equal(writes, 1);
  await h.context.workouts.consultarRegistroCarga(context); assert.equal(reads, 1);
  assert.ok(h.node('aluno-carga-review').innerHTML.includes('&lt;img&gt;'));
  await modal.buttons[1].action(); assert.equal(writes, 1);
  await h.context.workouts.confirmarRevisaoCarga(context); await modal.buttons[1].action(); assert.equal(writes, 2);
});

test('consulta falha ou obsoleta não libera avulso; logout limpa rascunho e não deixa callback antigo alterar nova conta', async () => {
  const read = deferred(); let writes = 0;
  const h = browser({ post: async () => { writes++; throw { timeout: true }; }, get: () => read.promise });
  let modal = openLoad(h); await modal.buttons[1].action(); const old = h.context.workouts.loadModal;
  const consultation = h.context.workouts.consultarRegistroCarga(old);
  h.context.Auth.user = null; h.context.Auth.generation++; h.listeners.get('auth:logout')({ detail: { reason: 'explicit' } });
  assert.equal(h.node('aluno-carga-peso').value, '');
  h.context.Auth.user = { id: 8, role: 'student' }; h.context.Auth.sessionEpoch = 'new';
  h.context.workouts.abrirRegistroCarga(3, 'Outra conta'); modal = h.modals.at(-1);
  assert.equal(h.node('aluno-carga-peso').value, '');
  read.resolve({ data: [] }); await consultation; h.context.workouts.confirmarRevisaoCarga(old);
  assert.equal(h.node('aluno-carga-feedback').textContent, ''); assert.equal(writes, 1);
});

test('leituras do aluno e presença têm prazo; timeout de leitura oferece recuperação', async () => {
  const calls = [], h = browser({ get: async (url, options) => { calls.push({ url, options }); throw { timeout: true, message: 'Consulta demorou.' }; } });
  const container = h.node('aluno-painel-container'); await h.context.panel.inicializar();
  assert.equal(calls[0].options?.timeoutMs, 15000); assert.match(container.innerHTML, /Tentar novamente/);
  h.node('aluno-checkin-container'); await h.context.checkins.inicializar();
  assert.equal(calls[1].options?.timeoutMs, 15000);
});

test('presença incerta bloqueia repetição e mantém estado ao reabrir até consulta e revisão', async () => {
  let writes = 0, reads = 0;
  const h = browser({ post: async (url, payload, options) => { writes++; assert.equal(options?.timeoutMs, 15000); throw { timeout: true, message: 'Tempo esgotado' }; }, get: async (url, options) => {
    reads++; assert.equal(options?.timeoutMs, 15000);
    return { data: url === '/aluno/painel' ? panel('Aluno') : { total: 1, totalMes: 1, checkins: [{ id: 1, data: '2026-10-17', status: 'present' }] } };
  } });
  renderCheckins(h); await h.context.checkins.fazerCheckin(); await h.context.checkins.fazerCheckin();
  assert.equal(writes, 1); assert.match(h.node('checkin-feedback').textContent, /não confirmado/i);
  await h.context.checkins.inicializar(); await h.context.checkins.fazerCheckin(); assert.equal(writes, 1); assert.equal(reads, 2);
  h.context.checkins.confirmarRevisao(); await h.context.checkins.fazerCheckin(); assert.equal(writes, 2);
});

test('histórico apresenta contagens e expansão acessível para todos os registros retornados, usando a mesma base do resumo', () => {
  const h = browser(); const records = Array.from({ length: 12 }, (_, n) => ({ peso: n + 1, reps: 8, data: '2026-10-17' }));
  let summarized; h.context.FitFlowScience.summarizeLogs = value => { summarized = value; return { knownVolumeKg: 624, completeRecords: 12, incompleteRecords: 0 }; };
  const container = h.node('aluno-historico-container'); h.context.history.renderizar(container, [{ exercicioNome: 'Remada', registros: records }]);
  assert.equal(summarized, records); assert.match(container.innerHTML, /8 de 12/);
  assert.match(container.innerHTML, /<details/); assert.match(container.innerHTML, /<summary[^>]*>[^<]*4/);
  for (let n = 1; n <= 12; n++) assert.ok(container.innerHTML.includes(`${n} kg`));
  assert.match(container.innerHTML, /624 kg/);
});

test('rascunho sem envio sobrevive fechamento e avulso pendente não duplica no mesmo exercício reaberto', async () => {
  const pending = deferred(); let writes = 0;
  const h = browser({ post: () => { writes++; return pending.promise; } });
  openLoad(h); h.node('aluno-carga-obs').value = 'Rascunho privado'; h.node('aluno-carga-obs').oninput();
  h.context.Modal.close(); h.context.workouts.abrirRegistroCarga(3, 'Exercício');
  assert.equal(h.node('aluno-carga-obs').value, 'Rascunho privado');
  const request = h.modals.at(-1).buttons[1].action(); h.context.Modal.close(); h.context.workouts.abrirRegistroCarga(3, 'Exercício');
  await h.modals.at(-1).buttons[1].action(); assert.equal(writes, 1);
  pending.reject({ status: 503 }); await request;
  assert.match(h.node('aluno-carga-feedback').textContent, /não confirmado/);
  assert.equal(h.node('aluno-carga-consultar').hidden, false);
  await h.modals.at(-1).buttons[1].action(); assert.equal(writes, 1);
});

test('consulta abandonada não autoriza revisão na reabertura e libera só o botão de consultar', async () => {
  const pending = deferred(); let reads = 0;
  const h = browser({ post: async () => { throw { timeout: true }; }, get: () => { reads++; return pending.promise; } });
  const modal = openLoad(h); await modal.buttons[1].action();
  const consultation = h.context.workouts.consultarRegistroCarga();
  h.context.Modal.close(); h.context.workouts.abrirRegistroCarga(3, 'Exercício');
  assert.equal(h.node('aluno-carga-consultar').disabled, true);
  pending.resolve({ data: [] }); await consultation;
  assert.equal(h.node('aluno-carga-consultar').disabled, false);
  assert.equal(h.node('aluno-carga-revisado').hidden, true);
  assert.equal(reads, 1);
});

test('histórico inválido, de outro exercício ou leitura falha não autoriza novo envio', async () => {
  for (const data of [null, {}, [{ exercicioId: 4, registros: [] }], [{ exercicioId: 3, registros: [null] }],
    ...[{}, { peso: 20, reps: 8, data: 'inválida' }, { peso: '', reps: 8, data: '2026-10-17' }, { peso: 20, reps: -1, data: '2026-10-17' }]
      .map(row => [{ exercicioId: 3, exercicioNome: 'Remada', registros: [row] }]), 'error']) {
    let writes = 0;
    const h = browser({ post: async () => { writes++; throw { timeout: true }; }, get: async () => { if (data === 'error') throw new Error('Offline'); return { data }; } });
    const modal = openLoad(h); await modal.buttons[1].action(); await h.context.workouts.consultarRegistroCarga(); h.context.workouts.confirmarRevisaoCarga();
    await modal.buttons[1].action(); assert.equal(writes, 1);
    assert.equal(h.node('aluno-carga-revisado').hidden, true); assert.match(h.node('aluno-carga-feedback').textContent, /continua bloqueado/);
  }
});

test('rejeição HTTP explícita admite correção; rede e 5xx exigem revisão e nenhum caso cria chave idempotente', async () => {
  for (const status of [400, 422, 0, 502]) {
    const writes = [];
    const h = browser({ post: async (url, body) => { writes.push(body); throw { status, message: 'Recusado' }; } });
    const modal = openLoad(h); await modal.buttons[1].action(); await modal.buttons[1].action();
    assert.equal(writes.length, status >= 400 && status < 500 ? 2 : 1); assert.ok(writes.every(body => body.idempotencyKey === undefined));
  }
});

test('geração, papel e epoch novos não herdam rascunhos ou bloqueio e consulta antiga não revela dados', async () => {
  for (const change of [h => { h.context.Auth.generation++; }, h => { h.context.Auth.user.id = 8; }, h => { h.context.Auth.sessionEpoch = 'new'; }]) {
    const pending = deferred(), h = browser({ post: async () => { throw { timeout: true }; }, get: () => pending.promise });
    const modal = openLoad(h); await modal.buttons[1].action(); const request = h.context.workouts.consultarRegistroCarga();
    change(h); h.context.workouts.abrirRegistroCarga(3, 'Novo contexto');
    assert.equal(h.node('aluno-carga-peso').value, ''); assert.equal(h.node('aluno-carga-consultar').hidden, true);
    pending.resolve({ data: [{ exercicioId: 3, exercicioNome: 'Privado', registros: [] }] }); await request;
    assert.equal(h.node('aluno-carga-review').innerHTML, ''); assert.equal(h.node('aluno-carga-feedback').textContent, '');
  }
});

test('linha de histórico mantém observação escapada e data com hora para distinguir registros do mesmo dia', () => {
  const h = browser(), html = h.context.ui.recordRow({ peso: 20, reps: 8, data: '2026-10-17T15:36:00.000Z', notas: '<img src=x> Carga real' });
  assert.match(html, /&lt;img src=x&gt; Carga real/); assert.ok(!html.includes('<img'));
  assert.match(html, /17\/10\/2026/); assert.match(html, /\d{2}:36/);
});

test('presença pendente de conta antiga não bloqueia nem libera uma gravação da nova conta', async () => {
  const old = deferred(), current = deferred(); let writes = 0;
  const h = browser({ post: () => ++writes === 1 ? old.promise : current.promise });
  renderCheckins(h);
  const first = h.context.checkins.fazerCheckin(); h.context.Auth.user.id = 8; h.context.Auth.generation++;
  await h.context.checkins.fazerCheckin(); assert.equal(writes, 1);
  renderCheckins(h); const second = h.context.checkins.fazerCheckin(); assert.equal(writes, 2);
  const record = h.context.checkins.checkinRecord, pending = record.pending;
  old.reject({ timeout: true }); await first;
  assert.equal(record.pending, pending); assert.equal(h.node('checkin-feedback').textContent, '');
  await h.context.checkins.fazerCheckin(); assert.equal(writes, 2);
  current.reject({ status: 400, message: 'Recusado' }); await second;
  assert.equal(record.pending, null); assert.equal(h.node('checkin-feedback').textContent, 'Recusado');
});

test('reabrir avulso após consulta exige mostrar histórico novamente antes de confirmar revisão', async () => {
  let writes = 0;
  const h = browser({ post: async () => { writes++; throw { timeout: true }; }, get: async () => ({ data: [] }) });
  const first = openLoad(h); await first.buttons[1].action(); await h.context.workouts.consultarRegistroCarga();
  assert.equal(h.node('aluno-carga-revisado').hidden, false);
  h.context.Modal.close(); h.context.workouts.abrirRegistroCarga(3, 'Exercício'); h.context.workouts.confirmarRevisaoCarga();
  await h.modals.at(-1).buttons[1].action(); assert.equal(writes, 1);
  assert.equal(h.node('aluno-carga-revisado').hidden, true);
});

test('handler de presença renderizado por outra conta ou sessão não inicia POST sob a identidade nova', async () => {
  for (const change of [h => { h.context.Auth.user.id = 8; }, h => { h.context.Auth.generation++; }, h => { h.context.Auth.sessionEpoch = 'next'; }, h => { h.context.Auth.getSessionEpoch = () => 'remote'; }]) {
    let writes = 0; const h = browser({ post: async () => { writes++; throw { status: 400 }; } });
    renderCheckins(h);
    const originalContext = h.context.checkins.checkinContext; change(h); assert.equal(originalContext(), false);
    await h.context.checkins.fazerCheckin(); assert.equal(writes, 0);
  }
});

test('presença malformada não representa histórico vazio nem autoriza repetição após envio incerto', async () => {
  for (const invalid of [{}, null, { totalMes: 0 }, { checkins: [] }, { totalMes: -1, checkins: [] }, { totalMes: 0, checkins: [null] }, { totalMes: 0, checkins: [{ status: 'inventado', data: '2026-10-17' }] }]) {
    let writes = 0;
    const h = browser({ post: async () => { writes++; throw { timeout: true }; }, get: async url => ({ data: url === '/aluno/painel' ? panel('Aluno') : invalid }) });
    const container = renderCheckins(h);
    await h.context.checkins.fazerCheckin(); await h.context.checkins.inicializar(); h.context.checkins.confirmarRevisao();
    await h.context.checkins.fazerCheckin(); assert.equal(writes, 1);
    assert.equal(h.context.checkins.checkinRecord.reviewed, false);
    assert.match(container.innerHTML, /Não foi possível carregar/); assert.ok(!container.innerHTML.includes('Nenhuma presença registrada'));
  }
});

