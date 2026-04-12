/**
 * ============================================
 * FitFlow Caraguá — Entry Point do Servidor
 * ============================================
 * Inicializa o servidor Express e testa a conexão com o banco.
 * Este é o arquivo que o npm start executa.
 */

const app = require('./app');
const env = require('./config/env');
const { testPrismaConnection, disconnectPrisma } = require('./config/prisma');

// Banner de inicialização
const banner = `
╔══════════════════════════════════════════╗
║       🏋️ FitFlow Caraguá v1.0.0         ║
║    Sistema de Gestão de Academias        ║
║    Caraguatatuba - SP                    ║
╚══════════════════════════════════════════╝
`;

async function startServer() {
  console.log(banner);

  // 1. Testa conexão com MySQL (via Prisma)
  console.log('🔄 Conectando ao banco de dados (Prisma)...');
  const dbConnected = await testPrismaConnection();

  if (!dbConnected) {
    console.error('');
    console.error('⚠️  O servidor vai iniciar, mas o banco de dados não está disponível.');
    console.error('   Verifique se o MySQL está rodando e a DATABASE_URL no .env está correta.');
    console.error('');
  }

  // 2. Inicia o servidor HTTP
  const server = app.listen(env.port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${env.port}`);
    console.log(`📡 API disponível em http://localhost:${env.port}/api`);
    console.log(`🌐 Frontend disponível em http://localhost:${env.port}`);
    console.log(`🔧 Ambiente: ${env.nodeEnv}`);
    console.log('');
  });

  // 3. Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n🛑 ${signal} recebido. Encerrando servidor...`);
    server.close(async () => {
      await disconnectPrisma();
      console.log('✅ Servidor encerrado com sucesso.');
      process.exit(0);
    });

    // Força encerramento após 10s
    setTimeout(() => {
      console.error('⚠️  Forçando encerramento após timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 4. Tratamento de erros não capturados
  process.on('unhandledRejection', (err) => {
    console.error('🔴 Rejeição não tratada:', err);
  });

  process.on('uncaughtException', (err) => {
    console.error('🔴 Exceção não capturada:', err);
    shutdown('uncaughtException');
  });
}

startServer();
