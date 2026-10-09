const AppError = require('./AppError');
const METHODS = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia', 'simulado'];
// Formatos enviados pelo checkout anterior são aliases explícitos, não texto livre.
const ALIASES = new Map([['Pix', 'pix'], ['PIX', 'pix'], ['Cartão de Crédito', 'cartao_credito'],
  ['Cartão de Débito', 'cartao_debito'], ['Boleto', 'boleto'], ['Simulado', 'simulado']]);
function validatePaymentMethod(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new AppError('Método de pagamento inválido.', 400);
  const method = ALIASES.get(value) || value;
  if (!METHODS.includes(method)) throw new AppError('Método de pagamento inválido.', 400);
  return method;
}
module.exports = { validatePaymentMethod };
