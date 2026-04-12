-- ============================================
-- FitFlow Caraguá — Dados Iniciais (Seed)
-- ============================================
-- Execute APÓS o schema.sql para popular dados iniciais.
-- Cria um admin padrão e planos de exemplo.
-- ============================================

USE fitflow_caragua;

-- ============================================
-- ADMIN PADRÃO
-- ============================================
-- Email: admin@fitflow.com
-- Senha: admin123 (hash bcrypt)
-- ⚠️ TROQUE A SENHA EM PRODUÇÃO!
INSERT INTO usuarios (nome, email, senha_hash, role, ativo) VALUES
('Administrador FitFlow', 'admin@fitflow.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', TRUE)
ON DUPLICATE KEY UPDATE nome = nome;

-- ============================================
-- PLANOS PADRÃO
-- ============================================
INSERT INTO planos (nome, descricao, valor, duracao_dias, ativo) VALUES
('Mensal',     'Acesso completo à academia por 30 dias.',       89.90,  30,  TRUE),
('Trimestral', 'Acesso completo à academia por 90 dias. Economia de 10%.', 242.73, 90,  TRUE),
('Semestral',  'Acesso completo à academia por 180 dias. Economia de 15%.', 458.49, 180, TRUE),
('Anual',      'Acesso completo à academia por 365 dias. Melhor custo-benefício!', 862.08, 365, TRUE)
ON DUPLICATE KEY UPDATE nome = nome;

-- ============================================
-- EXERCÍCIOS PADRÃO
-- ============================================
INSERT INTO exercicios (nome, grupo_muscular, instrucoes, ativo) VALUES
-- Peito
('Supino Reto com Barra',     'Peito',      'Deite no banco, segure a barra na largura dos ombros, desça até o peito e empurre para cima.', TRUE),
('Supino Inclinado com Halter','Peito',      'Banco inclinado a 30-45°, desça os halteres até a linha do peito e empurre para cima.', TRUE),
('Crucifixo com Halter',       'Peito',      'Deite no banco reto, braços abertos com halteres, junte os braços acima do peito.', TRUE),
('Crossover na Polia',         'Peito',      'Polias acima da cabeça, puxe os cabos fazendo um arco até as mãos se encontrarem na frente.', TRUE),

-- Costas
('Puxada Frontal',             'Costas',     'Sentado na máquina, puxe a barra até o peito mantendo o tronco levemente inclinado.', TRUE),
('Remada Curvada com Barra',   'Costas',     'Incline o tronco a 45°, puxe a barra até o abdômen e desça controladamente.', TRUE),
('Remada Unilateral',          'Costas',     'Apoie um joelho no banco, puxe o halter até a cintura com o outro braço.', TRUE),
('Pulldown na Polia',          'Costas',     'Braços estendidos acima, puxe a barra para baixo até o queixo.', TRUE),

-- Pernas
('Agachamento Livre',          'Pernas',     'Barra nas costas, desça até as coxas ficarem paralelas ao chão e suba.', TRUE),
('Leg Press 45°',              'Pernas',     'Posicione os pés na plataforma na largura dos ombros, empurre e flexione as pernas.', TRUE),
('Cadeira Extensora',          'Pernas',     'Sentado, estenda as pernas até a posição reta e desça controladamente.', TRUE),
('Mesa Flexora',               'Pernas',     'Deitado de bruços, flexione as pernas levando os calcanhares em direção aos glúteos.', TRUE),
('Panturrilha no Leg Press',   'Pernas',     'No leg press, posicione apenas as pontas dos pés e empurre estendendo os tornozelos.', TRUE),

-- Ombros
('Desenvolvimento com Halter', 'Ombros',     'Sentado, eleve os halteres acima da cabeça partindo da altura dos ombros.', TRUE),
('Elevação Lateral',           'Ombros',     'Em pé, eleve os halteres lateralmente até a altura dos ombros.', TRUE),
('Elevação Frontal',           'Ombros',     'Em pé, eleve os halteres à frente até a altura dos ombros.', TRUE),

-- Bíceps
('Rosca Direta com Barra',    'Bíceps',     'Em pé, segure a barra com pegada supinada e flexione os cotovelos.', TRUE),
('Rosca Alternada com Halter', 'Bíceps',     'Em pé, flexione um braço de cada vez alternadamente.', TRUE),
('Rosca Martelo',              'Bíceps',     'Em pé, halteres com pegada neutra, flexione os cotovelos.', TRUE),

-- Tríceps
('Tríceps Pulley',             'Tríceps',    'Na polia alta, empurre a barra para baixo estendendo os cotovelos.', TRUE),
('Tríceps Francês',            'Tríceps',    'Deitado ou sentado, desça o halter atrás da cabeça e estenda os braços.', TRUE),
('Mergulho no Banco',          'Tríceps',    'Mãos apoiadas no banco atrás, desça o corpo flexionando os cotovelos.', TRUE),

-- Abdômen
('Abdominal Crunch',           'Abdômen',    'Deitado, flexione o tronco contraindo o abdômen sem puxar o pescoço.', TRUE),
('Prancha Isométrica',         'Abdômen',    'Apoie antebraços e pontas dos pés, mantenha o corpo reto por tempo determinado.', TRUE),
('Elevação de Pernas',         'Abdômen',    'Suspenso na barra ou deitado, eleve as pernas até 90°.', TRUE)

ON DUPLICATE KEY UPDATE nome = nome;
