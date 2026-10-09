const AppError = require('./AppError');

function validatePassword(password) {
  // bcrypt considera somente os primeiros 72 bytes; rejeita truncamento silencioso.
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || !password.trim()) {
    throw new AppError('A senha deve ter no mínimo 8 caracteres e no máximo 72 bytes.', 400);
  }
  return password;
}

function validateAccount(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Dados de cadastro inválidos.', 400);
  const { name, email, password } = data;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new AppError('Nome deve ter entre 1 e 100 caracteres.', 400);
  if (typeof email !== 'string' || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new AppError('E-mail inválido (máximo 150 caracteres).', 400);
  validatePassword(password);
  return { name: name.trim(), email: email.trim().toLowerCase(), password };
}

module.exports = { validatePassword, validateAccount };
