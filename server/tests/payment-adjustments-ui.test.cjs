const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const confirmation = (id, paymentId = 12) => ({ id, paymentId, actorId: 7, providerRefundPerformed: false });
const payment = () => ({ id: 12, amount: '100.01', status: 'paid', paymentDate: '2026-10-01', checkout: false,
  student: { membershipRevision: 3, planStartDate: '2026-10-01', planEndDate: '2026-11-01', status: 'active', user: { active: true } }, adjustments: [] });
function harness({ get, post, storage = new Map(), record = payment() } = {}) {
  const nodes = new Map(), messages = [], modals = [], events = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', disabled: false, hidden: false, isConnected: true,
      addEventListener(name, fn) { this[name] = fn; }, checkValidity: () => true });
    return nodes.get(id);
  };
  const Auth = { user: { id: 7, role: 'admin' }, generation: 1 };
  let generation = 0, open = false;
  const view = { contextoModal: () => ({ generation: ++generation }), modalAtual: context => context.generation === generation,
    vincularModal: () => {}, carregarLista: () => { view.reloads++; }, reloads: 0 };
  const context = vm.createContext({ crypto: webcrypto, TextEncoder, Intl, Auth,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-11T12:00:00Z'])); } },
    sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
    navigator: { locks: { request: async (name, opts, fn) => fn() } },
    window: { addEventListener: (name, fn) => events.set(name, fn) }, document: { getElementById: node },
    API: { get: get || (async url => { if (url.includes('/solicitacoes/')) throw Object.assign(new Error('ausente'), { status: 404 }); return { data: record }; }),
      post: post || (async (url, body) => ({ data: confirmation(body.idempotencyKey) })) },
    Modal: { open: (title, html, actions) => { open = true; node('payment-adjustment-form'); modals.push({ title, html, actions }); },
      close: () => { open = false; context.closes++; }, isOpen: () => open },
    Toast: { error: m => messages.push(['error', m]), success: m => messages.push(['success', m]) } });
  context.closes = 0;
  for (const file of ['security', 'payment-adjustments']) vm.runInContext(fs.readFileSync(path.join(__dirname, `../../client/js/${file}.js`), 'utf8'), context);
  const module = context.window.PaymentAdjustments;
  const fill = () => { node('adjustment-kind').value = record.checkout ? 'refund_recorded' : 'correction'; node('adjustment-amount').value = '25.01';
    node('adjustment-reason').value = 'Correção detalhada de teste'; node('adjustment-date').value = '2026-10-10'; node('adjustment-membership').value = 'preserve'; };
  const submit = () => modals.at(-1).actions.find(a => a.class === 'btn-primary').action();
  return { module, context, Auth, view, nodes, node, messages, modals, storage, events, record, fill, submit,
    invalidate: () => { generation++; } };
}

test('histórico preserva original, soma centavos e escapa conteúdo de responsável/motivo', () => {
  const h = harness(); const p = payment(); p.adjustments = [{ id: 1, amount: '25.01', kind: 'refund_recorded',
    actorName: '<img src=x onerror=alert(1)>', reason: '<script>alert(1)</script>', effectiveDate: '2026-10-10',
    membershipEffect: 'set_end_date', membershipBefore: { planEndDate: '2026-11-01' }, membershipAfter: { planEndDate: '2026-10-25' } }];
  const html = h.module.historyHtml(p);
  assert.match(html, /100,01/); assert.match(html, /25,01/); assert.match(html, /75,00/);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /01\/11\/2026/); assert.match(html, /25\/10\/2026/);
  assert.match(html, /não executa/i);
});

test('formulário consulta registro atual e não oferece correção de recibo de checkout', async () => {
  const p = payment(); p.checkout = true; const h = harness({ record: p });
  await h.module.open(p, h.view);
  assert.doesNotMatch(h.modals[0].html, /value="correction"/);
  assert.match(h.modals[0].html, /não executa/i); assert.match(h.modals[0].html, /max="2026-10-11"/);
});

