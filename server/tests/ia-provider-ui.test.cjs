const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../client/js/evidencias.js'), 'utf8');
function fixture(data, connected = true) {
  const status = {}, listeners = [], button = { disabled: true, addEventListener: (...args) => listeners.push(args) };
  const container = { isConnected: connected, innerHTML: '', querySelector: selector => selector === 'button' ? button : status };
  const context = vm.createContext({ API: { get: async () => ({ data }) } });
  vm.runInContext(`${source}\nglobalThis.view = EvidenciasView;`, context);
  return { container, status, button, listeners, render: () => context.view.mountAI(container, 'volume') };
}
test('aviso de envio identifica somente o provedor permitido pelo status', async () => {
  for (const [provider, label] of [['gemini', 'Gemini'], ['groq', 'Groq'], ['vercel', 'serviço de IA configurado'], [undefined, 'serviço de IA configurado'], ['<img src=x onerror=alert(1)>', 'serviço de IA configurado'], ['__proto__', 'serviço de IA configurado']]) {
    const h = fixture({ enabled: true, provider, apiKey: 'SECRET-FIXTURE', model: 'PRIVATE-MODEL' }); await h.render();
    assert.equal(h.status.textContent, `Envia apenas o tema e resumos das referências ao ${label}. Nenhum dado pessoal é enviado.`);
    assert.equal(h.button.disabled, false); assert.equal(h.listeners.length, 1);
    assert.ok(!h.status.textContent.includes('SECRET-FIXTURE')); assert.ok(!h.status.textContent.includes('PRIVATE-MODEL'));
    assert.ok(!h.container.innerHTML.includes(label), 'provedor deve usar textContent, sem interpolação de HTML');
  }
});
test('IA desabilitada e callback desconectado mantêm botão inativo sem aviso de envio', async () => {
  const disabled = fixture({ enabled: false, provider: 'groq' }); await disabled.render();
  assert.equal(disabled.button.disabled, true); assert.match(disabled.status.textContent, /ainda não configurada/); assert.equal(disabled.listeners.length, 0);
  const detached = fixture({ enabled: true, provider: 'groq' }, false); await detached.render();
  assert.equal(detached.button.disabled, true); assert.equal(detached.status.textContent, undefined); assert.equal(detached.listeners.length, 0);
});
