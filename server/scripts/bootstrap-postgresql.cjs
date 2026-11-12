'use strict';
// First installation only. Applied migration names/checksums are preserved.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });

async function run() {
  if (process.argv.length !== 3 || process.argv[2] !== '--empty-database') throw new Error('Primeira instalação exige --empty-database; para instalações existentes use migrate deploy.');
  const direct = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!direct) throw new Error('Primeira instalação exige DIRECT_URL ou DATABASE_URL_UNPOOLED; não use conexão pooled.');
  const target = new URL(direct);
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !target.hostname || !target.pathname.slice(1) ||
      /-pooler\./i.test(target.hostname) || ![null, 'public'].includes(target.searchParams.get('schema'))) throw new Error('Informe uma conexão PostgreSQL direta com schema public.');
  const { PrismaClient } = require('../generated/postgresql');
  const db = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] });
  let locked = false;
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...args], {
      cwd: root, windowsHide: true, stdio: 'inherit',
      env: { ...process.env, DATABASE_PROVIDER: 'postgresql', DATABASE_URL: target.href, DIRECT_URL: target.href },
    });
    if (result.status !== 0) throw new Error('Etapa de instalação falhou; preserve o diagnóstico e não use reset nem repita o bootstrap em banco parcial.');
  };
  try {
    const [lock] = await db.$queryRaw`SELECT pg_try_advisory_lock(1179210822, 1111577413) AS locked`;
    if (!lock.locked) throw new Error('Já há uma primeira instalação em andamento neste banco.');
    locked = true;
    const [state] = await db.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public', 'information_schema') AND nspname !~ '^pg_'
        UNION ALL
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
        UNION ALL
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
        UNION ALL
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public'
      ) AS occupied`;
    if (state.occupied) throw new Error('Banco não está vazio. Primeira instalação recusada; nenhum objeto será removido ou adotado.');
    // The historical folder is named baseline, so migrate deploy sorts later
    // than dated migrations. Apply it first and register its original checksum.
    cli('db', 'execute', '--schema', 'prisma/postgresql/schema.prisma', '--file', 'prisma/postgresql/migrations/baseline/migration.sql');
    cli('migrate', 'resolve', '--applied', 'baseline');
    cli('migrate', 'deploy');
    console.log('Primeira instalação PostgreSQL concluída. Nenhuma conta de demonstração foi criada.');
  } finally {
    try { if (locked) await db.$queryRaw`SELECT pg_advisory_unlock(1179210822, 1111577413)`; }
    finally { await db.$disconnect(); }
  }
}
run().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
