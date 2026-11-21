const AppError = require('../utils/AppError');
const { moneyCents } = require('../utils/paymentValidation');
const invalid = () => new AppError('Dados de pagamento inválidos. Confira o formulário e tente novamente.', 400);
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw invalid();
  return value;
}
function alias(data, snake, camel) {
  if (data[snake] !== undefined && data[camel] !== undefined && data[snake] !== data[camel]) throw invalid();
  return data[snake] ?? data[camel];
}
function validateBrickSubmission(data) {
  object(data, ['selectedPaymentMethod', 'formData']);
  if (!['credit_card', 'debit_card', 'bank_transfer'].includes(data.selectedPaymentMethod)) throw invalid();
  const form = object(data.formData, ['token', 'transaction_amount', 'installments', 'payment_method_id', 'paymentMethodId', 'issuer_id', 'issuerId', 'payer']);
  const method = alias(form, 'payment_method_id', 'paymentMethodId');
  if (typeof method !== 'string' || !/^[a-z][a-z0-9_]{1,40}$/.test(method)) throw invalid();
  const pix = data.selectedPaymentMethod === 'bank_transfer';
  if (pix !== (method === 'pix')) throw invalid();
  const payer = object(form.payer, ['email', 'identification']);
  if (payer.email !== undefined && (typeof payer.email !== 'string' || payer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email))) throw invalid();
  const result = { payment_method_id: method, payer: {} };
  if (!pix || payer.identification !== undefined) {
    const identification = object(payer.identification, ['type', 'number']);
    if (!['CPF', 'CNPJ'].includes(identification.type) || typeof identification.number !== 'string' ||
      !new RegExp(identification.type === 'CPF' ? '^\\d{11}$' : '^\\d{14}$').test(identification.number)) throw invalid();
    result.payer.identification = { type: identification.type, number: identification.number };
  }
  if (pix) {
    if (form.token !== undefined || form.installments !== undefined || form.issuer_id !== undefined || form.issuerId !== undefined) throw invalid();
  } else {
    if (form.installments !== 1 || typeof form.token !== 'string' || !/^[A-Za-z0-9_-]{8,256}$/.test(form.token)) throw invalid();
    result.token = form.token;
    result.installments = 1;
    const issuer = alias(form, 'issuer_id', 'issuerId');
    if (issuer !== undefined && issuer !== null && issuer !== '') {
      if (!['string', 'number'].includes(typeof issuer) || !/^[1-9]\d{0,19}$/.test(String(issuer))) throw invalid();
      result.issuer_id = String(issuer);
    }
  }
  return result;
}
function buildPaymentPayload(trustedPurchase, submission, config) {
  const amount = moneyCents(String(trustedPurchase.amount)) / 100;
  if (!(amount > 0)) throw invalid();
  return { ...submission, transaction_amount: amount, description: 'FitFlow — mensalidade',
    payer: { ...submission.payer, email: config.buyerEmail }, external_reference: trustedPurchase.id,
    metadata: { fitflow_intent_id: trustedPurchase.id }, notification_url: `${config.baseUrl.replace(/\/$/, '')}/api/checkout/webhook` };
}
module.exports = { validateBrickSubmission, buildPaymentPayload };
