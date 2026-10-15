const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../client/js/evidencias.js'), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
class Element {
  constructor(tag = 'div') { this.tag = tag; this.classList = { add() {} }; this.children = []; this.listeners = {}; this.attributes = {}; this.value = ''; this.checked = false; this.isConnected = true; this.scrollHeight = 400; this.scrollTop = 300; this.clientHeight = 300; this.focusCount = 0; }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  replaceChildren() { this.children.forEach(c => { c.parent = null; }); this.children = []; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getBoundingClientRect() { return { top: 0, bottom: 300, height: 300 }; }
  focus() { this.focusCount++; }
}
function fixture() {
  const calls = [], events = {}, auth = { user: { id: 1 }, generation: 4, sessionEpoch: 'a', getSessionEpoch() { return this.sharedEpoch || this.sessionEpoch; }, sessionEpochKey: 'epoch' };
  const context = vm.createContext({ Auth: auth, document: { createElement: tag => new Element(tag) },
    window: { addEventListener: (type, fn) => { events[type] = fn; } },
    FitFlowScience: { references: { valid: { title: 'Fonte revisada', url: 'https://pubmed.ncbi.nlm.nih.gov/38595233/' } } },
    API: { get: async () => ({ data: { chatEnabled: true } }), post: async (url, body) => { calls.push({ url, body: JSON.parse(JSON.stringify(body)) }); return { data: { message: 'Resposta educativa.', generatedByAI: true, sources: [{ id: 'valid' }], kind: 'answer' } }; } },
  });
  vm.runInContext(`${source}\nglobalThis.view = EvidenciasView;`, context);
  const mount = async () => {
    const nodes = Object.fromEntries(['ia-thread', 'ia-chat-form', 'ia-message', 'ia-consent', 'ia-send', 'ia-reset', 'ia-chat-status', 'ia-context-note', 'ia-check-service'].map(id => [id, new Element()]));
    const container = { isConnected: true, querySelector: selector => nodes[selector.slice(1)] };
    context.view.mountChat(container); await Promise.resolve(); await Promise.resolve();
    return { nodes, container, input: nodes['ia-message'], send: nodes['ia-send'], status: nodes['ia-chat-status'], consent: nodes['ia-consent'], thread: nodes['ia-thread'],
      set(text, consent = true) { nodes['ia-message'].value = text; nodes['ia-consent'].checked = consent; nodes['ia-message'].listeners.input(); },
      submit() { nodes['ia-chat-form'].listeners.submit({ preventDefault() {} }); },
    };
  };
  return { context, view: context.view, calls, auth, events, mount };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('chat requires consent and sends a continuous conversation with source IDs resolved locally', async () => {
  const h = fixture(), ui = await h.mount();
  ui.set('Quero organizar meus treinos', false); ui.submit(); await settle(); assert.equal(h.calls.length, 0); assert.equal(ui.send.disabled, true);
  ui.set('Treino 3 dias por semana'); ui.submit(); await settle();
  ui.set('Tenho 50 minutos. E a progressão?'); ui.submit(); await settle();
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].url, '/ia/chat'); assert.equal(h.calls[1].body.consent, true);
  assert.deepEqual(h.calls[1].body.messages.map(m => m.role), ['user', 'assistant', 'user']);
  assert.equal(h.calls[1].body.messages[2].content, 'Tenho 50 minutos. E a progressão?');
  assert.equal(ui.input.value, ''); assert.equal(ui.send.attributes['aria-busy'], 'false');
  const sources = ui.thread.children[1].children[2].children[1];
  assert.equal(sources.children[0].href, h.context.FitFlowScience.references.valid.url);
});

test('quota failure retains typed message and retry does not duplicate a user turn', async () => {
  const h = fixture(), ui = await h.mount(); const request = deferred();
  h.context.API.post = async (url, body) => { h.calls.push(JSON.parse(JSON.stringify(body))); return request.promise; };
  ui.set('Preciso ir até a falha?'); ui.submit(); ui.submit(); assert.equal(h.calls.length, 1); assert.equal(ui.send.disabled, true); assert.equal(ui.input.readOnly, true);
  request.reject(Object.assign(new Error('Quota'), { status: 429 })); await settle();
  assert.equal(ui.input.value, 'Preciso ir até a falha?'); assert.match(ui.status.textContent, /Limite temporário/); assert.equal(ui.send.disabled, false);
  h.context.API.post = async (url, body) => { h.calls.push(JSON.parse(JSON.stringify(body))); return { data: { message: 'Não é obrigatório.', generatedByAI: true, sources: [], kind: 'answer' } }; };
  ui.submit(); await settle(); assert.equal(h.calls[1].messages.length, 1); assert.equal(h.view.chatState.messages.length, 2);
});

