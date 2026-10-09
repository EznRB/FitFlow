const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createFirstAdmin, parseArguments } = require('../scripts/bootstrap-admin.cjs');
const credentials = { name: 'Gestor de teste', email: 'GESTOR@example.test', password: 'Individual-123456789-test' };
function fixture({ admins = 0, existing = null } = {}) {
  const rows = [];
  const tx = { user: { count: async () => admins, findUnique: async () => existing,
    create: async ({ data, select }) => { assert.deepEqual(select, { id: true }); rows.push(data); return { id: 1 }; } } };
  return { rows, db: { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(tx); } } };
}
test('bootstrap exige confirmação de destino e recusa flags/URL incompatíveis antes de acessar banco', () => {
  const args = ['--credentials-file', '.bootstrap-admin.local.json', '--database-host', 'db.example.test', '--database-name', 'fitflow'];
  assert.ok(parseArguments(args, 'mysql://user:secret@db.example.test:3306/fitflow').endsWith('.bootstrap-admin.local.json'));
  assert.ok(parseArguments(args, 'postgresql://user:secret@db.example.test:5432/fitflow?sslmode=require').endsWith('.bootstrap-admin.local.json'));
  for (const url of [undefined, 'mysql://u:p@other.test/fitflow', 'mysql://u:p@db.example.test/other', 'https://db.example.test/fitflow']) {
    assert.throws(() => parseArguments(args, url));
  }
  assert.throws(() => parseArguments([...args, '--password', 'secret'], 'mysql://u:p@db.example.test/fitflow'));
});
test('bootstrap cria só admin ativo, hash bcrypt verificável e resposta sem credenciais', async () => {
  const f = fixture();
  assert.deepEqual(await createFirstAdmin(f.db, credentials), { id: 1 });
  assert.equal(f.rows[0].email, 'gestor@example.test'); assert.equal(f.rows[0].role, 'admin'); assert.equal(f.rows[0].active, true);
  assert.ok(await bcrypt.compare(credentials.password, f.rows[0].passwordHash));
  assert.equal(f.rows[0].password, undefined);
});
test('bootstrap nunca promove conta existente, reseta senha ou cria segundo admin', async () => {
  for (const options of [{ admins: 1 }, { existing: { id: 44 } }]) {
    const f = fixture(options);
    await assert.rejects(() => createFirstAdmin(f.db, credentials)); assert.equal(f.rows.length, 0);
  }
  const f = fixture();
  await assert.rejects(() => createFirstAdmin(f.db, { ...credentials, password: 'curta' })); assert.equal(f.rows.length, 0);
});
