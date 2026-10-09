// Demonstração local idempotente. Nunca executa no banco original ou em produção.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = new URL(process.env.DATABASE_URL || 'invalid:');
  if (process.env.NODE_ENV === 'production' || process.env.LOCAL_DB_MANAGED !== 'fitflow-native-v1' ||
      url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' || url.port !== '3308' || url.pathname !== '/fitflow_dev') {
    throw new Error('Seed permitido somente no banco demonstrativo local fitflow_dev.');
  }
  const credentialsPath = path.resolve(__dirname, '../.demo-credentials.local.json');
  const definitions = [
    { key: 'admin', name: 'Gestor • demonstração', email: 'gestor@demo.fitflow.local', role: 'admin' },
    { key: 'instructor', name: 'Instrutor • demonstração', email: 'instrutor@demo.fitflow.local', role: 'instructor' },
    { key: 'student', name: 'Aluno • demonstração', email: 'aluno@demo.fitflow.local', role: 'student' },
    { key: 'secondStudent', name: 'Aluna • demonstração', email: 'aluna@demo.fitflow.local', role: 'student' },
    { key: 'blockedStudent', name: 'Plano vencido • demonstração', email: 'vencido@demo.fitflow.local', role: 'student' },
  ];
  // Salva antes de criar contas: permite retomar sem perder credenciais.
  const credentials = fs.existsSync(credentialsPath) ? JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) : {};
  for (const definition of definitions) {
    if (!credentials[definition.key]) credentials[definition.key] = { email: definition.email, password: crypto.randomBytes(18).toString('base64url') };
    if (credentials[definition.key].email !== definition.email || typeof credentials[definition.key].password !== 'string') throw new Error('Credenciais locais incompatíveis; arquivo preservado.');
  }
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600 });
  const prisma = new PrismaClient();
  try {
    const users = {};
    for (const definition of definitions) {
      const { key, ...profile } = definition;
      users[key] = await prisma.user.upsert({ where: { email: profile.email }, update: {},
        create: { ...profile, active: true, passwordHash: await bcrypt.hash(credentials[key].password, 12) } });
    }
    let plan = await prisma.plan.findFirst({ where: { name: 'Mensal • demonstração' } });
    if (!plan) plan = await prisma.plan.create({ data: { name: 'Mensal • demonstração', description: 'Valor fictício para validar gestão; sem cobrança real.', price: '129.90', durationDays: 30 } });
    const now = new Date();
    const end = new Date(now); end.setDate(end.getDate() + 30);
    const expired = new Date(now); expired.setDate(expired.getDate() - 10);
    const students = {};
    for (const key of ['student', 'secondStudent', 'blockedStudent']) {
      students[key] = await prisma.student.upsert({ where: { userId: users[key].id }, update: {}, create: {
        userId: users[key].id, status: key === 'blockedStudent' ? 'blocked' : 'active', planId: plan.id,
        planStartDate: now, planEndDate: key === 'blockedStudent' ? expired : end,
        notes: 'Perfil fictício para testes acadêmicos. Sem dados pessoais reais.' } });
    }
    const demoExercises = [
      { name: 'Agachamento no banco', muscleGroup: 'Quadríceps' },
      { name: 'Supino com halteres', muscleGroup: 'Peito' },
      { name: 'Remada sentada', muscleGroup: 'Costas' },
    ];
    for (const exercise of demoExercises) {
      const found = await prisma.catalogoExercicio.findFirst({ where: { source: 'local', nome: exercise.name } });
      if (!found) await prisma.catalogoExercicio.create({ data: { nome: exercise.name, grupo_muscular: exercise.muscleGroup,
        instrucoes: 'Descrição demonstrativa. Ajustar técnica, amplitude e equipamento com o instrutor.',
        source: 'local', locale: 'pt', curated: true, sourceMetadata: { demo: true, source: 'Descrição local demonstrativa; sem mídia externa.' } } });
    }
    for (const key of ['student', 'secondStudent']) {
      const existing = await prisma.workout.findFirst({ where: { studentId: students[key].id, name: 'Sessão • demonstração' } });
      if (!existing) await prisma.workout.create({ data: { studentId: students[key].id, instructorId: users.instructor.id,
        name: 'Sessão • demonstração', description: 'Exemplo para testar registro de séries. Não representa prescrição individual.',
        notes: 'Carga e progressão dependem da execução e da resposta individual, com supervisão.',
        exercises: { create: demoExercises.map((exercise, index) => ({ ...exercise, sets: 2, reps: '8–12', restSeconds: 120, orderIndex: index + 1 })) } } });
    }
    console.log('Demonstração local preparada. Credenciais individuais em server/.demo-credentials.local.json (ignorado pelo Git).');
    console.log('Seed repetível: preserva contas, senhas, fichas e registros. Nenhum pagamento ou histórico fictício criado.');
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Seed local interrompido. Verifique ambiente, migrações e credenciais; dados preservados.'); process.exitCode = 1; });
