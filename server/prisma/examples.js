/**
 * ============================================
 * FitFlow Caraguá — Exemplos de Queries (Prisma)
 * ============================================
 * Referência rápida de como usar o Prisma Client
 * para as operações mais comuns do sistema.
 * 
 * ⚠️ Este arquivo é APENAS para documentação.
 *    Não é executado pelo sistema.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================
// 1. USUÁRIOS
// ============================================

// Buscar usuário por email (para login)
async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    include: { student: true },
  });
}

// Criar novo usuário
async function createUser(name, email, passwordHash, role) {
  return prisma.user.create({
    data: { name, email, passwordHash, role },
  });
}

// ============================================
// 2. ALUNOS
// ============================================

// Listar alunos ativos com plano
async function listActiveStudents() {
  return prisma.student.findMany({
    where: { status: 'active' },
    include: {
      user: { select: { name: true, email: true } },
      plan: { select: { name: true, price: true } },
    },
  });
}

// Buscar aluno com treinos e exercícios
async function getStudentWithWorkouts(studentId) {
  return prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { name: true } },
      workouts: {
        where: { active: true },
        include: {
          exercises: { orderBy: { orderIndex: 'asc' } },
          instructor: { select: { name: true } },
        },
      },
    },
  });
}

// Bloquear aluno por inadimplência
async function blockStudent(studentId) {
  return prisma.student.update({
    where: { id: studentId },
    data: { status: 'blocked' },
  });
}

// ============================================
// 3. TREINOS
// ============================================

// Criar treino com exercícios (transação automática)
async function createWorkoutWithExercises(studentId, instructorId, name, exercises) {
  return prisma.workout.create({
    data: {
      studentId,
      instructorId,
      name,
      exercises: {
        create: exercises.map((ex, i) => ({
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.restSeconds,
          suggestedLoad: ex.suggestedLoad,
          orderIndex: i + 1,
        })),
      },
    },
    include: { exercises: { orderBy: { orderIndex: 'asc' } } },
  });
}

// ============================================
// 4. HISTÓRICO DE CARGAS (WORKOUT LOGS)
// ============================================

// Registrar carga (append-only)
async function logWeight(studentId, exerciseId, weight, repsCompleted) {
  return prisma.workoutLog.create({
    data: { studentId, exerciseId, weight, repsCompleted },
  });
}

// Progressão de cargas de um exercício
async function getWeightProgression(studentId, exerciseId) {
  return prisma.workoutLog.findMany({
    where: { studentId, exerciseId },
    orderBy: { createdAt: 'asc' },
    select: { weight: true, repsCompleted: true, createdAt: true },
  });
}

// ============================================
// 5. PAGAMENTOS
// ============================================

// Registrar pagamento
async function registerPayment(studentId, planId, amount, method) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (plan?.durationDays || 30));

  return prisma.payment.create({
    data: {
      studentId,
      planId,
      amount,
      paymentMethod: method,
      paymentDate: new Date(),
      dueDate,
      status: 'paid',
    },
  });
}

// Receita do mês atual
async function getMonthlyRevenue() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return prisma.payment.aggregate({
    where: {
      status: 'paid',
      paymentDate: { gte: firstDay, lte: lastDay },
    },
    _sum: { amount: true },
    _count: true,
  });
}

// ============================================
// 6. CHECK-INS
// ============================================

// Registrar check-in (unique por dia)
async function doCheckin(studentId) {
  return prisma.checkin.create({
    data: {
      studentId,
      checkinDate: new Date(),
      checkinTime: new Date(),
    },
  });
}

// Check-ins de hoje
async function getTodayCheckins() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.checkin.findMany({
    where: { checkinDate: { gte: today, lt: tomorrow } },
    include: { student: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

// ============================================
// 7. DASHBOARD KPIs
// ============================================
async function getDashboardData() {
  const [totalStudents, activeStudents, todayCheckins, monthRevenue] =
    await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'active' } }),
      prisma.checkin.count({
        where: {
          checkinDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      getMonthlyRevenue(),
    ]);

  return {
    totalStudents,
    activeStudents,
    todayCheckins,
    monthlyRevenue: monthRevenue._sum.amount || 0,
  };
}
