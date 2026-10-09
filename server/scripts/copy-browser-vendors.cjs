// Versões fixadas no package-lock: evita dependência de CDN com tag latest.
const fs = require('node:fs');
const path = require('node:path');
const server = path.resolve(__dirname, '..');
const target = path.resolve(server, '../client/vendor');
fs.mkdirSync(target, { recursive: true });
for (const [source, file] of [
  ['lucide/dist/umd/lucide.js', 'lucide.js'],
  ['chart.js/dist/chart.umd.js', 'chart.js'],
  ['sortablejs/Sortable.min.js', 'sortable.js'],
  ['lucide/LICENSE', 'lucide-LICENSE.txt'],
  ['chart.js/LICENSE.md', 'chart-LICENSE.txt'],
  ['sortablejs/LICENSE', 'sortable-LICENSE.txt'],
]) fs.copyFileSync(path.join(server, 'node_modules', source), path.join(target, file));
console.log('Dependências do navegador e licenças copiadas para client/vendor.');
