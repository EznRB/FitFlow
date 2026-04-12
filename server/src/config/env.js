/**
 * ============================================
 * FitFlow Caraguá — Configuração de Ambiente
 * ============================================
 * Carrega e exporta todas as variáveis de ambiente
 * de forma centralizada com valores padrão seguros.
 */

const dotenv = require('dotenv');
const path = require('path');

// Carrega variáveis do arquivo .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const env = {
  // Servidor
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Banco de Dados
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'fitflow_caragua',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_change_me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
};

module.exports = env;
