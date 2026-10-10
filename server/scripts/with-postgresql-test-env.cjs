'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.postgresql.local'), override: true });
const url = new URL(process.env.DATABASE_URL || 'file:missing');
if (process.env.LOCAL_DB_MANAGED !== 'fitflow-postgresql-test-v1' || url.hostname !== '127.0.0.1' || url.port !== '5448' || url.pathname !== '/fitflow_pg_test' || !['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('Execução permitida apenas no PostgreSQL de teste dedicado.');
}
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Informe o comando de teste.');
const result = spawnSync(command, args, { cwd: path.resolve(__dirname, '..'), env: process.env, windowsHide: true, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