test('rendered plain text rejects model markup and arbitrary source URLs; routine drafts are explicitly marked', async () => {
  const h = fixture(), ui = await h.mount(); const markup = '<img src=x onerror=alert(1)>\nSegunda: treino A';
  h.context.API.post = async () => ({ data: { message: markup, generatedByAI: true, kind: 'routine_draft', sources: [{ id: 'valid', url: 'javascript:alert(1)' }, { id: '__proto__', url: 'https://evil.test' }] } });
  ui.set('<script>alert(1)</script>'); ui.submit(); await settle();
  assert.equal(ui.thread.children[0].children[1].textContent, '<script>alert(1)</script>');
  const reply = ui.thread.children[1]; assert.equal(reply.children[1].textContent, markup); assert.equal(reply.children[1].children.length, 0);
  assert.match(reply.children[2].textContent, /Rascunho educativo/); const links = reply.children[3].children[1].children;
  assert.equal(links.length, 1); assert.ok(links[0].href.startsWith('https://pubmed.ncbi.nlm.nih.gov/'));
});

test('late replies cannot enter another account, a changed epoch or a replacement page', async () => {
  for (const change of ['account', 'epoch', 'navigation']) {
    const h = fixture(), old = await h.mount(), request = deferred(); h.context.API.post = () => request.promise;
    old.set('Mensagem privada da conta 1'); old.submit();
    if (change === 'account') { h.auth.user = { id: 2 }; h.auth.generation++; }
    if (change === 'epoch') h.auth.sharedEpoch = 'different';
    if (change === 'navigation') old.container.querySelector = () => null;
    request.resolve({ data: { message: 'Resposta privada antiga', generatedByAI: true, sources: [] } }); await settle();
    assert.equal(old.thread.children.length, 1); assert.equal(old.input.value, 'Mensagem privada da conta 1');
    if (change === 'account') { const current = await h.mount(); assert.equal(h.view.chatState.messages.length, 0); assert.equal(current.input.value, ''); assert.equal(current.consent.checked, false); }
  }
});

test('revisiting the same account restores context and retries an unanswered request; logout clears memory', async () => {
  const h = fixture(), first = await h.mount(), request = deferred(); h.context.API.post = () => request.promise;
  first.set('Minha rotina tem 3 dias'); first.submit(); first.container.isConnected = false;
  const next = await h.mount(); assert.equal(next.input.value, 'Minha rotina tem 3 dias'); assert.match(next.send.textContent, /Tentar novamente/);
  request.resolve({ data: { message: 'Resposta obsoleta', generatedByAI: true, sources: [] } }); await settle(); assert.equal(next.thread.children.length, 1); assert.equal(next.input.value, 'Minha rotina tem 3 dias');
  h.events['auth:logout'](); assert.equal(h.view.chatState, null);
});

test('long valid routine remains intact; follow-up trims complete pairs to limits with an explicit notice', async () => {
  const h = fixture(), ui = await h.mount(); let count = 0;
  h.context.API.post = async (url, body) => { h.calls.push(JSON.parse(JSON.stringify(body))); return { data: { message: count++ < 2 ? 'R'.repeat(6000) : 'Resposta curta', generatedByAI: true, sources: [], kind: 'routine_draft' } }; };
  ui.set('Rotina de 4 dias'); ui.submit(); await settle(); assert.equal(h.view.chatState.messages[1].content.length, 6000);
  ui.set('E os descansos?'); ui.submit(); await settle(); ui.set('E a carga?'); ui.submit(); await settle();
  const sent = h.calls[2].messages; assert.equal(sent.length, 3); assert.deepEqual(sent.map(m => m.role), ['user', 'assistant', 'user']); assert.equal(sent[2].content, 'E a carga?');
  assert.ok(sent.reduce((n, m) => n + m.content.length, 0) <= 12000); assert.equal(ui.nodes['ia-context-note'].hidden, false); assert.match(ui.nodes['ia-context-note'].textContent, /pares.*antigos/);
});

