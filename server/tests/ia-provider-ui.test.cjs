const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../client/js/evidencias.js'), 'utf8');
function fixture(data, connected = true) {
  let getCalls = 0;
  const status = {}, listeners = [], button = { disabled: true, addEventListener: (...args) => listeners.push(args) };
  const container = { isConnected: connected, innerHTML: '', querySelector: selector => selector === 'button' ? button : status };
  const context = vm.createContext({ API: { get: async () => { getCalls++; return { data }; } } });
  vm.runInContext(`${source}\nglobalThis.view = EvidenciasView;`, context);
  return { container, status, button, listeners, context, getCalls: () => getCalls,
    render: (topic = 'divisoes') => context.view.mountAI(container, topic) };
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

test('indicadores exibem conteúdo revisado sem consultar disponibilidade ou identificar geração por IA', async () => {
  const h = fixture({ enabled: false });
  const output = { children: [], replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); } };
  h.container.querySelector = selector => selector === 'button' ? h.button : selector === '.science-ai-text' ? output : h.status;
  const posts = [];
  h.context.document = { createElement: tag => ({ tag, textContent: '', appendChild() {} }) };
  h.context.API.post = async (url, payload) => { posts.push({ url, payload }); return { data: {
    explanation: 'Séries são contagens distintas das repetições e da tonelagem.', generatedByAI: false, sources: [{ id: 'acsm-2026' }],
  } }; };
  h.context.view.renderSources = () => {};
  await h.render('volume');
  assert.equal(h.getCalls(), 0);
  assert.match(h.container.innerHTML, /Entender indicadores/);
  assert.equal(h.button.disabled, false);
  assert.match(h.status.textContent, /Definições.*FitFlow/i);
  await h.listeners[0][1]();
  assert.equal(posts.length, 1); assert.equal(posts[0].url, '/ia/explicar'); assert.equal(posts[0].payload.topic, 'volume');
  assert.equal(output.children[0].textContent, 'Séries são contagens distintas das repetições e da tonelagem.');
  assert.match(h.status.textContent, /Texto revisado.*não.*gerado por IA/i);
  assert.match(h.status.textContent, /contexto científico/i);
});
test('IA desabilitada e callback desconectado mantêm botão inativo sem aviso de envio', async () => {
  const disabled = fixture({ enabled: false, provider: 'groq' }); await disabled.render();
  assert.equal(disabled.button.disabled, true); assert.match(disabled.status.textContent, /ainda não configurada/); assert.equal(disabled.listeners.length, 0);
  const detached = fixture({ enabled: true, provider: 'groq' }, false); await detached.render();
  assert.equal(detached.button.disabled, true); assert.equal(detached.status.textContent, undefined); assert.equal(detached.listeners.length, 0);
});
