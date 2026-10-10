// Carrega o ambiente local explícito sem alterar .env ou variáveis globais do computador.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const file = path.resolve(__dirname, '../.env.development.local');
if (!fs.existsSync(file)) { console.error('Execute npm run db:local:init antes.'); process.exit(1); }
const [program = process.execPath, ...args] = process.argv.slice(2);
const child = spawn(program, args.length ? args : ['src/server.js'], {
  cwd: path.resolve(__dirname, '..'), env: { ...process.env, ...dotenv.parse(fs.readFileSync(file)) },
  stdio: 'inherit', windowsHide: true,
});
child.on('error', () => { console.error('Não foi possível iniciar o comando local.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
