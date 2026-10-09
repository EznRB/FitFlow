const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const evil = '"><img src=x onerror=alert(1)>';
function browser(globals = {}) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', style: {}, contains: () => true, setAttribute() {} });
    return nodes.get(id);
  };
  const context = vm.createContext({ window: {}, URL, URLSearchParams,
    document: { getElementById: node }, Toast: { warning() {}, error() {} }, ...globals });
  for (const file of ['security.js', 'planos.js', 'checkins.js', 'relatorios.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext('this.plans = PlanosView; this.checkins = CheckinsView; this.reports = RelatoriosView;', context);
  return { context, node };
}
function safe(html) { assert.ok(!html.includes('<img src=x')); assert.ok(!html.includes('onclick=')); }
test('planos escapam campos do card, edição e confirmação e não prometem cobrança automática', () => {
  let modal, confirm;
  const { context, node } = browser({ Modal: { open: (title, html) => { modal = html; }, confirm: html => { confirm = html; } } });
  const plan = { id: 3, name: evil, description: evil, price: '365.00', durationDays: 365, active: true };
  const html = context.plans.renderCard(plan); safe(html); assert.ok(html.includes('&lt;img')); assert.ok(html.includes('R$') && html.includes('30 dias'));
  assert.equal(context.plans.equivalente('365.00', 365), 30);
  assert.equal(context.plans.equivalente('123.00', 41), 90);
  context.plans.dados = [plan]; context.plans.abrirModalEdicao(3); safe(modal);
  assert.ok(modal.includes('for="input-plano-valor"')); assert.ok(modal.includes('não agenda cobranças automáticas'));
  context.plans.inativarPlano(3); safe(confirm); assert.ok(confirm.includes('históricos serão preservados'));
  node('input-plano-periodo').value = '365'; node('input-plano-valor').value = '365.00';
  context.plans._atualizarMensal(); assert.equal(node('display-mensal').textContent, 'R$ 30,00 por 30 dias');
});
test('check-ins escapam nomes, status, motivos e modal; data civil permanece no mesmo dia', async () => {
  let modal;
  const { context, node } = browser({ API: { get: async () => ({ data: [{ id: 1, student: { user: { name: evil, email: evil } }, checkinDate: '2026-10-08T00:00:00Z', createdAt: '2026-10-08T12:00:00Z', status: evil },
    { id: 2, student: { user: { name: evil } }, status: 'cancelled', cancelReason: evil }] }) }, Modal: { open: (title, html) => { modal = html; } } });
  await context.checkins.carregarLista(); safe(node('checkins-table-body').innerHTML);
  assert.ok(node('checkins-table-body').innerHTML.includes('&lt;img'));
  assert.equal(context.checkins.formatarData('2026-10-08T00:00:00Z'), '08/10/2026');
  context.checkins.abrirModalCancelar(1, evil); safe(modal); assert.ok(modal.includes('for="input-cancel-motivo"'));
  context.checkins.alunos = [{ id: 5, status: 'active', user: { name: evil, active: true } }];
  context.checkins.abrirModalRegistro(); safe(modal); assert.ok(modal.includes('for="input-checkin-aluno"'));
});
test('abrir presença do aluno não grava; clique registra e conflito cancelado não afirma presença', async () => {
  let writes = 0;
  const button = {}, feedback = {};
  const container = { innerHTML: '', querySelector: selector => selector.includes('feedback') ? feedback : button };
  const { context } = browser({ document: { getElementById: () => container },
    API: { post: async () => { writes++; throw { status: 409, message: 'Registro cancelado ' + evil }; } } });
  await context.checkins.renderVisaoAluno(); assert.equal(writes, 0);
  await button.onclick(); assert.equal(writes, 1); assert.equal(button.disabled, true);
  assert.ok(feedback.textContent.includes('cancelado')); assert.ok(!feedback.textContent.includes('Presença registrada'));
  assert.equal(feedback.innerHTML, undefined);
});
test('relatórios escapam todo dado e status, somam valores decimais e rejeitam calendário inválido', async () => {
  const { context, node } = browser({ API: { get: async () => ({ data: [
    { nome: evil, email: evil, plano: evil, status: evil, mensalidadesAtrasadas: evil, totalAtraso: '10.20' },
    { nome: 'B', status: 'overdue', mensalidadesAtrasadas: 1, totalAtraso: '20.30' }] }) } });
  await context.reports.carregarInadimplencia(); safe(node('relatorio-tbody').innerHTML);
  assert.ok(node('relatorio-tbody').innerHTML.includes('&lt;img')); assert.ok(node('relatorio-resumo').innerHTML.includes('30,50'));
  for (const value of [null, true, {}, evil, '', Infinity]) assert.equal(context.reports.formatMoney(value), '—');
  assert.equal(context.reports.getStatusBadge('__proto__'), '<span class="badge">__proto__</span>');
  assert.equal(context.reports.validDate('2026-02-31'), false);
  assert.equal(context.reports.formatDate('2026-10-08T00:00:00Z'), '08/10/2026');
  context.reports.container = node('relatorios-container'); context.reports.renderizarEstrutura();
  assert.ok(node('relatorios-container').innerHTML.includes('for="filtro-data-inicio"'));
  assert.ok(node('relatorios-container').innerHTML.includes('tabindex="0"'));
  assert.ok(node('relatorios-container').innerHTML.includes('role="alert"'));
});
test('resposta antiga do relatório não substitui a seleção atual; período inválido não consulta API', async () => {
  let resolveOld, calls = 0;
  const { context, node } = browser({ API: { get: async () => { calls++; if (calls === 1) return new Promise(resolve => { resolveOld = resolve; }); return { data: { items: [{ nome: 'Seleção atual', status: 'active' }], resumo: {} } }; } } });
  const old = context.reports.carregarRelatorio('inadimplencia');
  await context.reports.carregarRelatorio('alunos');
  resolveOld({ data: [{ nome: 'Resposta antiga', totalAtraso: 50 }] }); await old;
  assert.ok(node('relatorio-tbody').innerHTML.includes('Seleção atual')); assert.ok(!node('relatorio-tbody').innerHTML.includes('Resposta antiga'));
  node('filtro-data-inicio').value = '2026-02-31'; node('filtro-data-fim').value = '2026-10-08';
  await context.reports.carregarRelatorio('pagamentos'); assert.equal(calls, 2);
  assert.equal(node('relatorio-error').style.display, 'block'); assert.equal(node('relatorio-empty').style.display, 'none');
});
