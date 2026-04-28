const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MOCK_DOMAIN = '@mock.fitflow.com';

async function run() {
  console.log('🧹 Iniciando limpeza da massa de testes...');

  // Busca todos os usuários de teste
  const users = await prisma.user.findMany({
    where: { email: { endsWith: MOCK_DOMAIN } },
    select: { id: true }
  });

  if (users.length === 0) {
    console.log('Nenhum usuário mock encontrado.');
    return;
  }

  const userIds = users.map(u => u.id);

  // Busca os estudantes vinculados
  const students = await prisma.student.findMany({
    where: { userId: { in: userIds } },
    select: { id: true }
  });
  
  const studentIds = students.map(s => s.id);

  console.log(`Encontrados ${userIds.length} usuários mock e ${studentIds.length} profiles de alunos. Excluindo dependências...`);

  // Excluir Checkins (sem cascade nativo no Prisma neste schema)
  if (studentIds.length > 0) {
    const resCheckins = await prisma.checkin.deleteMany({
      where: { studentId: { in: studentIds } }
    });
    console.log(`- ${resCheckins.count} check-ins excluídos.`);

    // Excluir Pagamentos
    const resPayments = await prisma.payment.deleteMany({
      where: { studentId: { in: studentIds } }
    });
    console.log(`- ${resPayments.count} pagamentos excluídos.`);

    // Excluir WorkoutLogs
    const resLogs = await prisma.workoutLog.deleteMany({
      where: { studentId: { in: studentIds } }
    });
    console.log(`- ${resLogs.count} históricos de treino excluídos.`);

    // Excluir Workouts
    const resWorkouts = await prisma.workout.deleteMany({
      where: { studentId: { in: studentIds } }
    });
    console.log(`- ${resWorkouts.count} fichas de treino excluídas.`);

    // Excluir Students
    const resStudents = await prisma.student.deleteMany({
      where: { id: { in: studentIds } }
    });
    console.log(`- ${resStudents.count} alunos excluídos.`);
  }

  // Por fim, excluir Users
  const resUsers = await prisma.user.deleteMany({
    where: { id: { in: userIds } }
  });
  console.log(`- ${resUsers.count} contas de usuário excluídas.`);

  // Limpa o catálogo de exercícios se necessário
  console.log('Deseja limpar o catálogo de exercícios? (Mantido por padrão para não quebrar a UI, apenas limpo ao rodar o seed novamente).');

  console.log('✅ Limpeza concluída! A base de dados está pronta para produção.');
}

run()
  .catch(e => {
    console.error('Erro na limpeza:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
