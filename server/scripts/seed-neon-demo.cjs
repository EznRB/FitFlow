'use strict';

// Executar somente com with-neon-owner-env.cjs. A origem local fornece apenas o catálogo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const credentialsPath = path.resolve(__dirname, '../.demo-credentials.remote.local.json');
const definitions = [
  { key: 'admin', name: 'Gestor • demonstração', email: 'gestor@demo.fitflow.local', role: 'admin' },
  { key: 'instructor', name: 'Instrutor • demonstração', email: 'instrutor@demo.fitflow.local', role: 'instructor' },
  { key: 'student', name: 'Aluno • demonstração', email: 'aluno@demo.fitflow.local', role: 'student' },
  { key: 'secondStudent', name: 'Aluna • demonstração', email: 'aluna@demo.fitflow.local', role: 'student' },
  { key: 'blockedStudent', name: 'Plano vencido • demonstração', email: 'vencido@demo.fitflow.local', role: 'student' },
];

function assertTargets(remote, local) {
  const refuse = () => { throw new Error('Seed restrito ao novo Neon FitFlow e ao catálogo nativo gerenciado.'); };
  if (remote.NODE_ENV !== 'development' || remote.DATABASE_PROVIDER !== 'postgresql'
    || remote.NEON_PROJECT_ID !== 'mute-night-99440749' || remote.NEON_BRANCH_ID !== 'br-tiny-king-b6carztp') refuse();
  let pooled; let direct; let source;
  try { pooled = new URL(remote.DATABASE_URL); direct = new URL(remote.DIRECT_URL); source = new URL(local.DATABASE_URL); } catch { refuse(); }
  const directHost = 'ep-jolly-grass-b6jl6hjo.c-2.sa-east-1.aws.neon.tech';
  for (const [url, host] of [[pooled, directHost.replace('.c-2.', '-pooler.c-2.')], [direct, directHost]]) {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== host
      || url.pathname !== '/fitflow' || url.username !== 'fitflow_owner'
      || url.searchParams.get('sslmode') !== 'require' || url.searchParams.get('sslaccept') !== 'strict') refuse();
  }
  if (local.LOCAL_DB_MANAGED !== 'fitflow-native-v1' || source.protocol !== 'mysql:'
    || source.hostname !== '127.0.0.1' || source.port !== '3308' || source.pathname !== '/fitflow_dev') refuse();
}

async function verifyExistingAccounts(prisma, credentials) {
  for (const definition of definitions) {
    const saved = credentials[definition.key];
    if (saved && (saved.email !== definition.email || typeof saved.password !== 'string' || saved.password.length < 20)) {
      throw new Error('Arquivo de credenciais remotas incompatível; preservado.');
    }
    const existing = await prisma.user.findUnique({ where: { email: definition.email } });
    if (existing && (existing.name !== definition.name || existing.role !== definition.role
      || !saved || !await bcrypt.compare(saved.password, existing.passwordHash))) {
      throw new Error('Colisão de conta: seed não altera contas ou senhas preexistentes.');
    }
  }
}

function catalogData(record, Prisma) {
  return {
    nome: record.nome, grupo_muscular: record.grupo_muscular,
    instrucoes: record.instrucoes, imagem_url: record.imagem_url, ativo: record.ativo,
    source: record.source, externalId: record.externalId, locale: record.locale,
    curated: record.curated, sourceMetadata: record.sourceMetadata === null ? Prisma.DbNull : record.sourceMetadata,
  };
}

