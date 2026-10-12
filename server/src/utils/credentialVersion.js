'use strict';
const AppError = require('./AppError');
function credentialVersion(value, { stored = false } = {}) {
  // Tokens issued before this column existed represent generation zero.
  // Undefined in injected legacy test records has the same initial meaning.
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 2147483647) {
    throw new AppError(stored ? 'Estado de autenticação temporariamente indisponível.' : 'Sessão inválida. Faça login novamente.', stored ? 503 : 401);
  }
  return value;
}
module.exports = { credentialVersion };
