const AppError = require('./AppError');
const { paymentDate, brazilDate } = require('./paymentValidation');

// MySQL DATE is a civil date represented by Prisma at UTC midnight. It is not
// an instant at midnight in the browser/server's local timezone.
const dayMs = 86400000;
const dateKey = date => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * dayMs);

function civilRange(query = {}) {
  const range = {};
  if (query.startDate !== undefined) range.gte = paymentDate(query.startDate);
  if (query.endDate !== undefined) range.lte = paymentDate(query.endDate);
  if (range.gte && range.lte && range.gte > range.lte) throw new AppError('A data inicial deve anteceder ou coincidir com a final.', 400);
  return Object.keys(range).length ? range : undefined;
}

function positiveInteger(value, label, maximum = 366) {
  if (!((typeof value === 'number' && Number.isInteger(value)) || (typeof value === 'string' && /^[1-9]\d*$/.test(value)))) throw new AppError(`${label} inválido.`, 400);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new AppError(`${label} deve estar entre 1 e ${maximum}.`, 400);
  return number;
}

function checkinFilters(filters = {}) {
  const where = {};
  if (filters.studentId !== undefined) where.studentId = positiveInteger(filters.studentId, 'ID do aluno', 2147483647);
  if (filters.incluirCancelados !== undefined && ![true, false, 'true', 'false'].includes(filters.incluirCancelados)) throw new AppError('Filtro de cancelamento inválido.', 400);
  if (![true, 'true'].includes(filters.incluirCancelados)) where.status = 'present';
  const period = civilRange(filters);
  if (filters.date !== undefined) {
    if (period) throw new AppError('Use uma data específica ou um período, sem combinar os filtros.', 400);
    where.checkinDate = paymentDate(filters.date);
  } else if (period) where.checkinDate = period;
  return where;
}

// createdAt is an instant: query boundaries and grouping need São Paulo's
// calendar, unlike DATE columns. Resolve the IANA offset instead of relying on
// the host timezone or assuming a permanent UTC-3 offset.
function brazilDayStartInstant(civilDate) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', timeZoneName: 'longOffset' });
  let instant = new Date(civilDate);
  for (let i = 0; i < 3; i++) {
    const zone = formatter.formatToParts(instant).find(part => part.type === 'timeZoneName').value;
    const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(zone);
    if (!match) throw new Error('Não foi possível determinar o fuso de São Paulo.');
    const minutes = match[1] ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '-' ? -1 : 1) : 0;
    const next = new Date(civilDate.getTime() - minutes * 60000);
    if (+next === +instant) return next;
    instant = next;
  }
  return instant;
}

module.exports = { dateKey, addDays, civilRange, positiveInteger, checkinFilters, brazilDayStartInstant, brazilDate };
