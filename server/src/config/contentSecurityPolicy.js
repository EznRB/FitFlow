'use strict';
const directives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'none'"],
  // Legacy presentation attributes remain; executable inline handlers do not.
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'"],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'none'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  frameSrc: ["'none'"],
};
const policy = Object.entries(directives).map(([key, values]) => `${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())} ${values.join(' ')}`).join('; ');
module.exports = { directives, policy };
