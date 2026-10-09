// Ambiente MariaDB nativo isolado no workspace; não usa Docker ou o banco antigo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '../..');
const local = path.join(root, '.local-db');
const runtime = path.join(local, 'runtime/mariadb-11.8.8-winx64');
const data = path.join(local, 'data');
const config = path.join(local, 'client.ini');
const envFile = path.join(root, 'server/.env.development.local');
const database = 'fitflow_dev';

// O arquivo de cliente evita expor a senha em comandos ou em mensagens do terminal.
function query(sql) {
  return execFileSync(path.join(runtime, 'bin/mariadb.exe'),
    [`--defaults-extra-file=${config}`, '--batch', '--skip-column-names'],
    { input: sql, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}
async function ready() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { query('SELECT 1;'); return; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  throw new Error('Banco local não respondeu. Consulte .local-db/server.log.');
}
async function start() {
  if (!fs.existsSync(path.join(data, 'my.ini'))) throw new Error('Execute primeiro: node scripts/local-db.cjs init');
  try { query('SELECT 1;'); console.log('MariaDB local já está disponível em 127.0.0.1:3308.'); return; } catch {}
  // Processo separado, sem janela ou instalação de serviço/autostart no Windows.
  const child = spawn(path.join(runtime, 'bin/mariadbd.exe'), [`--defaults-file=${path.join(data, 'my.ini')}`],
    { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
  await ready();
  console.log('MariaDB local disponível em 127.0.0.1:3308.');
}
async function init() {
  if (process.platform !== 'win32') throw new Error('Este auxiliar é para MariaDB nativo no Windows.');
  if (!fs.existsSync(path.join(runtime, 'bin/mariadbd.exe'))) throw new Error('Distribuição MariaDB 11.8.8 não encontrada; consulte docs/DESENVOLVIMENTO.md.');
  if (fs.existsSync(envFile)) {
    const previous = dotenv.parse(fs.readFileSync(envFile));
    if (previous.LOCAL_DB_MANAGED !== 'fitflow-native-v1') throw new Error('Arquivo de ambiente já existe; não será sobrescrito.');
    await start(); return;
  }
  if (fs.existsSync(data)) throw new Error('Diretório de dados já existe; não será reinicializado.');
  const rootPassword = crypto.randomBytes(24).toString('hex');
  const password = crypto.randomBytes(24).toString('hex');
  fs.mkdirSync(local, { recursive: true });
  // Nenhum serviço de sistema é criado, e o acesso permanece restrito ao loopback.
  execFileSync(path.join(runtime, 'bin/mariadb-install-db.exe'),
    [`--datadir=${data}`, `--password=${rootPassword}`, '--port=3308', '--silent'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  fs.appendFileSync(path.join(data, 'my.ini'), `\n[mysqld]\nbind-address=127.0.0.1\nlog-error=${path.join(local,'server.log').replaceAll('\\','/')}\n`);
  fs.writeFileSync(config, `[client]\nuser=root\npassword=${rootPassword}\nhost=127.0.0.1\nport=3308\nprotocol=tcp\n`);
  await start();
  query(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'fitflow_local'@'127.0.0.1' IDENTIFIED BY '${password}'; GRANT ALL PRIVILEGES ON ${database}.* TO 'fitflow_local'@'127.0.0.1';`);
  fs.writeFileSync(envFile, `# Gerado para desenvolvimento local; não publicar.\nLOCAL_DB_MANAGED=fitflow-native-v1\nNODE_ENV=development\nPORT=3107\nCORS_ORIGIN=http://127.0.0.1:3107\nDATABASE_URL=mysql://fitflow_local:${password}@127.0.0.1:3308/${database}?connection_limit=5\nJWT_SECRET=${crypto.randomBytes(32).toString('hex')}\nJWT_EXPIRES_IN=1d\nGEMINI_MODEL=gemini-3.5-flash-lite\n`);
  console.log('Banco e ambiente locais preparados. Senhas ficam somente em arquivos ignorados pelo Git.');
}
async function main() {
  const command = process.argv[2] || 'status';
  if (command === 'init') return init();
  if (command === 'start') return start();
  if (command === 'stop') { query('SHUTDOWN;'); console.log('Banco local encerrado sem remover os dados.'); return; }
  if (command === 'status') { console.log(query('SELECT VERSION();').trim()); return; }
  throw new Error('Comandos disponíveis: init, start, stop, status.');
}
main().catch(error => { console.error(error.message.includes('Banco') || error.message.includes('Execute') || error.message.includes('encontrada') || error.message.includes('existe') || error.message.includes('Comandos') ? error.message : 'Não foi possível preparar o banco local. Consulte .local-db/server.log.'); process.exitCode = 1; });
