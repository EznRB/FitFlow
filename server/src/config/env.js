/**
 * ============================================
 * FitFlow Caraguá — Configuração de Ambiente
 * ============================================
 * Carrega e exporta todas as variáveis de ambiente
 * de forma centralizada com valores padrão seguros.
 */

const dotenv = require('dotenv');
const path = require('path');
const { resolveJwtSecret } = require('./jwtSecret');

// Carrega variáveis do arquivo .env
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const env = {
  // Servidor
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // JWT
  jwt: {
    secret: resolveJwtSecret(process.env.JWT_SECRET, process.env.NODE_ENV),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
};

module.exports = env;
