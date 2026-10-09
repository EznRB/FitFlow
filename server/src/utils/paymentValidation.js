const AppError = require('./AppError');

function paymentId(value, label = 'ID') {
  if (!((typeof value === 'number' && Number.isInteger(value)) || (typeof value === 'string' && /^[1-9]\d*$/.test(value)))) throw new AppError(`${label} inválido.`, 400);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new AppError(`${label} inválido.`, 400);
  return id;
}
function moneyCents(value) {
  if (!['number', 'string'].includes(typeof value) || !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(value))) throw new AppError('Valor monetário inválido: use até duas casas decimais.', 400);
  const [whole, fraction = ''] = String(value).split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new AppError('O valor do pagamento deve ser positivo.', 400);
  return cents;
}
function paymentDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) throw new AppError('Data inválida: use AAAA-MM-DD.', 400);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AppError('Data de calendário inválida.', 400);
  return date;
}
function brazilDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return paymentDate(`${values.year}-${values.month}-${values.day}`);
}
function validateNotes(value) {
  if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > 5000)) throw new AppError('Observações inválidas (máximo 5000 caracteres).', 400);
  return value ?? null;
}
function paymentStatus(value) {
  if (!['paid', 'pending', 'overdue'].includes(value)) throw new AppError('Status de pagamento inválido.', 400);
  return value;
}
module.exports = { paymentId, moneyCents, paymentDate, brazilDate, validateNotes, paymentStatus };