test('resposta incerta guarda apenas UUID/hash e retry verifica antes de repetir mesma chave', async () => {
  const sent = [], sequence = [];
  const h = harness({ get: async url => { sequence.push(url); if (url.includes('solicitacoes')) throw Object.assign(new Error('ausente'), { status: 404 }); return { data: payment() }; },
    post: async (url, body) => { sequence.push('POST'); sent.push(structuredClone(body)); if (sent.length === 1) throw Object.assign(new Error('rede'), { status: 0 }); return { data: confirmation(body.idempotencyKey) }; } });
  await h.module.open(payment(), h.view); h.fill(); await h.submit();
  const persisted = JSON.parse([...h.storage.values()][0]);
  assert.deepEqual(Object.keys(persisted).sort(), ['fingerprint', 'id']);
  assert.doesNotMatch(JSON.stringify(persisted), /Correção|amount|paymentId/);
  await h.submit(); assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
  assert.equal(sent[0].expectedActorId, 7); assert.match(sequence.at(-2), /solicitacoes/);
  assert.equal(h.context.closes, 1); assert.equal(h.storage.size, 0);
});

test('envio incerto impede alterar campos e reload exige mesmos dados sem gravar informações pessoais', async () => {
  const storage = new Map(), sent = [];
  const h = harness({ storage, post: async (url, body) => { sent.push(body); throw Object.assign(new Error('rede'), { status: 0 }); } });
  await h.module.open(payment(), h.view); h.fill(); await h.submit();
  h.node('adjustment-amount').value = '30.00'; await h.submit(); assert.equal(sent.length, 1);
  const reload = harness({ storage, post: async (url, body) => { sent.push(body); return { data: confirmation(body.idempotencyKey) }; } });
  await reload.module.open(payment(), reload.view); assert.match(reload.modals[0].html, /mesmos dados/i);
  reload.fill(); await reload.submit(); assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
});

test('lookup confirmado encerra intenção sem repetir ajuste financeiro', async () => {
  let recover = false, sends = 0;
  const h = harness({ get: async url => { if (!url.includes('solicitacoes')) return { data: payment() };
    if (recover) return { data: confirmation(url.split('/').at(-1)) }; throw Object.assign(new Error('ausente'), { status: 404 }); },
    post: async () => { sends++; throw Object.assign(new Error('rede'), { status: 0 }); } });
  await h.module.open(payment(), h.view); h.fill(); await h.submit(); recover = true; await h.submit();
  assert.equal(sends, 1); assert.equal(h.context.closes, 1); assert.equal(h.storage.size, 0);
});

test('vigência explícita captura revisão atual e não calcula duração a partir do plano', async () => {
  let payload; const h = harness({ post: async (url, body) => { payload = body; return { data: confirmation(body.idempotencyKey) }; } });
  await h.module.open(payment(), h.view); h.fill(); h.node('adjustment-membership').value = 'set_end_date';
  h.node('adjustment-end-date').value = '2026-10-25'; await h.submit();
  assert.equal(payload.expectedMembershipRevision, 3); assert.equal(payload.newPlanEndDate, '2026-10-25');
});

test('duplo clique e troca de conta não geram segundo envio nem efeitos na nova conta', async () => {
  let finish, sends = 0; const h = harness({ post: async () => { sends++; return new Promise(resolve => { finish = resolve; }); } });
  await h.module.open(payment(), h.view); h.fill(); const first = h.submit();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await h.submit(); assert.equal(sends, 1);
  h.Auth.user = { id: 8, role: 'admin' }; h.Auth.generation++; h.events.get('auth:logout')?.({ detail: { userId: 7 } });
  finish({ data: confirmation(JSON.parse([...h.storage.values()][0]).id) }); await first;
  assert.equal(h.context.closes, 0); assert.equal(h.view.reloads, 0); assert.equal(h.storage.size, 1);
});

test('consulta atrasada descartada e validações civis/saldo não enviam ajuste', async () => {
  let finish, sends = 0;
  const h = harness({ get: async () => new Promise(resolve => { finish = resolve; }), post: async () => { sends++; } });
  const opening = h.module.open(payment(), h.view); h.invalidate(); finish({ data: payment() }); await opening;
  assert.equal(h.modals.length, 0);
  const ready = harness({ post: async () => { sends++; } }); await ready.module.open(payment(), ready.view); ready.fill();
  ready.node('adjustment-date').value = '2026-02-30'; await ready.submit();
  ready.node('adjustment-date').value = '2026-10-12'; await ready.submit();
  ready.node('adjustment-date').value = '2026-10-10'; ready.node('adjustment-amount').value = '100.02'; await ready.submit();
  assert.equal(sends, 0);
});

