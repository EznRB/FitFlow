const AppError = require('../utils/AppError');
const { createMercadoPagoAdapter } = require('./mercado-pago.adapter');

// O contrato separa a comunicação do provedor do livro financeiro do FitFlow.
// getPayment/findPayment retornam recursos da API, nunca alegações do cliente.
const CHECKOUT_PROVIDER_METHODS = Object.freeze([
  'ensureSandbox', 'createPreference', 'getPayment', 'findPayment', 'verifyWebhook'
]);

function assertCheckoutProvider(provider) {
  if (!provider || typeof provider.enabled !== 'boolean' ||
    CHECKOUT_PROVIDER_METHODS.some(method => typeof provider[method] !== 'function')) {
    throw new TypeError('Adaptador de checkout não implementa o contrato do FitFlow.');
  }
  return provider;
}

// Somente provedores reais implementados podem ser selecionados. Sem credenciais
// da conta, o adaptador permanece desativado; não há simulador no aplicativo.
function createCheckoutProvider({ name = 'mercado_pago', ...adapterOptions } = {}) {
  if (name !== 'mercado_pago') throw new AppError('Provedor de checkout indisponível.', 503);
  return assertCheckoutProvider(createMercadoPagoAdapter(adapterOptions));
}

module.exports = { createCheckoutProvider, assertCheckoutProvider, CHECKOUT_PROVIDER_METHODS };
