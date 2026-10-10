'use strict';
// Isolated native PostgreSQL test cluster; never uses inherited DATABASE_URL.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const serverRoot = path.resolve(__dirname, '..');
const directory = path.resolve(serverRoot, '../.local-db-postgresql');
const data = path.join(directory, 'data');
const envFile = path.join(serverRoot, '.env.postgresql.local');
const bin = process.env.FITFLOW_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/17/bin';
const marker = 'fitflow-postgresql-test-v1';
function run(tool, args, input, extraEnv = {}) {
  const result = spawnSync(path.join(bin, `${tool}.exe`), args, {
    windowsHide: true, encoding: 'utf8', input, stdio: ['pipe', 'ignore', 'ignore'], env: { ...process.env, ...extraEnv }, timeout: 60000,
  });
  if (result.status !== 0) throw new Error(`Operação ${tool} falhou; confira os logs privados do cluster de teste.`);
}
function check() {
  if (!fs.existsSync(path.join(directory, 'managed.json')) || JSON.parse(fs.readFileSync(path.join(directory, 'managed.json'))).marker !== marker) {
    throw new Error('Cluster PostgreSQL não pertence aos testes FitFlow.');
  }
}
function start() {
  check();
  const status = spawnSync(path.join(bin, 'pg_ctl.exe'), ['status', '-D', data], { windowsHide: true, stdio: 'ignore' });
  if (status.status !== 0) run('pg_ctl', ['start', '-D', data, '-l', path.join(directory, 'postgresql.log'), '-t', '30']);
}
const command = process.argv[2];
try {
  if (command === 'init') {
    if (fs.existsSync(directory) || fs.existsSync(envFile)) throw new Error('Destino de testes já existe; use start, sem sobrescrever dados.');
    fs.mkdirSync(directory);
    const password = randomBytes(32).toString('hex');
    const passwordFile = path.join(directory, 'password.private');
    fs.writeFileSync(passwordFile, password);
    run('initdb', ['-D', data, '-U', 'fitflow_test_owner', '--pwfile', passwordFile, '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=C']);
    fs.appendFileSync(path.join(data, 'postgresql.conf'), "\nlisten_addresses = '127.0.0.1'\nport = 5448\ntimezone = 'UTC'\nlog_statement = 'none'\n");
    fs.writeFileSync(path.join(directory, 'managed.json'), JSON.stringify({ marker }));
    start();
    run('psql', ['-h', '127.0.0.1', '-p', '5448', '-U', 'fitflow_test_owner', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], 'CREATE DATABASE fitflow_pg_test;', { PGPASSWORD: password });
    const url = `postgresql://fitflow_test_owner:${password}@127.0.0.1:5448/fitflow_pg_test?connection_limit=5`;
    fs.writeFileSync(envFile, `NODE_ENV=development\nDATABASE_PROVIDER=postgresql\nDATABASE_URL=${url}\nDIRECT_URL=${url}\nLOCAL_DB_MANAGED=${marker}\nJWT_SECRET=${randomBytes(48).toString('hex')}\nPORT=3109\nCORS_ORIGIN=http://127.0.0.1:3109\n`);
    fs.unlinkSync(passwordFile);
    console.log('Cluster de teste PostgreSQL criado em 127.0.0.1:5448; credenciais privadas não exibidas.');
  } else if (command === 'start') { start(); console.log('Cluster PostgreSQL de teste disponível.'); }
  else if (command === 'stop') { check(); run('pg_ctl', ['stop', '-D', data, '-m', 'fast', '-t', '30']); console.log('Cluster PostgreSQL de teste parado.'); }
  else throw new Error('Use init, start ou stop.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
