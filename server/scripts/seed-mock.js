const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

const MOCK_DOMAIN = '@mock.fitflow.com';
const NUM_ALUNOS = 100;

async function run() {
  console.log('🚀 Iniciando geração de massa de testes (100 usuários)...');

  // 1. Restaurando o Catálogo de Exercícios (Mínimo de 15 exercícios)
  console.log('📚 Gerando Catálogo de Exercícios...');
  const exercicios = [
    { nome: 'Supino Reto com Barra', grupo_muscular: 'Peito', instrucoes: 'Desça a barra até o peito e empurre.', ativo: true },
    { nome: 'Supino Inclinado com Halteres', grupo_muscular: 'Peito', instrucoes: 'Incline o banco a 30-45 graus.', ativo: true },
    { coil: 'Crucifixo Máquina', grupo_muscular: 'Peito', instrucoes: 'Mantenha os cotovelos levemente flexionados.', ativo: true },
    { nome: 'Puxada Frontal', grupo_muscular: 'Costas', instrucoes: 'Puxe a barra em direção ao peito.', ativo: true },
    { nome: 'Remada Curvada', grupo_muscular: 'Costas', instrucoes: 'Mantenha a coluna reta e puxe a barra.', ativo: true },
    { nome: 'Levantamento Terra', grupo_muscular: 'Costas', instrucoes: 'Mantenha a lombar travada durante a execução.', ativo: true },
    { nome: 'Agachamento Livre', grupo_muscular: 'Pernas', instrucoes: 'Desça até quebrar a paralela, coluna ereta.', ativo: true },
    { nome: 'Leg Press 45', grupo_muscular: 'Pernas', instrucoes: 'Não estenda completamente os joelhos no topo.', ativo: true },
    { nome: 'Cadeira Extensora', grupo_muscular: 'Pernas', instrucoes: 'Contraia o quadríceps no pico do movimento.', ativo: true },
    { nome: 'Mesa Flexora', grupo_muscular: 'Pernas', instrucoes: 'Controle a fase excêntrica do movimento.', ativo: true },
    { nome: 'Elevação Lateral', grupo_muscular: 'Ombros', instrucoes: 'Eleve os halteres até a linha do ombro.', ativo: true },
    { nome: 'Desenvolvimento com Halteres', grupo_muscular: 'Ombros', instrucoes: 'Não deixe os halteres baterem no topo.', ativo: true },
    { nome: 'Rosca Direta', grupo_muscular: 'Bíceps', instrucoes: 'Evite usar o impulso do corpo (roubar).', ativo: true },
    { nome: 'Tríceps Pulley', grupo_muscular: 'Tríceps', instrucoes: 'Mantenha os cotovelos colados ao corpo.', ativo: true },
    { nome: 'Abdominal Supra', grupo_muscular: 'Abdômen', instrucoes: 'Contraia o abdômen e expire ao subir.', ativo: true },
  ];

  // Fix typo in array
  exercicios[2].nome = exercicios[2].coil;
  delete exercicios[2].coil;

  // Limpa catálogo antigo gerado pelo mock (para evitar duplicidade no rerun)
  await prisma.catalogoExercicio.deleteMany();
  await prisma.catalogoExercicio.createMany({ data: exercicios });

  // 2. Garantir que existem planos
  console.log('💳 Verificando Planos...');
  let planoMensal = await prisma.plan.findFirst({ where: { name: 'Mensal Mock' } });
  if (!planoMensal) {
    planoMensal = await prisma.plan.create({
      data: { name: 'Mensal Mock', description: 'Plano de teste', price: 99.90, durationDays: 30 }
    });
  }

  // 3. Criando Alunos (Users + Students)
  console.log(`👥 Gerando ${NUM_ALUNOS} Alunos...`);
  const passwordHash = await bcrypt.hash('senha123', 10);
  
  const now = new Date();
  let criados = 0;

  // Em vez de fazer 1 a 1 que é devagar, faremos Promise.all em lotes de 10
  const lotes = Math.ceil(NUM_ALUNOS / 10);
  
  for (let i = 0; i < lotes; i++) {
    const promises = [];
    for (let j = 0; j < 10; j++) {
      const idx = i * 10 + j;
      if (idx >= NUM_ALUNOS) break;
      
      const email = `aluno${idx}${MOCK_DOMAIN}`;
      const nome = `Aluno Teste ${idx}`;
      // Status aleatório (90% active, 10% blocked)
      const status = Math.random() > 0.9 ? 'blocked' : 'active';
      
      promises.push(
        prisma.user.upsert({
          where: { email },
          update: {},
          create: {
            name: nome,
            email,
            passwordHash,
            role: 'student',
            active: true,
            student: {
              create: {
                status,
                planId: planoMensal.id,
                planStartDate: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
                planEndDate: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
              }
            }
          },
          include: { student: true }
        })
      );
    }
    const usuarios = await Promise.all(promises);
    criados += usuarios.length;
    
    // Para cada usuário criado, gerar histórico
    console.log(`⏳ Gerando histórico financeiro e frequência para o lote ${i + 1}/${lotes}...`);
    for (const u of usuarios) {
      if (!u.student) continue;
      
      const studentId = u.student.id;
      
      // Criar 1 pagamento pago e 1 pendente (ou overdue se bloqueado)
      await prisma.payment.createMany({
        data: [
          {
            studentId,
            planId: planoMensal.id,
            amount: 99.90,
            paymentMethod: 'PIX',
            paymentDate: new Date(now.getFullYear(), now.getMonth() - 1, 15),
            dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 15),
            status: 'paid'
          },
          {
            studentId,
            planId: planoMensal.id,
            amount: 99.90,
            paymentDate: new Date(),
            dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
            status: u.student.status === 'blocked' ? 'overdue' : 'pending'
          }
        ]
      });

      // Gerar entre 5 e 15 check-ins nos últimos 30 dias
      const numCheckins = Math.floor(Math.random() * 11) + 5;
      const checkins = [];
      for (let c = 0; c < numCheckins; c++) {
        // Data aleatória nos últimos 30 dias
        const checkinDate = new Date();
        checkinDate.setDate(checkinDate.getDate() - Math.floor(Math.random() * 30));
        checkinDate.setHours(0,0,0,0);
        
        // Hora aleatória entre 6 e 22
        const checkinTime = new Date(checkinDate);
        checkinTime.setHours(Math.floor(Math.random() * 16) + 6, Math.floor(Math.random() * 60), 0, 0);

        // Prevenir duplicação no mesmo dia pro mesmo aluno
        if (!checkins.find(ch => ch.checkinDate.getTime() === checkinDate.getTime())) {
          checkins.push({
            studentId,
            checkinDate,
            checkinTime,
            status: Math.random() > 0.95 ? 'cancelled' : 'present', // 5% cancelados
            createdAt: checkinTime
          });
        }
      }
      
      if (checkins.length > 0) {
        await prisma.checkin.createMany({ data: checkins });
      }
    }
  }

  console.log(`\\n✅ Concluído! ${criados} usuários simulados foram criados com histórico de pagamentos e check-ins.`);
  console.log(`Para limpar os dados depois do teste, rode: npm run db:cleanup`);
}

run()
  .catch(e => {
    console.error('Erro na geração de massa de testes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
