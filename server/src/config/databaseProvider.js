'use strict';

function getDatabaseProvider({ url = process.env.DATABASE_URL, provider = process.env.DATABASE_PROVIDER } = {}) {
  const explicit = provider || undefined;
  if (explicit && !['mysql', 'postgresql'].includes(explicit)) throw new Error('DATABASE_PROVIDER deve ser mysql ou postgresql.');
  let inferred;
  if (url) {
    let protocol;
    try { protocol = new URL(url).protocol; } catch { throw new Error('DATABASE_URL inválida.'); }
    if (protocol === 'mysql:') inferred = 'mysql';
    else if (['postgres:', 'postgresql:'].includes(protocol)) inferred = 'postgresql';
    else throw new Error('Protocolo do banco não suportado.');
  }
  if (explicit && inferred && explicit !== inferred) throw new Error('DATABASE_PROVIDER não corresponde ao protocolo de DATABASE_URL.');
  return explicit || inferred || 'mysql';
}

function getPrismaClientClass() {
  return getDatabaseProvider() === 'postgresql'
    ? require('../../generated/postgresql').PrismaClient
    : require('@prisma/client').PrismaClient;
}

module.exports = { getDatabaseProvider, getPrismaClientClass };
