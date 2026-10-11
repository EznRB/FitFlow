'use strict';
// Monetary arithmetic uses integer centavos, including aggregate Decimal values.
function financialCents(value) {
  const text = String(value ?? '0');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Invalid stored monetary amount');
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('Monetary aggregate exceeds integer precision');
  return cents;
}
function adjustmentTotals(events) {
  let corrections = 0, refunds = 0;
  for (const event of events) {
    if (event.kind === 'correction') corrections += financialCents(event.amount);
    else if (event.kind === 'refund_recorded') refunds += financialCents(event.amount);
    else throw new Error('Unknown stored adjustment kind');
  }
  return { corrections, refunds, adjusted: corrections + refunds };
}
function financialSummary(gross, events) {
  const grossCents = financialCents(gross), { corrections, refunds, adjusted } = adjustmentTotals(events);
  return { grossAmount: grossCents / 100, correctionAmount: corrections / 100, refundRecordedAmount: refunds / 100,
    adjustedAmount: adjusted / 100, netAmount: (grossCents - adjusted) / 100 };
}
async function totalsByPeriod(db, period) {
  const [receipts, adjustments] = await Promise.all([
    db.payment.aggregate({ where: { status: 'paid', ...(period ? { paymentDate: period } : {}) }, _sum: { amount: true }, _count: true }),
    db.paymentAdjustment.groupBy({ by: ['kind'], where: period ? { effectiveDate: period } : {}, _sum: { amount: true }, _count: true })
  ]);
  return { ...financialSummary(receipts._sum.amount, adjustments.map(row => ({ kind: row.kind, amount: row._sum.amount }))),
    paymentCount: receipts._count, adjustmentCount: adjustments.reduce((sum, row) => sum + row._count, 0) };
}
module.exports = { financialCents, adjustmentTotals, financialSummary, totalsByPeriod };
