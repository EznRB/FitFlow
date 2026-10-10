'use strict';
// Creates only the first administrator. Never resets credentials or seeds demo data.
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { validateAccount } = require('../src/utils/accountValidation');
class BootstrapError extends Error {}

async function createFirstAdmin(db, credentials) {
  const { name, email, password } = validateAccount(credentials);
  if (password.length < 16) throw new BootstrapError('Use uma senha individual com pelo menos 16 caracteres.');
  const passwordHash = await bcrypt.hash(password, 12);
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        if (await tx.user.count({ where: { role: 'admin' } })) {
          throw new BootstrapError('Já existe um administrador; nenhuma conta foi alterada.');
        }
        if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
          throw new BootstrapError('E-mail já cadastrado; nenhuma conta foi alterada.');
        }
        return tx.user.create({ data: { name, email, passwordHash, role: 'admin', active: true }, select: { id: true } });
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
}

function parseArguments(args, databaseUrl) {
  const values = {};
  const allowed = new Set(['--credentials-file', '--database-host', '--database-name']);
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.has(args[i]) || values[args[i]] || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new BootstrapError('Informe --credentials-file, --database-host e --database-name, sem senhas na linha de comando.');
    }
    values[args[i]] = args[i + 1];
  }
  if (Object.keys(values).length !== 3) throw new BootstrapError('Confirme explicitamente o arquivo privado, host e nome do banco.');
  let url;
  try { url = new URL(databaseUrl); } catch { throw new BootstrapError('DATABASE_URL ausente ou inválida.'); }
  if (!['mysql:', 'postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== values['--database-host'] || decodeURIComponent(url.pathname.slice(1)) !== values['--database-name']) {
    throw new BootstrapError('Host/nome não correspondem à DATABASE_URL; operação interrompida.');
  }
  return path.resolve(values['--credentials-file']);
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  const file = parseArguments(process.argv.slice(2), process.env.DATABASE_URL);
  if (fs.statSync(file).size > 4096) throw new BootstrapError('Arquivo privado de cadastro muito grande.');
  let credentials;
  try { credentials = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new BootstrapError('Arquivo privado deve conter JSON válido com name, email e password.'); }
  const { getPrismaClientClass } = require('../src/config/databaseProvider');
  const PrismaClient = getPrismaClientClass();
  const db = new PrismaClient({ log: [] });
  try {
    await createFirstAdmin(db, credentials);
    console.log('Primeiro administrador criado. Credenciais não exibidas; use o arquivo privado para entrar.');
  } finally { await db.$disconnect(); }
}
if (require.main === module) main().catch(error => {
  // Prisma/IO diagnostics may include database URLs or data; never print them.
  console.error(error instanceof BootstrapError || error.statusCode === 400 ? error.message : 'Bootstrap interrompido; confira banco, migrations e arquivo privado. Nenhuma credencial exibida.');
  process.exitCode = 1;
});
module.exports = { createFirstAdmin, parseArguments };
