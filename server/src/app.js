/**
 * ============================================================================
 * FitFlow Caraguá — Configuração Principal do Servidor (Express)
 * ============================================================================
 * Este arquivo define a "espinha dorsal" do backend. Aqui configuramos como
 * o servidor responde a requisições, como ele se protege e como ele
 * organiza as rotas da API e os arquivos do frontend.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const env = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Importação dos módulos de rotas (divisão de responsabilidades por recurso)
const authRoutes = require('./routes/auth.routes');
const alunosRoutes = require('./routes/alunos.routes');
const planosRoutes = require('./routes/planos.routes');
const exerciciosRoutes = require('./routes/exercicios.routes');
const treinosRoutes = require('./routes/treinos.routes');
const pagamentosRoutes = require('./routes/pagamentos.routes');
const checkinsRoutes = require('./routes/checkins.routes');
const relatoriosRoutes = require('./routes/relatorios.routes');
const alunoRoutes = require('./routes/aluno.routes');

const app = express();

// ============================================================================
// MIDDLEWARES GLOBAIS (Camadas de Pré-processamento)
// ============================================================================

/**
 * Segurança (Helmet):
 * Adiciona headers HTTP que protegem contra ataques comuns como XSS e Clickjacking.
 */
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitado para permitir que o Express sirva o frontend localmente.
  crossOriginEmbedderPolicy: false,
}));

/**
 * CORS (Cross-Origin Resource Sharing):
 * Define quem pode acessar esta API. Essencial para que o navegador não bloqueie
 * requisições vindas do frontend que está em outra "origem".
 */
app.use(cors({
  origin: env.cors.origin, // Configurado dinamicamente via variáveis de ambiente (.env).
  credentials: true,      // Permite que o navegador envie cookies httpOnly (segurança extra).
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Rate Limiting (Proteção de Tráfego):
 * Limita o número de requisições por IP em um intervalo de tempo.
 * Previne ataques de negação de serviço (DoS) e brute-force manual.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos.
  max: 100,                 // Cada IP pode fazer no máximo 100 requisições por janela.
  message: {
    status: 'fail',
    message: 'Muitas requisições originadas deste IP. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter); // Aplica a regra para todos os endpoints que começam com /api/

/**
 * Login Rate Limiting (Mais restrito):
 * Proteção específica para a rota de login, evitando tentativas exaustivas de senhas.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Apenas 10 tentativas a cada 15 minutos.
  message: {
    status: 'fail',
    message: 'Muitas tentativas de login bloqueadas por segurança. Aguarde 15 minutos.',
  },
});
app.use('/api/auth/login', loginLimiter);

/**
 * Body Parsing & Cookies:
 * Converte o corpo das requisições (JSON ou formulários) em objetos JavaScript (req.body).
 */
app.use(express.json({ limit: '10mb' })); // Suporta JSON até 10MB.
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Analisa cookies enviados pelo cliente.

// Logging: Mostra logs detalhados das requisições no console (apenas em desenvolvimento).
if (env.isDev) {
  app.use(morgan('dev'));
}

// ============================================================================
// SERVIR FRONTEND (Arquivos Estáticos)
// ============================================================================
/**
 * O Express atua como servidor de arquivos estáticos, permitindo que o
 * navegador carregue o HTML, CSS e JS da pasta 'client'.
 */
app.use(express.static(path.join(__dirname, '..', '..', 'client')));

// ============================================================================
// ROTAS DA API (Mapeamento de Endpoints)
// ============================================================================
app.use('/api/auth', authRoutes);         // Autenticação, Login, Tokens
app.use('/api/alunos', alunosRoutes);     // CRUD e Gestão de Alunos
app.use('/api/planos', planosRoutes);     // Configuração de Mensalidades
app.use('/api/exercicios', exerciciosRoutes); // Catálogo Técnico
app.use('/api/treinos', treinosRoutes);   // Vínculo entre Exercícios e Alunos
app.use('/api/pagamentos', pagamentosRoutes); // Histórico Financeiro
app.use('/api/checkins', checkinsRoutes); // Registro de Frequência
app.use('/api/relatorios', relatoriosRoutes); // Agregadores de Dados
app.use('/api/aluno', alunoRoutes);           // Área do Aluno (TASK 10)

/**
 * Health Check:
 * Rota simples para verificar se o servidor está ativo e saudável.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'FitFlow Caraguá API está online e operando! 🏋️',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
  });
});

// ============================================================================
// TRATAMENTO DE ERROS E FALLBACKS
// ============================================================================

/**
 * 404 API:
 * Caso o cliente tente acessar uma rota de API que não existe.
 */
app.all('/api/*', notFoundHandler);

/**
 * SPA Fallback:
 * Essencial para aplicativos Single Page. Se o usuário der "Refresh" em uma rota
 * interna, o servidor sempre retorna o 'index.html', permitindo que o 
 * JavaScript do frontend assuma a navegação no lado do cliente.
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});

/**
 * Middleware Global de Erro:
 * Captura qualquer erro disparado em qualquer parte do sistema e retorna
 * uma resposta amigável e segura para o cliente.
 */
app.use(errorHandler);

module.exports = app;
