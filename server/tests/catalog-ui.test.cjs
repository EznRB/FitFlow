const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load() {
  const body = { innerHTML: '', contains: () => true };
  let modal;
  const context = { URL, window: {}, document: { getElementById: () => body },
    Modal: { confirm: html => { modal = html; }, open: (title, html) => { modal = html; } },
    API: { get: async () => ({ data: { id: 9, nome: '"><img src=x onerror=alert(1)>',
      grupo_muscular: '"><svg onload=alert(1)>', instrucoes: '</textarea><script>bad()</script>', imagem_url: 'javascript:bad()' } }) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../client/js/exercicios-catalogo.js'), 'utf8') + '\nthis.catalog = ExerciciosCatalogoView;', context);
  return { view: context.catalog, body, modal: () => modal };
}
test('tabela/modal tratam texto da API como texto e bloqueiam URLs executáveis', async () => {
  const s = load();
  s.view.renderizarTabela([{ id: 9, nome: '"><img src=x onerror=alert(1)>', grupo_muscular: '<svg onload=alert(1)>',
    ativo: true, imagem_url: 'javascript:alert(1)', instrucoes: '<script>bad()</script>', source: 'wger',
    sourceMetadata: { sourceUrl: 'javascript:bad()', text: { author: '<img src=x onerror=bad()>', license: { code: 'CC-BY', url: 'javascript:bad()' } },
      media: [{ id: 1, url: 'javascript:bad()', author: '<script>bad()</script>' }] } }]);
  assert.ok(!s.body.innerHTML.includes('<img src=x'));
  assert.ok(!s.body.innerHTML.includes('<script>'));
  assert.ok(!s.body.innerHTML.includes('<svg onload'));
  assert.ok(!s.body.innerHTML.includes('onclick='));
  assert.ok(!s.body.innerHTML.includes('href="javascript:'));
  assert.ok(!s.body.innerHTML.includes('src="javascript:'));
  assert.ok(s.body.innerHTML.includes('&lt;img'));
  await s.view.abrirModalEditar(9);
  assert.ok(!s.modal().includes('<img src=x')); assert.ok(!s.modal().includes('</textarea><script>'));
  s.view.confirmarDesativar(9, '<img src=x onerror=bad()>');
  assert.ok(!s.modal().includes('<img src=x'));
});
test('interface explicita idioma/fonte e exibe licença individual de cada asset', () => {
  const s = load(); const html = s.view.renderizarFonte({ source: 'wger', externalId: '9', locale: 'en', curated: false,
    sourceMetadata: { sourceUrl: 'https://wger.de/api/v2/exerciseinfo/9/', text: { author: 'Ana', license: { code: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
      media: [{ id: 1, url: 'https://wger.de/a.png', author: 'Bruno', license: { code: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } }] } });
  assert.ok(html.includes('inglês (sem tradução PT elegível)')); assert.ok(html.includes('Ana'));
  assert.ok(html.includes('Imagem #1')); assert.ok(html.includes('Bruno')); assert.ok(html.includes('CC-BY-4.0'));
  assert.ok(html.includes('CC-BY-SA-4.0')); assert.ok(html.includes('Catálogo descritivo'));
});
