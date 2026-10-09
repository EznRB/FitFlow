const { test } = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler } = require('../src/middleware/errorHandler');
function response(error) {
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  errorHandler(error, {}, res, () => {}); return res;
}
test('falha de banco e conflito transitório preservam status de indisponibilidade sem vazar detalhe', () => {
  for (const code of ['P1000', 'P1001', 'P1002', 'P1017', 'P2024', 'P2034']) {
    const result = response(Object.assign(new Error('private-database-details'), { code }));
    assert.equal(result.code, 503); assert.ok(!JSON.stringify(result.body).includes('private-database-details'));
  }
});
test('conflitos de integridade e registro ausente têm respostas operacionais', () => {
  for (const [code, status] of [['P2002', 409], ['P2003', 409], ['P2025', 404]]) {
    assert.equal(response(Object.assign(new Error('private query'), { code })).code, status);
  }
});
