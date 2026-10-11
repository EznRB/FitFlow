const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { render } = require('../../client/js/exercise-origin');
const context = vm.createContext({}); vm.runInContext(fs.readFileSync(require.resolve('../../client/js/security.js'),'utf8'),context);
const escape = vm.runInContext('FitFlowSecurity.escapeHtml',context);
test('origem exibe créditos separados, transformações e adaptação sem executar conteúdo externo', () => {
  const evil = '<img src=x onerror=alert(1)>', ex = { name: 'Nome adaptado', muscleGroup: 'Outro', catalogSnapshot: {
    version: 1, catalogExerciseId: 9, source: 'wger', originalName: evil, originalMuscleGroup: 'Costas', instructions: evil,
    sourceMetadata: { base: { author: 'Autor base', license: { code: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' } },
      text: { author: evil, license: { code: 'CC-BY-SA-4.0', url: 'javascript:alert(1)' }, transformations: [evil], authorUrl: 'https://user:secret@example.com/' },
      media: [{ author: 'Autoria imagem', url: 'https://example.com/image.png', license: { code: 'CC-BY-3.0', url: 'https://creativecommons.org/licenses/by/3.0/' } }] } } };
  const html = render(ex,escape);
  assert.ok(!html.includes('<img')); assert.ok(!html.includes('href="javascript:')); assert.ok(!html.includes('user:secret'));
  for (const expected of ['Base do exercício', 'Texto', 'Mídia 1', 'Autor base', 'Autoria imagem', 'Transformações registradas', 'adaptado na ficha']) assert.ok(html.includes(expected),expected);
  assert.ok(html.includes('&lt;img')); assert.ok(html.includes('noopener noreferrer'));
});
test('manual e antigo sem snapshot são apresentados como origem não registrada', () => {
  assert.match(render({ name: 'Supino', catalogExerciseId: null },escape),/Origem não registrada/);
  assert.match(render({ catalogSnapshot: { version: 2, catalogExerciseId: 9 } },escape),/Origem não registrada/);
});
