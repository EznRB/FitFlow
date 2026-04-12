/**
 * ============================================
 * FitFlow Caraguá — Seed de Exercícios
 * ============================================
 * Script para popular a base de dados com o catálogo
 * inicial de exercícios (fotos, nomes e categorias).
 * 
 * Execução: node seed_direct.js
 */
const mysql = require('mysql2/promise');

async function seed() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'fitflow_caragua',
    port: 3306
  });

  try {
    console.log('Creating table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS exercicios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE,
        grupo_muscular VARCHAR(50) NOT NULL,
        instrucoes TEXT,
        imagem_url VARCHAR(255),
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    try {
      await connection.query('ALTER TABLE exercicios ADD COLUMN imagem_url VARCHAR(255) AFTER instrucoes');
    } catch(e) {}

    console.log('Inserting data...');
    const exercicios = [
      // Peito
      { nome: 'Supino Reto com Barra', grupo: 'Peito', inst: 'Deite no banco reto, pés fixos. Desça a barra até tocar o peito e empurre.', img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Supino Inclinado com Halteres', grupo: 'Peito', inst: 'No banco a 45°, empurre os halteres para cima e retorne lentamente.', img: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Crucifixo Máquina (Peck Deck)', grupo: 'Peito', inst: 'Sente na máquina e feche os braços contra a resistência.', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Crossover Polia Alta', grupo: 'Peito', inst: 'Com os cabos na posição alta, puxe-os para frente cruzando na direção do quadril.', img: 'https://images.unsplash.com/photo-1598266663412-70659d8702b8?auto=format&fit=crop&q=80&w=400' },
      
      // Costas
      { nome: 'Puxada Frontal Alta', grupo: 'Costas', inst: 'Puxe a barra em direção ao peito focando nos músculos das costas (latíssimo).', img: 'https://images.unsplash.com/photo-1598266663412-70659d8702b8?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Remada Curvada com Barra', grupo: 'Costas', inst: 'Incline o tronco e puxe a barra na direção do umbigo.', img: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Remada Baixa (Triângulo)', grupo: 'Costas', inst: 'Sente-se, costas retas, e puxe o cabo até a região abdominal.', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Levantamento Terra', grupo: 'Costas', inst: 'Mantenha a postura e erga a barra do chão estendendo o quadril e joelhos.', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Pullover com Halter', grupo: 'Costas', inst: 'Deitado no banco, desça o halter para trás da cabeça com cotovelos levemente flexionados.', img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400' },

      // Pernas & Glúteos
      { nome: 'Agachamento Livre', grupo: 'Pernas', inst: 'Barra nos ombros, pés na largura do quadril. Desça mantendo o tronco reto.', img: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Leg Press 45°', grupo: 'Pernas', inst: 'Sente na máquina e empurre a plataforma estendendo as pernas (sem travar joelhos).', img: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Cadeira Extensora', grupo: 'Pernas', inst: 'Estenda os joelhos até contrair os quadríceps e controle a volta.', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Mesa Flexora', grupo: 'Pernas', inst: 'Deite de bruços e flexione as pernas na direção dos glúteos.', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Cadeira Adutora', grupo: 'Pernas', inst: 'Aperte os rolos da máquina unindo as pernas controladamente.', img: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Subida no Banco (Step-up)', grupo: 'Pernas', inst: 'Suba em uma caixa ou banco alternando as pernas, mantendo postura ereta.', img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Elevação Pélvica', grupo: 'Glúteos', inst: 'Apoie as costas no banco e a barra no quadril. Eleve o quadril espremendo os glúteos.', img: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Panturrilha Sentado', grupo: 'Pernas', inst: 'Sente na máquina e flexione e estenda os tornozelos focando na panturrilha.', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400' },

      // Ombros
      { nome: 'Desenvolvimento com Halteres', grupo: 'Ombros', inst: 'Sente-se e empurre os halteres para cima da cabeça.', img: 'https://images.unsplash.com/photo-1584735935682-2f2b69d4fa8e?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Elevação Lateral', grupo: 'Ombros', inst: 'Braços semiflexionados, eleve os halteres até a linha dos ombros.', img: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Face Pull (Corda)', grupo: 'Ombros', inst: 'Puxe a corda na polia alta em direção à testa, separando as mãos.', img: 'https://images.unsplash.com/photo-1598266663412-70659d8702b8?auto=format&fit=crop&q=80&w=400' },

      // Braços (Bíceps/Tríceps)
      { nome: 'Rosca Direta com Barra', grupo: 'Bíceps', inst: 'Flexione os cotovelos levantando a barra em direção aos ombros.', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Rosca Martelo com Halteres', grupo: 'Bíceps', inst: 'Pegada neutra (martelo), flexione os cotovelos alternadamente.', img: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Tríceps Polia (Corda)', grupo: 'Tríceps', inst: 'Estenda os cotovelos empurrando a corda para baixo.', img: 'https://images.unsplash.com/photo-1598266663412-70659d8702b8?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Tríceps Testa', grupo: 'Tríceps', inst: 'Deitado no banco, desça a barra W em direção à testa e estenda os braços.', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400' },

      // Core
      { nome: 'Abdominal Supra (Crunch)', grupo: 'Abdômen', inst: 'Deitado de costas, eleve o tronco contendo a força no abdômen.', img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400' },
      { nome: 'Prancha Isométrica', grupo: 'Abdômen', inst: 'Sustente o corpo reto apoiado nos antebraços e pontas dos pés.', img: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400' }
    ];

    for (let ex of exercicios) {
      await connection.query(
        'INSERT INTO exercicios (nome, grupo_muscular, instrucoes, imagem_url, ativo) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE instrucoes = VALUES(instrucoes), imagem_url = VALUES(imagem_url), ativo=TRUE',
        [ex.nome, ex.grupo, ex.inst, ex.img]
      );
    }
    console.log('Success!');
  } catch(e) {
    console.error(e);
  } finally {
    await connection.end();
  }
}

seed();
