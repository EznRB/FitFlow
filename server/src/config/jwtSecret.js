const { randomBytes } = require('node:crypto');

function resolveJwtSecret(value, nodeEnv) {
  const strong = typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32 &&
    new Set(value).size >= 10 && !/change[_-]?me|dev[_-]?secret|dev[_-]?refresh/i.test(value);
  if (strong) return value;
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET ausente ou fraco. Configure um segredo aleatório com pelo menos 32 bytes antes de iniciar em produção.');
  }
  return randomBytes(48).toString('base64url');
}

module.exports = { resolveJwtSecret };
