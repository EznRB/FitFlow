'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const settledBatch = require('./helpers/settled-batch.cjs');

test('falha rápida não libera cleanup enquanto outra mutação continua pendente', async () => {
  const first = new Error('fast failure');
  let finish, outcome, mutationFinished = false;
  const slow = new Promise(resolve => { finish = () => { mutationFinished = true; resolve('saved'); }; });
  const batch = settledBatch([Promise.reject(first), slow]).catch(error => { outcome = error; });
  try {
    await new Promise(setImmediate);
    assert.equal(outcome, undefined, 'caller must not enter cleanup before all mutations settle');
  } finally { finish(); await batch; }
  assert.equal(mutationFinished, true);
  assert.ok(outcome instanceof AggregateError);
  assert.deepEqual(outcome.errors, [first]);
});

test('preserva ordem dos resultados e coleta todas as falhas antes de propagar', async () => {
  assert.deepEqual(await settledBatch([Promise.resolve(2), Promise.resolve(1)]), [2, 1]);
  const errors = [new Error('one'), new Error('two')];
  await assert.rejects(settledBatch(errors.map(error => Promise.reject(error))), error =>
    error instanceof AggregateError && error.errors.every((item, index) => item === errors[index]) && error.errors.length === 2);
});