async function main() {
  const local = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.development.local')));
  assertTargets(process.env, local);
  const { PrismaClient: MysqlClient } = require('@prisma/client');
  const { PrismaClient: PostgresClient, Prisma } = require('../generated/postgresql');
  // Explicit constructor overrides prevent access to inherited or original database URLs.
  const mysql = new MysqlClient({ datasources: { db: { url: local.DATABASE_URL } }, log: [] });
  const postgres = new PostgresClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: [] });
  try {
    const credentials = fs.existsSync(credentialsPath) ? JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) : {};
    await verifyExistingAccounts(postgres, credentials);
    // This is the only query issued to MySQL: no personal data, session, QA or financial records.
    const catalog = await mysql.catalogoExercicio.findMany({ select: {
      nome: true, grupo_muscular: true, instrucoes: true, imagem_url: true, ativo: true,
      source: true, externalId: true, locale: true, curated: true, sourceMetadata: true,
    }, orderBy: { id: 'asc' } });
    if (!catalog.length || catalog.some(record => !record.nome || !record.grupo_muscular
      || !['local', 'wger'].includes(record.source) || (record.source !== 'local' && !record.externalId))) {
      throw new Error('Catálogo nativo vazio ou incompatível; nenhuma cópia executada.');
    }
    for (const definition of definitions) {
      if (!credentials[definition.key]) credentials[definition.key] = {
        email: definition.email, password: crypto.randomBytes(24).toString('base64url'),
      };
    }
    // Persist before inserts: interruption can be resumed without resetting passwords.
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600 });
    const hashes = {};
    for (const definition of definitions) hashes[definition.key] = await bcrypt.hash(credentials[definition.key].password, 12);
    await postgres.$transaction(async tx => {
      // Recheck inside the transaction to reject a concurrently introduced collision.
      await verifyExistingAccounts(tx, credentials);
      const users = {};
      for (const { key, ...profile } of definitions) users[key] = await tx.user.upsert({
        where: { email: profile.email }, update: {},
        create: { ...profile, active: true, passwordHash: hashes[key] },
      });
      let plan = await tx.plan.findFirst({ where: { name: 'Mensal • demonstração' } });
      const planDescription = 'Valor fictício para validar gestão; sem cobrança real.';
      if (plan && plan.description !== planDescription) throw new Error('Colisão de plano demonstrativo.');
      if (!plan) plan = await tx.plan.create({ data: {
        name: 'Mensal • demonstração', description: planDescription, price: '129.90', durationDays: 30,
      } });
      // Civil date uses today's São Paulo date and UTC midnight for PostgreSQL DATE.
      const civil = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const now = new Date(`${civil}T00:00:00.000Z`);
      const end = new Date(now); end.setUTCDate(end.getUTCDate() + 30);
      const expired = new Date(now); expired.setUTCDate(expired.getUTCDate() - 10);
      const students = {};
      const studentNotes = 'Perfil fictício para testes acadêmicos. Sem dados pessoais reais.';
      for (const key of ['student', 'secondStudent', 'blockedStudent']) {
        const existing = await tx.student.findUnique({ where: { userId: users[key].id } });
        if (existing && existing.notes !== studentNotes) throw new Error('Colisão de perfil demonstrativo.');
        students[key] = await tx.student.upsert({ where: { userId: users[key].id }, update: {}, create: {
          userId: users[key].id, status: key === 'blockedStudent' ? 'blocked' : 'active', planId: plan.id,
          planStartDate: now, planEndDate: key === 'blockedStudent' ? expired : end, notes: studentNotes,
        } });
      }
      const exercises = [
        { name: 'Agachamento no banco', muscleGroup: 'Quadríceps' },
        { name: 'Supino com halteres', muscleGroup: 'Peito' },
        { name: 'Remada sentada', muscleGroup: 'Costas' },
      ];
      for (const key of ['student', 'secondStudent']) {
        const existing = await tx.workout.findFirst({ where: { studentId: students[key].id, name: 'Sessão • demonstração' } });
        if (!existing) await tx.workout.create({ data: {
          studentId: students[key].id, instructorId: users.instructor.id, name: 'Sessão • demonstração',
          description: 'Exemplo para testar registro de séries. Não representa prescrição individual.',
          notes: 'Carga e progressão dependem da execução e da resposta individual, com supervisão.',
          exercises: { create: exercises.map((exercise, index) => ({ ...exercise, sets: 2, reps: '8–12', restSeconds: 120, orderIndex: index + 1 })) },
        } });
      }
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 60000 });
    let created = 0;
    for (const record of catalog) {
      const data = catalogData(record, Prisma);
      if (record.externalId) {
        await postgres.catalogoExercicio.upsert({ where: { source_externalId: { source: record.source, externalId: record.externalId } }, update: {}, create: data });
      } else {
        const existing = await postgres.catalogoExercicio.findFirst({ where: { source: record.source, nome: record.nome, externalId: null } });
        if (!existing) { await postgres.catalogoExercicio.create({ data }); created += 1; }
      }
    }
    console.log(`Demonstração remota preparada: 5 contas, 3 perfis de aluno, 2 fichas; ${catalog.length} exercícios conferidos (${created} locais novos).`);
    console.log('Credenciais individuais: server/.demo-credentials.remote.local.json (ignorado pelo Git).');
    console.log('Contas, senhas e edições existentes preservadas. Nenhum histórico, sessão, pagamento ou dado pessoal copiado.');
  } finally { await Promise.allSettled([mysql.$disconnect(), postgres.$disconnect()]); }
}

module.exports = { assertTargets, verifyExistingAccounts, definitions };
if (require.main === module) main().catch(() => {
  console.error('Seed remoto interrompido. Verifique alvo, conectividade e colisões; dados e senhas existentes preservados.');
  process.exitCode = 1;
});
