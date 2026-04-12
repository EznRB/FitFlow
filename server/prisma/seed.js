/**
 * ============================================
 * FitFlow Caraguá — Seed do Banco de Dados
 * ============================================
 * Popula o banco com dados iniciais para desenvolvimento:
 * - Admin padrão
 * - Instrutores
 * - Planos
 * - Alunos de exemplo
 * - Exercícios e treinos
 * 
 * Execução: npx prisma db seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // ============================================
  // 1. USUÁRIOS
  // ============================================
  const passwordHash = await bcrypt.hash('admin123', 10);
  const studentHash = await bcrypt.hash('aluno123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fitflow.com' },
    update: {},
    create: {
      name: 'Administrador FitFlow',
      email: 'admin@fitflow.com',
      passwordHash: passwordHash,
      role: 'admin',
      active: true,
    },
  });
  console.log(`✅ Admin criado: ${admin.email} (senha: admin123)`);

  const instructor = await prisma.user.upsert({
    where: { email: 'instrutor@fitflow.com' },
    update: {},
    create: {
      name: 'Carlos Silva',
      email: 'instrutor@fitflow.com',
      passwordHash: passwordHash,
      role: 'instructor',
      active: true,
    },
  });
  console.log(`✅ Instrutor criado: ${instructor.email} (senha: admin123)`);

  const studentUser1 = await prisma.user.upsert({
    where: { email: 'joao@email.com' },
    update: {},
    create: {
      name: 'João Santos',
      email: 'joao@email.com',
      passwordHash: studentHash,
      role: 'student',
      active: true,
    },
  });

  const studentUser2 = await prisma.user.upsert({
    where: { email: 'maria@email.com' },
    update: {},
    create: {
      name: 'Maria Oliveira',
      email: 'maria@email.com',
      passwordHash: studentHash,
      role: 'student',
      active: true,
    },
  });

  const studentUser3 = await prisma.user.upsert({
    where: { email: 'pedro@email.com' },
    update: {},
    create: {
      name: 'Pedro Costa',
      email: 'pedro@email.com',
      passwordHash: studentHash,
      role: 'student',
      active: true,
    },
  });
  console.log(`✅ 3 alunos criados (senha: aluno123)`);

  // ============================================
  // 2. PLANOS
  // ============================================
  const planoMensal = await prisma.plan.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Mensal',
      description: 'Acesso completo à academia por 30 dias.',
      price: 89.90,
      durationDays: 30,
      active: true,
    },
  });

  const planoTrimestral = await prisma.plan.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Trimestral',
      description: 'Acesso completo à academia por 90 dias. Economia de 10%.',
      price: 242.73,
      durationDays: 90,
      active: true,
    },
  });

  const planoSemestral = await prisma.plan.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Semestral',
      description: 'Acesso completo à academia por 180 dias. Economia de 15%.',
      price: 458.49,
      durationDays: 180,
      active: true,
    },
  });

  const planoAnual = await prisma.plan.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: 'Anual',
      description: 'Acesso completo à academia por 365 dias. Melhor custo-benefício!',
      price: 862.08,
      durationDays: 365,
      active: true,
    },
  });
  console.log('✅ 4 planos criados (Mensal, Trimestral, Semestral, Anual)');

  // ============================================
  // 3. ALUNOS (perfis vinculados a users)
  // ============================================
  const today = new Date();
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const ninetyDaysFromNow = new Date(today);
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  // Aluno com plano vencido (para testar bloqueio)
  const tenDaysAgo = new Date(today);
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  const student1 = await prisma.student.upsert({
    where: { userId: studentUser1.id },
    update: {},
    create: {
      userId: studentUser1.id,
      cpf: '123.456.789-00',
      phone: '(12) 99999-1111',
      birthDate: new Date('1995-03-15'),
      address: 'Rua das Palmeiras, 100 - Centro, Caraguatatuba',
      notes: 'Aluno dedicado, treina 5x por semana.',
      status: 'active',
      planId: planoMensal.id,
      planStartDate: today,
      planEndDate: thirtyDaysFromNow,
    },
  });

  const student2 = await prisma.student.upsert({
    where: { userId: studentUser2.id },
    update: {},
    create: {
      userId: studentUser2.id,
      cpf: '987.654.321-00',
      phone: '(12) 99999-2222',
      birthDate: new Date('1998-07-22'),
      address: 'Av. da Praia, 500 - Martim de Sá, Caraguatatuba',
      notes: 'Foco em emagrecimento.',
      status: 'active',
      planId: planoTrimestral.id,
      planStartDate: today,
      planEndDate: ninetyDaysFromNow,
    },
  });

  const student3 = await prisma.student.upsert({
    where: { userId: studentUser3.id },
    update: {},
    create: {
      userId: studentUser3.id,
      cpf: '456.789.123-00',
      phone: '(12) 99999-3333',
      birthDate: new Date('2000-11-10'),
      address: 'Rua do Porto, 200 - Indaiá, Caraguatatuba',
      notes: 'Mensalidade vencida para teste de bloqueio.',
      status: 'blocked',
      planId: planoMensal.id,
      planStartDate: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()),
      planEndDate: tenDaysAgo,
    },
  });
  console.log('✅ 3 perfis de aluno criados (1 bloqueado para teste)');

  // ============================================
  // 4. TREINOS + EXERCÍCIOS
  // ============================================
  // Treino A - Peito e Tríceps (para João)
  const treinoA = await prisma.workout.create({
    data: {
      studentId: student1.id,
      instructorId: instructor.id,
      name: 'Treino A — Peito e Tríceps',
      description: 'Foco em hipertrofia de peito e tríceps. Descanso de 60-90s entre séries.',
      notes: 'Aumentar carga progressivamente a cada 2 semanas.',
      active: true,
      exercises: {
        create: [
          {
            name: 'Supino Reto com Barra',
            muscleGroup: 'Peito',
            sets: 4,
            reps: '8-12',
            restSeconds: 90,
            suggestedLoad: '40kg',
            orderIndex: 1,
          },
          {
            name: 'Supino Inclinado com Halter',
            muscleGroup: 'Peito',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            suggestedLoad: '16kg cada',
            orderIndex: 2,
          },
          {
            name: 'Crucifixo na Máquina',
            muscleGroup: 'Peito',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            suggestedLoad: '25kg',
            notes: 'Focar na contração do peito',
            orderIndex: 3,
          },
          {
            name: 'Tríceps Pulley',
            muscleGroup: 'Tríceps',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            suggestedLoad: '20kg',
            orderIndex: 4,
          },
          {
            name: 'Tríceps Francês',
            muscleGroup: 'Tríceps',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            suggestedLoad: '10kg',
            orderIndex: 5,
          },
        ],
      },
    },
  });

  // Treino B - Costas e Bíceps (para João)
  const treinoB = await prisma.workout.create({
    data: {
      studentId: student1.id,
      instructorId: instructor.id,
      name: 'Treino B — Costas e Bíceps',
      description: 'Foco em costas e bíceps. Manter boa forma na execução.',
      active: true,
      exercises: {
        create: [
          {
            name: 'Puxada Frontal',
            muscleGroup: 'Costas',
            sets: 4,
            reps: '8-12',
            restSeconds: 90,
            suggestedLoad: '45kg',
            orderIndex: 1,
          },
          {
            name: 'Remada Curvada com Barra',
            muscleGroup: 'Costas',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            suggestedLoad: '30kg',
            orderIndex: 2,
          },
          {
            name: 'Remada Unilateral',
            muscleGroup: 'Costas',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            suggestedLoad: '14kg',
            orderIndex: 3,
          },
          {
            name: 'Rosca Direta com Barra',
            muscleGroup: 'Bíceps',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            suggestedLoad: '20kg',
            orderIndex: 4,
          },
          {
            name: 'Rosca Martelo',
            muscleGroup: 'Bíceps',
            sets: 3,
            reps: '12',
            restSeconds: 60,
            suggestedLoad: '10kg cada',
            orderIndex: 5,
          },
        ],
      },
    },
  });

  // Treino para Maria - Treino C - Pernas
  const treinoC = await prisma.workout.create({
    data: {
      studentId: student2.id,
      instructorId: instructor.id,
      name: 'Treino C — Pernas Completo',
      description: 'Treino de pernas focado em força e definição.',
      active: true,
      exercises: {
        create: [
          {
            name: 'Agachamento Livre',
            muscleGroup: 'Pernas',
            sets: 4,
            reps: '8-10',
            restSeconds: 120,
            suggestedLoad: '30kg',
            orderIndex: 1,
          },
          {
            name: 'Leg Press 45°',
            muscleGroup: 'Pernas',
            sets: 4,
            reps: '10-12',
            restSeconds: 90,
            suggestedLoad: '100kg',
            orderIndex: 2,
          },
          {
            name: 'Cadeira Extensora',
            muscleGroup: 'Pernas',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            suggestedLoad: '35kg',
            orderIndex: 3,
          },
          {
            name: 'Mesa Flexora',
            muscleGroup: 'Pernas',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            suggestedLoad: '25kg',
            orderIndex: 4,
          },
          {
            name: 'Panturrilha no Leg Press',
            muscleGroup: 'Pernas',
            sets: 4,
            reps: '15-20',
            restSeconds: 45,
            suggestedLoad: '80kg',
            orderIndex: 5,
          },
        ],
      },
    },
  });
  console.log('✅ 3 treinos criados com exercícios (Treino A, B, C)');

  // ============================================
  // 5. HISTÓRICO DE CARGAS (WORKOUT LOGS)
  // ============================================
  // Pegar exercícios do treino A para criar logs
  const exercisesTreinoA = await prisma.exercise.findMany({
    where: { workoutId: treinoA.id },
    orderBy: { orderIndex: 'asc' },
  });

  if (exercisesTreinoA.length > 0) {
    const daysAgo = (d) => {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      return date;
    };

    // Simula progresso de cargas ao longo de 3 sessões
    for (const day of [7, 4, 1]) {
      for (const ex of exercisesTreinoA) {
        await prisma.workoutLog.create({
          data: {
            studentId: student1.id,
            exerciseId: ex.id,
            weight: parseFloat(ex.suggestedLoad) || 20 + (7 - day) * 2,
            repsCompleted: 12,
            notes: day === 1 ? 'Sentiu facilidade, aumentar carga próxima vez.' : null,
            createdAt: daysAgo(day),
          },
        });
      }
    }
    console.log('✅ Histórico de cargas criado (3 sessões de treino A)');
  }

  // ============================================
  // 6. PAGAMENTOS
  // ============================================
  await prisma.payment.createMany({
    data: [
      {
        studentId: student1.id,
        planId: planoMensal.id,
        amount: 89.90,
        paymentMethod: 'PIX',
        paymentDate: today,
        dueDate: thirtyDaysFromNow,
        status: 'paid',
        registeredBy: admin.id,
      },
      {
        studentId: student2.id,
        planId: planoTrimestral.id,
        amount: 242.73,
        paymentMethod: 'Cartão de Crédito',
        paymentDate: today,
        dueDate: ninetyDaysFromNow,
        status: 'paid',
        registeredBy: admin.id,
      },
      {
        studentId: student3.id,
        planId: planoMensal.id,
        amount: 89.90,
        paymentMethod: 'Dinheiro',
        paymentDate: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()),
        dueDate: tenDaysAgo,
        status: 'overdue',
        notes: 'Aluno notificado por WhatsApp.',
        registeredBy: admin.id,
      },
    ],
  });
  console.log('✅ 3 pagamentos criados (2 pagos, 1 vencido)');

  // ============================================
  // 7. CHECK-INS
  // ============================================
  const checkinDays = [5, 4, 3, 2, 1, 0]; // últimos 6 dias
  for (const daysBack of checkinDays) {
    const checkinDate = new Date(today);
    checkinDate.setDate(checkinDate.getDate() - daysBack);
    
    // João faz check-in todos os dias
    await prisma.checkin.create({
      data: {
        studentId: student1.id,
        checkinDate: checkinDate,
        checkinTime: new Date(`2000-01-01T${7 + Math.floor(Math.random() * 3)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:00`),
      },
    }).catch(() => {}); // Ignora se já existe (unique constraint)

    // Maria faz check-in em dias alternados
    if (daysBack % 2 === 0) {
      await prisma.checkin.create({
        data: {
          studentId: student2.id,
          checkinDate: checkinDate,
          checkinTime: new Date(`2000-01-01T${17 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:00`),
        },
      }).catch(() => {});
    }
  }
  console.log('✅ Check-ins criados (última semana)');

  // ============================================
  console.log('\n✨ Seed concluído com sucesso!\n');
  console.log('📋 Credenciais de acesso:');
  console.log('   Admin:     admin@fitflow.com     / admin123');
  console.log('   Instrutor: instrutor@fitflow.com  / admin123');
  console.log('   Alunos:    joao@email.com         / aluno123');
  console.log('              maria@email.com        / aluno123');
  console.log('              pedro@email.com (bloqueado) / aluno123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro no seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
