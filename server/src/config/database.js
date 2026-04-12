/**
 * ============================================
 * FitFlow Caraguá — Conexão MySQL (Pool)
 * ============================================
 * Cria um pool de conexões usando mysql2/promise
 * para queries assíncronas com prepared statements.
 * 
 * Uso: const pool = require('./config/database');
 *      const [rows] = await pool.execute('SELECT ...', [params]);
 */

const mysql = require('mysql2/promise');
const env = require('./env');

// Cria o pool de conexões
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Configurações de timezone para Brasil
  timezone: '-03:00',
  // Retorna datas como strings para evitar problemas de conversão
  dateStrings: true,
});

/**
 * Testa a conexão com o banco de dados.
 * Deve ser chamada na inicialização do servidor.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL conectado com sucesso —', `${env.db.host}:${env.db.port}/${env.db.name}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar no MySQL:', error.message);
    return false;
  }
}

module.exports = { pool, testConnection };
