const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness({ status = 'completing', restSeconds } = {}) {
  const button = {}, prescription = {}, form = { elements: { exerciseId: { value: '3' } } };
  const section = { querySelector: selector => selector === '[data-abandon-session]' ? button : selector === '[data-set-form]' && status === 'active' ? form : selector === '[data-prescription]' ? prescription : null };
  const calls = [], dialogs = [], user = { id: 7, role: 'student' };
  const container = { querySelector: selector => selector === '[data-active-session]' ? section : {}, querySelectorAll: () => [] };
  const store = { abandonBlocked: async (...args) => calls.push(args), state: async () => ({ sessions: [], operations: [] }) };
  const context = vm.createContext({ console, Auth: { user }, FitFlowSecurity: { escapeHtml: value => String(value) },
    Modal: { confirm: (message, action, label) => dialogs.push({ message, action, label }) },
    window: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/sessoes.js'), 'utf8'), context);
  vm.runInContext('globalThis.view = SessoesView', context);
  const view = context.view; view.store = store; view.userId = 7; view.container = container;
  view.current = () => true; view.updateIndicators = () => {}; view.refresh = async () => {};
  view.draw({ sessions: [{ id: 'session-a', status, planSnapshot: { name: 'A', exercises: [{ id: 3, sets: 3, reps: '8–12', restSeconds }] } }], operations: [] });
  view.draw = () => {};
  return { view, context, button, calls, dialogs, prescription };
}

test('recuperação exige confirmação que explica perda dos envios e preservação local', async () => {
  const h = harness(); h.button.onclick();
  assert.equal(h.calls.length, 0);
  assert.equal(h.dialogs.length, 1);
  assert.match(h.dialogs[0].message, /Todos os seus envios pendentes/);
  assert.match(h.dialogs[0].message, /até você sair da conta/);
  assert.match(h.dialogs[0].message, /continuar incompleta/);
  await h.dialogs[0].action();
  assert.equal(h.calls[0][0], 'session-a'); assert.equal(h.calls[0][1].confirmed, true);
});

test('confirmação atrasada não arquiva sessão após trocar a conta ou o store', async () => {
  for (const changed of ['account', 'store']) {
    const h = harness(); h.button.onclick();
    if (changed === 'account') h.context.Auth.user = { id: 8, role: 'student' };
    else h.view.store = {};
    await h.dialogs[0].action(); assert.equal(h.calls.length, 0);
  }
});

test('ficha distingue pausa explícita zero de pausa não informada', () => {
  assert.match(harness({ status: 'active', restSeconds: 0 }).prescription.textContent, /descanso 0s/);
  for (const restSeconds of [null, undefined]) {
    const text = harness({ status: 'active', restSeconds }).prescription.textContent;
    assert.match(text, /pausa não informada/); assert.ok(!text.includes('descanso 0s'));
  }
});
