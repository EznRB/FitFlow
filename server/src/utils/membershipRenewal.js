const AppError = require('./AppError');
const { paymentId } = require('./paymentValidation');

async function lockStudent(tx, id) {
  const studentId = paymentId(id, 'ID do aluno');
  // O lock do aluno serializa renovações manuais e de checkout na mesma vigência.
  await tx.$queryRaw`SELECT id FROM students WHERE id = ${studentId} FOR UPDATE`;
}
function renewalDates(currentEndDate, paidDate, durationDays) {
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3660) throw new AppError('Duração do plano inválida.', 400);
  const startDate = new Date(Math.max(new Date(paidDate).getTime(), currentEndDate ? new Date(currentEndDate).getTime() : 0));
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + durationDays);
  if (!Number.isFinite(endDate.getTime()) || endDate.getUTCFullYear() > 9999) throw new AppError('Vigência inválida.', 400);
  return { startDate, endDate };
}
module.exports = { lockStudent, renewalDates };
