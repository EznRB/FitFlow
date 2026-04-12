const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('Criando tabela exercicios se não existir...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS exercicios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        grupo_muscular VARCHAR(50) NOT NULL,
        instrucoes TEXT,
        imagem_url VARCHAR(255),
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Tenta adicionar coluna caso ela não exista em tabela antiga
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE exercicios ADD COLUMN imagem_url VARCHAR(255) AFTER instrucoes');
    } catch (err) {}

    console.log('Inserindo exercícios...');

    const exercicios = [
      { nome: 'Supino Reto com Barra', grupo: 'Peito', inst: 'Deite no banco reto, pés fixos. Desça a barra até tocar o peito e empurre.', img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Supino Inclinado com Halteres', grupo: 'Peito', inst: 'No banco a 45°, empurre os halteres para cima e retorne lentamente.', img: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Crucifixo Máquina (Peck Deck)', grupo: 'Peito', inst: 'Sente na máquina e feche os braços contra a resistência.', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Puxada Frontal Alta', grupo: 'Costas', inst: 'Puxe a barra em direção ao peito focando nos músculos das costas (latíssimo).', img: 'https://images.unsplash.com/photo-1598266663412-70659d8702b8?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Remada Curvada com Barra', grupo: 'Costas', inst: 'Incline o tronco e puxe a barra na direção do umbigo.', img: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Remada Baixa (Triângulo)', grupo: 'Costas', inst: 'Sente-se, costas retas, e puxe o cabo até a região abdominal.', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Agachamento Livre', grupo: 'Pernas', inst: 'Barra nos ombros, pés na largura do quadril. Desça mantendo o tronco reto.', img: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Leg Press 45°', grupo: 'Pernas', inst: 'Sente na máquina e empurre a plataforma estendendo as pernas (sem travar joelhos).', img: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Cadeira Extensora', grupo: 'Pernas', inst: 'Estenda os joelhos até contrair os quadríceps e controle a volta.', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Mesa Flexora', grupo: 'Pernas', inst: 'Deite de bruços e flexione as pernas na direção dos glúteos.', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Desenvolvimento com Halteres', grupo: 'Ombros', inst: 'Sente-se e empurre os halteres para cima da cabeça.', img: 'https://images.unsplash.com/photo-1584735935682-2f2b69d4fa8e?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Elevação Lateral', grupo: 'Ombros', inst: 'Braços semiflexionados, eleve os halteres até a linha dos ombros.', img: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Rosca Direta com Barra', grupo: 'Bíceps', inst: 'Flexione os cotovelos levantando a barra em direção aos ombros.', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Tríceps Polia (Corda)', grupo: 'Tríceps', inst: 'Estenda os cotovelos empurrando a corda para baixo.', img: 'https://images.unsplash.com/photo-1598266663412-70659d8702b8?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Abdominal Supra (Crunch)', grupo: 'Abdômen', inst: 'Deitado de costas, eleve o tronco contendo a força no abdômen.', img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400' }
    ];

    for (const ex of exercicios) {
      await prisma.$executeRawUnsafe(
        'INSERT INTO exercicios (nome, grupo_muscular, instrucoes, imagem_url, ativo) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE instrucoes = VALUES(instrucoes), imagem_url = VALUES(imagem_url), ativo=TRUE',
        ex.nome, ex.grupo, ex.inst, ex.img
      );
    }

    // Listando exercicios para verificar se funcionou
    const list = await prisma.$queryRawUnsafe('SELECT id, nome, grupo_muscular, imagem_url FROM exercicios');
    console.table(list);
    
    console.log('Exercícios inseridos com sucesso!');
  } catch (error) {
    console.error('Erro ao executar seed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

seed();
