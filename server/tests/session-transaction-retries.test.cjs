const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessoesRepository } = require('../src/repositories/sessoes.repository');

test('conflitos de serialização/deadlock PostgreSQL repetem a transação inteira com limite', async () => {
  for (const code of ['40001', '40P01']) {
    let attempts = 0;
    const db = { $transaction: async operation => {
      attempts++;
      if (attempts < 3) throw { code: 'P2010', meta: { code } };
      return operation({});
    } };
    assert.equal(await createSessoesRepository(db).transaction(() => 'ok'), 'ok');
    assert.equal(attempts, 3);
    attempts = 0;
    db.$transaction = async () => { attempts++; throw { code: 'P2010', meta: { code } }; };
    await assert.rejects(createSessoesRepository(db).transaction(() => 'ok'));
    assert.equal(attempts, 3);
  }
});

test('falhas de SQL/constraint PostgreSQL não recebem retry indiscriminado', async () => {
  for (const code of ['23514', '42601', '42501']) {
    let attempts = 0;
    const failure = { code: 'P2010', meta: { code } };
    const db = { $transaction: async () => { attempts++; throw failure; } };
    await assert.rejects(createSessoesRepository(db).transaction(() => 'ok'), error => error === failure);
    assert.equal(attempts, 1);
  }
});
