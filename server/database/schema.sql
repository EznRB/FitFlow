-- ============================================
-- FitFlow Caraguá — Schema do Banco de Dados
-- ============================================
-- Execute este arquivo para criar todas as tabelas.
-- mysql -u root -p < schema.sql
-- ============================================

-- Cria o banco se não existir
CREATE DATABASE IF NOT EXISTS fitflow_caragua
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fitflow_caragua;

-- ============================================
-- TABELA: usuarios
-- ============================================
-- Armazena credenciais e perfil de acesso.
-- Roles: 'admin' (instrutor/dono) ou 'aluno'.
CREATE TABLE IF NOT EXISTS usuarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  senha_hash  VARCHAR(255) NOT NULL,
  role        ENUM('admin', 'aluno') NOT NULL DEFAULT 'aluno',
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_usuarios_email (email),
  INDEX idx_usuarios_role (role)
) ENGINE=InnoDB;

-- ============================================
-- TABELA: planos
-- ============================================
-- Planos de mensalidade disponíveis na academia.
CREATE TABLE IF NOT EXISTS planos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  valor       DECIMAL(10,2) NOT NULL,
  duracao_dias INT NOT NULL DEFAULT 30,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- TABELA: alunos
-- ============================================
-- Dados cadastrais do aluno, vinculado a um usuário e plano.
CREATE TABLE IF NOT EXISTS alunos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id       INT NOT NULL UNIQUE,
  cpf              VARCHAR(14) NOT NULL UNIQUE,
  telefone         VARCHAR(20),
  data_nascimento  DATE,
  endereco         VARCHAR(255),
  observacoes      TEXT,
  plano_id         INT,
  data_inicio_plano DATE,
  data_vencimento  DATE,
  bloqueado        BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_alunos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_alunos_plano FOREIGN KEY (plano_id) REFERENCES planos(id) ON DELETE SET NULL,

  INDEX idx_alunos_cpf (cpf),
  INDEX idx_alunos_plano (plano_id),
  INDEX idx_alunos_vencimento (data_vencimento),
  INDEX idx_alunos_bloqueado (bloqueado)
) ENGINE=InnoDB;

-- ============================================
-- TABELA: exercicios
-- ============================================
-- Catálogo de exercícios disponíveis na academia.
CREATE TABLE IF NOT EXISTS exercicios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(100) NOT NULL,
  grupo_muscular  VARCHAR(50) NOT NULL,
  instrucoes      TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_exercicios_grupo (grupo_muscular)
) ENGINE=InnoDB;

-- ============================================
-- TABELA: treinos
-- ============================================
-- Ficha de treino atribuída a um aluno pelo instrutor.
CREATE TABLE IF NOT EXISTS treinos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  aluno_id      INT NOT NULL,
  nome          VARCHAR(100) NOT NULL,
  descricao     TEXT,
  data_criacao  DATE NOT NULL DEFAULT (CURRENT_DATE),
  criado_por    INT NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_treinos_aluno FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_treinos_criador FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,

  INDEX idx_treinos_aluno (aluno_id),
  INDEX idx_treinos_ativo (ativo)
) ENGINE=InnoDB;

-- ============================================
-- TABELA: treino_exercicios
-- ============================================
-- Exercícios que compõem um treino (estrutura definida pelo instrutor).
CREATE TABLE IF NOT EXISTS treino_exercicios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  treino_id       INT NOT NULL,
  exercicio_id    INT NOT NULL,
  series          INT NOT NULL DEFAULT 3,
  repeticoes      VARCHAR(50) NOT NULL DEFAULT '12',
  carga_sugerida  VARCHAR(50),
  ordem           INT NOT NULL DEFAULT 0,
  observacoes     TEXT,

  CONSTRAINT fk_te_treino FOREIGN KEY (treino_id) REFERENCES treinos(id) ON DELETE CASCADE,
  CONSTRAINT fk_te_exercicio FOREIGN KEY (exercicio_id) REFERENCES exercicios(id) ON DELETE RESTRICT,

  INDEX idx_te_treino (treino_id),
  INDEX idx_te_ordem (treino_id, ordem)
) ENGINE=InnoDB;

-- ============================================
-- TABELA: historico_cargas
-- ============================================
-- Registro de cargas executadas pelo aluno (append-only).
-- Não permite UPDATE nem DELETE para preservar histórico.
CREATE TABLE IF NOT EXISTS historico_cargas (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  treino_exercicio_id   INT NOT NULL,
  aluno_id              INT NOT NULL,
  carga_utilizada       DECIMAL(6,2) NOT NULL,
  repeticoes_realizadas INT,
  observacao            TEXT,
  registrado_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_hc_treino_ex FOREIGN KEY (treino_exercicio_id) REFERENCES treino_exercicios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_hc_aluno FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE RESTRICT,

  INDEX idx_hc_aluno (aluno_id),
  INDEX idx_hc_treino_ex (treino_exercicio_id),
  INDEX idx_hc_data (registrado_em)
) ENGINE=InnoDB;

-- ============================================
-- TABELA: pagamentos
-- ============================================
-- Registro de pagamentos de mensalidades.
CREATE TABLE IF NOT EXISTS pagamentos (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  aluno_id          INT NOT NULL,
  plano_id          INT,
  valor             DECIMAL(10,2) NOT NULL,
  data_pagamento    DATE NOT NULL,
  data_vencimento   DATE NOT NULL,
  status            ENUM('pago', 'pendente', 'vencido') NOT NULL DEFAULT 'pendente',
  forma_pagamento   VARCHAR(50),
  observacoes       TEXT,
  registrado_por    INT NOT NULL,
  criado_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_pag_aluno FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pag_plano FOREIGN KEY (plano_id) REFERENCES planos(id) ON DELETE SET NULL,
  CONSTRAINT fk_pag_registrador FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,

  INDEX idx_pag_aluno (aluno_id),
  INDEX idx_pag_status (status),
  INDEX idx_pag_vencimento (data_vencimento),
  INDEX idx_pag_data (data_pagamento)
) ENGINE=InnoDB;

-- ============================================
-- TABELA: checkins
-- ============================================
-- Registro de presença diária do aluno.
-- UNIQUE constraint garante 1 check-in por aluno/dia.
-- Sem DELETE permitido (regra de negócio).
CREATE TABLE IF NOT EXISTS checkins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  aluno_id      INT NOT NULL,
  data_checkin  DATE NOT NULL DEFAULT (CURRENT_DATE),
  hora_checkin  TIME NOT NULL DEFAULT (CURRENT_TIME),
  criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_checkin_aluno FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE RESTRICT,
  CONSTRAINT uq_checkin_dia UNIQUE (aluno_id, data_checkin),

  INDEX idx_checkin_data (data_checkin),
  INDEX idx_checkin_aluno (aluno_id)
) ENGINE=InnoDB;