test('suggested prompts fill the draft without transmitting; replies preserve reader focus and existing nodes', async () => {
  const h = fixture(), ui = await h.mount(); const suggestion = ui.thread.children[0].children[3].children[0]; suggestion.listeners.click();
  assert.match(ui.input.value, /divisão de treino/); assert.equal(h.calls.length, 0); assert.equal(ui.input.focusCount, 1);
  ui.consent.checked = true; ui.consent.listeners.change(); ui.submit(); await settle(); const firstReply = ui.thread.children[1];
  ui.set('Continue'); ui.submit(); await settle(); assert.equal(ui.thread.children[1], firstReply); assert.equal(ui.input.focusCount, 1);
  ui.nodes['ia-reset'].listeners.click(); assert.equal(h.view.chatState.messages.length, 0); assert.equal(ui.input.value, ''); assert.equal(ui.input.focusCount, 2);
});

test('keyboard composing does not send; Shift+Enter keeps multiline entry; unavailable status leaves sources and draft usable', async () => {
  const h = fixture(); h.context.API.get = async () => ({ data: { enabled: true, chatEnabled: false } }); const ui = await h.mount();
  ui.set('Pergunta preservada'); ui.input.listeners.keydown({ key: 'Enter', isComposing: true }); ui.input.listeners.keydown({ key: 'Enter', shiftKey: true });
  assert.equal(h.calls.length, 0); assert.equal(ui.send.disabled, true); assert.equal(ui.input.value, 'Pergunta preservada'); assert.match(ui.status.textContent, /indisponível/);
  assert.equal(ui.nodes['ia-check-service'].hidden, false);
  h.context.API.get = async () => ({ data: { chatEnabled: true } }); ui.nodes['ia-check-service'].listeners.click(); await settle();
  assert.equal(ui.send.disabled, false); assert.equal(ui.input.value, 'Pergunta preservada'); assert.equal(ui.nodes['ia-check-service'].hidden, true);
});

test('a failed availability lookup permits manual recovery and a late lookup cannot update a new account', async () => {
  const h = fixture(); h.context.API.get = async () => { throw new Error('Network'); }; const ui = await h.mount(); ui.set('Pergunta na reconexão');
  assert.equal(ui.send.disabled, false); ui.submit(); await settle(); assert.equal(h.calls.length, 1);
  const waiting = deferred(); h.context.API.get = () => waiting.promise; const old = await h.mount();
  h.auth.user = { id: 2 }; h.auth.generation++;
  h.context.API.get = async () => ({ data: { chatEnabled: false } }); const current = await h.mount();
  waiting.resolve({ data: { chatEnabled: true } }); await settle();
  assert.equal(current.send.disabled, true); assert.match(current.status.textContent, /indisponível/); assert.equal(old.send.disabled, true);
});

test('public laboratory without Auth or without an authenticated user exposes reviewed sources and a working login CTA', () => {
  for (const absentAuth of [true, false]) {
    const h = fixture();
    if (absentAuth) delete h.context.Auth; else h.auth.user = null;
    h.context.FitFlowScience.references['split-2024'] = { title: 'Split e full body', url: 'https://pubmed.ncbi.nlm.nih.gov/38595233/' };
    h.context.FitFlowScience.references['acsm-2026'] = { title: 'ACSM', url: 'https://pubmed.ncbi.nlm.nih.gov/41843416/' };
    let queries = 0; h.context.API.get = () => { queries++; throw new Error('Public page must not call private API'); };
    const split = new Element(), volume = new Element();
    const container = { innerHTML: '', querySelector: selector => selector === '#split-sources' ? split : selector === '#volume-sources' ? volume : null };
    h.view.render(container);
    assert.match(container.innerHTML, /href="\/">Acessar minha conta/);
    assert.match(container.innerHTML, /Volume previsto ≠ executado/);
    assert.match(container.innerHTML, /Conteúdo educativo para adultos saudáveis/);
    assert.ok(!container.innerHTML.includes('ia-chat-form'));
    assert.ok(!container.innerHTML.includes('Verificando disponibilidade'));
    assert.equal(split.children.length, 2); assert.equal(volume.children.length, 1); assert.equal(queries, 0); assert.equal(h.calls.length, 0);
  }
});
