/**
 * ============================================
 * FitFlow Caraguá — Prisma Client (Singleton)
 * ============================================
 * Instância única do PrismaClient para toda a aplicação.
 * Evita múltiplas conexões em desenvolvimento (hot-reload).
 * 
 * Uso: const { prisma } = require('./config/prisma');
 *      const users = await prisma.user.findMany();
 */

const { PrismaClient } = require('@prisma/client');
const env = require('./env');

// Em desenvolvimento, evita criar múltiplas instâncias por hot-reload
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDev ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.isDev) {
  globalForPrisma.prisma = prisma;
}

/**
 * Testa a conexão com o banco de dados via Prisma.
 */
async function testPrismaConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Prisma conectado ao MySQL com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar via Prisma:', error.message);
    return false;
  }
}

/**
 * Desconecta o Prisma (para graceful shutdown).
 */
async function disconnectPrisma() {
  await prisma.$disconnect();
  console.log('🔌 Prisma desconectado.');
}

module.exports = { prisma, testPrismaConnection, disconnectPrisma };
