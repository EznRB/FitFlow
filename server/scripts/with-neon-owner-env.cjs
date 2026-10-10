'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.remote.local'), override: true });
const direct = new URL(process.env.DIRECT_URL || 'file:missing');
if (process.env.NEON_PROJECT_ID !== 'mute-night-99440749' || process.env.NEON_BRANCH_ID !== 'br-tiny-king-b6carztp'
  || direct.hostname !== 'ep-jolly-grass-b6jl6hjo.c-2.sa-east-1.aws.neon.tech' || direct.pathname !== '/fitflow'
  || direct.username !== 'fitflow_owner' || direct.searchParams.get('sslaccept') !== 'strict') {
  throw new Error('Operação administrativa restrita ao novo banco FitFlow confirmado.');
}
process.env.NODE_ENV = 'development';
delete process.env.LOCAL_DB_MANAGED;
delete process.env.NEON_VERIFICATION_MANAGED;
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Informe o comando administrativo.');
const result = spawnSync(command, args, { cwd: path.resolve(__dirname, '..'), env: process.env, windowsHide: true, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