test('rejeição explícita permite corrigir campos com a mesma UUID; lookup indisponível impede reenvio', async () => {
  const sent = []; let lookupUnavailable = false;
  const h = harness({ get: async url => { if (!url.includes('solicitacoes')) return { data: payment() };
    throw Object.assign(new Error(lookupUnavailable ? 'indisponível' : 'ausente'), { status: lookupUnavailable ? 503 : 404 }); },
    post: async (url, body) => { sent.push(structuredClone(body)); if (sent.length === 1) throw Object.assign(new Error('validação'), { status: 400 }); return { data: confirmation(body.idempotencyKey) }; } });
  await h.module.open(payment(), h.view); h.fill(); await h.submit();
  h.node('adjustment-amount').value = '30.00'; lookupUnavailable = true; await h.submit(); assert.equal(sent.length, 1);
  lookupUnavailable = false; await h.submit(); assert.equal(sent.length, 2);
  assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey); assert.equal(sent[1].amount, '30.00');
});

test('cadastro inativo bloqueia alteração de vigência e mantém registro financeiro disponível', async () => {
  const p = payment(); p.student.user.active = false; let sends = 0;
  const h = harness({ record: p, post: async (url, body) => { sends++; return { data: confirmation(body.idempotencyKey) }; } });
  await h.module.open(p, h.view); assert.match(h.modals[0].html, /value="set_end_date" disabled/); h.fill();
  h.node('adjustment-membership').value = 'set_end_date'; h.node('adjustment-end-date').value = '2026-10-25';
  await h.submit(); assert.equal(sends, 0);
  h.node('adjustment-membership').value = 'preserve'; await h.submit(); assert.equal(sends, 1);
});

test('saldo totalmente ajustado permite somente reconciliar intenção anterior confirmada', async () => {
  const storage = new Map(); let recover = false;
  const get = async url => {
    if (url.includes('solicitacoes')) { if (recover) return { data: confirmation(url.split('/').at(-1)) }; throw Object.assign(new Error('ausente'), { status: 404 }); }
    const p = payment(); if (recover) p.adjustments.push({ amount: '100.01' }); return { data: p };
  };
  const first = harness({ storage, get, post: async () => { throw Object.assign(new Error('rede'), { status: 0 }); } });
  await first.module.open(payment(), first.view); first.fill(); await first.submit(); assert.equal(first.module.hasPending(), true);
  recover = true; let sends = 0; const reload = harness({ storage, get, post: async () => { sends++; } });
  await reload.module.open(payment(), reload.view);
  await reload.modals[0].actions.find(a => a.text === 'Verificar envio anterior').action();
  assert.equal(sends, 0); assert.equal(storage.size, 0); assert.equal(reload.context.closes, 1);
});

test('confirmação inválida de UUID/ator/provedor/recibo preserva intenção para reconciliação', async () => {
  for (const override of [{ id: 23 }, { id: webcrypto.randomUUID() }, { actorId: 8 },
    { providerRefundPerformed: true }, { paymentId: 0 }, { paymentId: 13 }]) {
    const h = harness({ post: async (url, body) => ({ data: { ...confirmation(body.idempotencyKey), ...override } }) });
    await h.module.open(payment(), h.view); h.fill(); await h.submit();
    assert.equal(h.storage.size, 1); assert.equal(h.context.closes, 0); assert.equal(h.view.reloads, 0);
    assert.ok(h.messages.some(([type, text]) => type === 'error' && /confirmação inválida/.test(text)));
  }
});

test('lookup autenticado de outro recibo reconcilia anterior sem enviar ajuste no recibo aberto', async () => {
  let recover = false, sends = 0;
  const h = harness({ get: async url => {
    if (!url.includes('solicitacoes')) return { data: payment() };
    if (recover) return { data: confirmation(url.split('/').at(-1), 13) };
    throw Object.assign(new Error('ausente'), { status: 404 });
  }, post: async () => { sends++; throw Object.assign(new Error('rede'), { status: 0 }); } });
  await h.module.open(payment(), h.view); h.fill(); await h.submit(); recover = true;
  await h.modals.at(-1).actions.find(action => action.text === 'Verificar envio anterior').action();
  assert.equal(sends, 1); assert.equal(h.storage.size, 0); assert.equal(h.context.closes, 1);
  assert.ok(h.messages.some(([type, text]) => type === 'success' && /outro recebimento/.test(text)));
});
