'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
if (process.env.NEON_PROJECT_ID !== 'mute-night-99440749' || process.env.NEON_BRANCH_ID !== 'br-tiny-king-b6carztp') throw new Error('Projeto FitFlow explícito obrigatório.');
const { getPrismaClientClass } = require('../src/config/databaseProvider');
const db = new (getPrismaClientClass())({ log: [] });
let statementIndex = -1;
(async () => {
  try {
    const privateFile = path.resolve(__dirname, '../.env.remote.runtime.local');
    const [existing] = await db.$queryRaw`SELECT rolname FROM pg_roles WHERE rolname='fitflow_app'`;
    if (existing && !fs.existsSync(privateFile)) throw new Error('Credencial do papel existente não disponível; nenhum reset permitido.');
    if (!existing) {
      const password = randomBytes(32).toString('hex');
      if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Formato de credencial inesperado.');
      const direct = new URL(process.env.DIRECT_URL); direct.username='fitflow_app'; direct.password=password;
      const pooled = new URL(process.env.DATABASE_URL); pooled.username='fitflow_app'; pooled.password=password;
      const vars = {DATABASE_PROVIDER:'postgresql',DATABASE_URL:pooled.href,DIRECT_URL:direct.href,
        NEON_PROJECT_ID:process.env.NEON_PROJECT_ID,NEON_BRANCH_ID:process.env.NEON_BRANCH_ID,
        NODE_ENV:'production',JWT_SECRET:randomBytes(48).toString('hex'),CORS_ORIGIN:'https://fit-flow-indol.vercel.app'};
      fs.writeFileSync(privateFile,Object.entries(vars).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n');
      // PostgreSQL role DDL cannot bind PASSWORD as a query parameter. The value is
      // generated here and restricted to hexadecimal, never supplied by a caller.
      await db.$executeRawUnsafe("CREATE ROLE fitflow_app LOGIN PASSWORD '"+password+"' NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
    }
    const [privileged] = await db.$queryRaw`SELECT pg_has_role('fitflow_app','neon_superuser','member') AS member`;
    if (privileged?.member) throw new Error('Não modificar um papel administrativo como runtime.');
    const statements = fs.readFileSync(path.resolve(__dirname, '../prisma/postgresql/runtime-privileges.sql'), 'utf8')
      .replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean);
    await db.$transaction(async tx => { for (let index = 0; index < statements.length; index++) { statementIndex = index; await tx.$executeRawUnsafe(statements[index]); } });
    const [role] = await db.$queryRaw`SELECT rolcreatedb, rolcreaterole, rolbypassrls,
      pg_has_role('fitflow_app', 'neon_superuser', 'member') AS privileged_member
      FROM pg_roles WHERE rolname = 'fitflow_app'`;
    if (!role || Object.values(role).some(Boolean)) throw new Error('Permissões administrativas ainda presentes.');
    console.log('Credencial runtime sem criação de bancos/papéis, bypass RLS ou neon_superuser.');
  } finally { await db.$disconnect(); }
})().catch(error => { console.error('Permissões não confirmadas:', error.code || error.name, 'SQLSTATE', String(error.meta?.code || 'none'), 'statement', statementIndex + 1); process.exitCode = 1; });
