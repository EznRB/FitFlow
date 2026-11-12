'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const quotaWindow = require('./helpers/quota-window.cjs');

test('lote perto da virada espera antes de iniciar mutações e preserva o resultado', async () => {
  const times = [899995, 900050, 900100], events = [];
  const result = await quotaWindow(async () => times.shift(), async () => { events.push('batch'); return 42; }, {
    wait: async delay => { assert.ok(delay > 5 && delay <= 30050); events.push('wait'); },
  });
  assert.deepEqual(events, ['wait', 'batch']); assert.equal(result, 42);
});

test('lote que demora até outra janela não é declarado aprovado', async () => {
  const times = [1000, 900001];
  await assert.rejects(quotaWindow(async () => times.shift(), async () => 42), error => error.code === 'QUOTA_TEST_WINDOW' && /janela/.test(error.message));
});

test('falha do lote é preservada sem repetição automática', async () => {
  const failure = new Error('synthetic failure'); let calls = 0;
  await assert.rejects(quotaWindow(async () => 1000, async () => { calls++; throw failure; }), error => error === failure);
  assert.equal(calls, 1);
});
