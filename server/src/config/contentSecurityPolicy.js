'use strict';
const directives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https://sdk.mercadopago.com', 'https://http2.mlstatic.com'],
  scriptSrcAttr: ["'none'"],
  // Legacy presentation attributes remain; executable inline handlers do not.
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https://api.mercadopago.com', 'https://api-static.mercadopago.com', 'https://api.mercadolibre.com', 'https://http2.mlstatic.com'],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'none'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  frameSrc: ['https://secure-fields.mercadopago.com', 'https://api-static.mercadopago.com', 'https://www.mercadopago.com.br', 'https://sdk.mercadopago.com'],
};
const policy = Object.entries(directives).map(([key, values]) => `${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())} ${values.join(' ')}`).join('; ');
module.exports = { directives, policy };
