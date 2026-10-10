const test = require('node:test');
const assert = require('node:assert/strict');
const { getDatabaseProvider } = require('../src/config/databaseProvider');

test('seleção do banco reconhece protocolos e impede schema incompatível sem expor URL', () => {
  for (const protocol of ['postgres', 'postgresql']) {
    assert.equal(getDatabaseProvider({ url: `${protocol}://u:private@db.test/fitflow`, provider: '' }), 'postgresql');
  }
  assert.equal(getDatabaseProvider({ url: 'mysql://u:private@localhost/fitflow', provider: '' }), 'mysql');
  for (const [url, provider] of [['postgres://u:private@db.test/fitflow', 'mysql'], ['mysql://u:private@db.test/fitflow', 'postgresql'], ['https://private@db.test', ''], ['private', ''], ['', 'sqlite']]) {
    assert.throws(() => getDatabaseProvider({ url, provider }), error => !error.message.includes('private'));
  }
});
