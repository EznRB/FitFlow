'use strict';
// Receives a connector result through a non-echoing terminal, never command arguments.
const fs = require('node:fs');
const path = require('node:path');
const allowed = new Set(['.env.remote.local', '.env.remote.verify.local']);
const filename = process.argv[2];
if (!allowed.has(filename) || !process.stdin.isTTY) throw new Error('Destino privado ou terminal inválido.');
process.stdin.setRawMode(true);
process.stdin.resume();
let input = '';
console.log('Aguardando conexão pelo canal privado, sem eco.');
process.stdin.on('data', data => {
  input += data.toString();
  if (input.length > 20000) process.exit(1);
  if (!input.trim().endsWith('}')) return;
  try {
    const v = JSON.parse(input.trim());
    const direct = new URL(v.uri);
    if (v.projectId !== 'mute-night-99440749' || !/^br-[a-z0-9-]+$/.test(v.branchId)
      || !direct.hostname.endsWith('.neon.tech') || direct.pathname !== '/fitflow') throw new Error();
    direct.hostname = direct.hostname.replace('-pooler.', '.');
    direct.searchParams.set('sslmode', 'require'); direct.searchParams.set('sslaccept', 'strict');
    const pooled = new URL(direct);
    pooled.hostname = pooled.hostname.replace('.', '-pooler.');
    pooled.searchParams.set('connection_limit', '2'); pooled.searchParams.set('connect_timeout', '15'); pooled.searchParams.set('pool_timeout', '20');
    const vars = { DATABASE_PROVIDER: 'postgresql', DATABASE_URL: pooled.href, DIRECT_URL: direct.href,
      NEON_PROJECT_ID: v.projectId, NEON_BRANCH_ID: v.branchId };
    fs.writeFileSync(path.resolve(__dirname, '..', filename), Object.entries(vars).map(([k,x]) => k+'='+JSON.stringify(x)).join('\n')+'\n');
    console.log('Conexões TLS direta e pooled armazenadas em arquivo privado.');
    process.stdin.setRawMode(false); process.exit(0);
  } catch { console.error('Conexão não armazenada: formato ou destino inválido.'); process.exit(1); }
});
