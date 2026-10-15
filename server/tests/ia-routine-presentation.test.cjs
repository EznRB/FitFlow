const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { program: rawProgram, routineUserText } = require('./fixtures/ia-routine.cjs');
const { validateProgram, renderProgram } = require('../src/services/ia-routine');
const source = fs.readFileSync(path.resolve(__dirname, '../../client/js/evidencias.js'), 'utf8');
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.classList = { add() {} }; this.value = ''; this.checked = false; this.isConnected = true; this.scrollHeight = 400; this.clientHeight = 300; this._scrollTop = 100; this.scrollWrites = 0; this.focusCount = 0; }
  set scrollTop(value) { this.scrollWrites++; this._scrollTop = Math.max(0, Math.min(Number(value), this.scrollHeight - this.clientHeight)); }
  get scrollTop() { return this._scrollTop; }
  getBoundingClientRect() { return { top: 0, bottom: 300, height: 300 }; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { throw new Error('A resposta dinâmica não deve usar innerHTML: ' + value); }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  replaceChildren() { this.children = []; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  focus() { this.focusCount++; }
}
const flatten = node => [node, ...node.children.flatMap(flatten)];
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function response() {
  const program = validateProgram(rawProgram(), [{ role: 'user', content: routineUserText }]);
  return { data: { message: renderProgram(program), program, generatedByAI: true, kind: 'routine_draft', sources: [{ id: 'valid' }] } };
}
async function fixture(result = response()) {
  const events = {}, calls = [], auth = { user: { id: 1 }, generation: 4, sessionEpoch: 'owner', getSessionEpoch() { return this.sharedEpoch || this.sessionEpoch; } };
  const context = vm.createContext({ Auth: auth, document: { createElement: tag => new Element(tag) },
    window: { addEventListener: (type, listener) => { events[type] = listener; } },
    FitFlowScience: { references: { valid: { title: 'Fonte revisada', url: 'https://pubmed.ncbi.nlm.nih.gov/38595233/' } } },
    API: { get: async () => ({ data: { chatEnabled: true } }), post: async (url, body) => { calls.push(JSON.parse(JSON.stringify(body))); return result; } } });
  vm.runInContext(source + '\nglobalThis.view = EvidenciasView;', context);
  const nodes = Object.fromEntries(['ia-thread', 'ia-chat-form', 'ia-message', 'ia-consent', 'ia-send', 'ia-reset', 'ia-chat-status', 'ia-context-note', 'ia-check-service'].map(id => [id, new Element()]));
  const container = { isConnected: true, querySelector: selector => nodes[selector.slice(1)] };
  context.view.mountChat(container); await settle();
  const send = async text => { nodes['ia-message'].value = text; nodes['ia-consent'].checked = true; nodes['ia-message'].listeners.input(); nodes['ia-chat-form'].listeners.submit({ preventDefault() {} }); await settle(); };
  return { context, view: context.view, auth, events, nodes, calls, container, send,
    reply: () => nodes['ia-thread'].children[1] };
}

test('rascunho validado vira documento de sessões e preserva texto servidor original no histórico', async () => {
  const result = response(), h = await fixture(result); await h.send(routineUserText);
  const reply = h.reply(), all = flatten(reply), doc = all.find(node => node.className === 'ia-routine-document');
  assert.ok(doc, 'O rascunho deve ter estrutura visual própria');
  assert.equal(all.filter(node => node.className === 'ia-routine-session').length, 3);
  assert.equal(all.filter(node => node.className === 'ia-routine-exercise').length, 7);
  assert.match(doc.textContent, /Segunda/); assert.match(doc.textContent, /Supino na máquina/);
  assert.match(doc.textContent, /3 séries/); assert.match(doc.textContent, /8–12 repetições/);
  assert.match(doc.textContent, /RIR 2/); assert.match(doc.textContent, /120 s/);
  assert.match(doc.textContent, /Contagem direta planejada/); assert.doesNotMatch(doc.textContent, /kg/);
  const interpretation = all.find(node => node.className === 'ia-routine-interpretation');
  assert.ok(interpretation); assert.match(interpretation.textContent, /Como interpretar este rascunho/);
  const visibleLimits = all.find(node => node.className === 'ia-routine-limits');
  for (const warning of ['Participação indireta', 'Não inclui filas', 'A razão individual de cada dose']) assert.ok(visibleLimits.textContent.includes(warning), warning);
  for (const warning of ['Progressão:', 'Fundamento:', 'Esforço e descanso:']) assert.ok(interpretation.textContent.includes(warning), warning);
  assert.equal(h.view.chatState.messages[1].content, result.data.message);
  await h.send('Agora tenho somente halteres.');
  assert.equal(h.calls[1].messages[1].content, result.data.message);
  assert.deepEqual(Object.keys(h.calls[1].messages[1]), ['role', 'content']);
  assert.doesNotMatch(interpretation.textContent, /• Supino/);
});

test('valores estruturados que divergem do texto canônico usam resposta original sem segunda prescrição', async () => {
  const result = response(); result.data.program.sessions[0].exercises[0].sets = 6;
  const h = await fixture(result); await h.send(routineUserText);
  assert.ok(!flatten(h.reply()).some(node => node.className === 'ia-routine-document'));
  assert.equal(h.reply().children[1].textContent, result.data.message);
  assert.equal(h.view.chatState.messages[1].content, result.data.message);
});

test('dias disponíveis e sessões planejadas permanecem distintos, sem criar treino no dia livre', async () => {
  const raw = rawProgram(); raw.sessions.pop();
  const program = validateProgram(raw, [{ role: 'user', content: routineUserText }]);
  const h = await fixture({ data: { message: renderProgram(program), program, generatedByAI: true, kind: 'routine_draft' } });
  await h.send(routineUserText);
  const all = flatten(h.reply()), context = all.find(node => node.className === 'ia-routine-context');
  assert.match(context.textContent, /Dias disponíveisSegunda, Quarta, Sexta/);
  assert.equal(all.filter(node => node.className === 'ia-routine-session').length, 2);
});

for (const invalid of ['missing-summary', 'missing-estimate', 'unknown-day', 'unknown-group', 'invalid-dose', 'markup', 'answer']) {
  test(`fallback seguro com ${invalid} não inventa contagens nem logística`, async () => {
    const result = response();
    if (invalid === 'missing-summary') delete result.data.program.weeklySummary;
    if (invalid === 'missing-estimate') result.data.program.sessionEstimates.pop();
    if (invalid === 'unknown-day') result.data.program.sessions[0].day = '__proto__';
    if (invalid === 'unknown-group') result.data.program.sessions[0].exercises[0].primaryGroup = 'unknown';
    if (invalid === 'invalid-dose') result.data.program.sessions[0].exercises[0].sets = null;
    if (invalid === 'markup') { result.data.program.sessions[0].exercises[0].name = '<img src=x onerror=alert(1)>'; result.data.message = '<img src=x onerror=alert(1)>\nResposta segura como texto.'; }
    if (invalid === 'answer') result.data.kind = 'answer';
    const h = await fixture(result); await h.send(routineUserText);
    const all = flatten(h.reply());
    assert.ok(!all.some(node => node.className === 'ia-routine-document'));
    assert.equal(h.reply().children[1].textContent, result.data.message);
    assert.ok(!all.some(node => node.tag === 'img' || node.tag === 'script'));
  });
}

test('links do documento continuam resolvidos por IDs locais, sem aceitar URL arbitrária', async () => {
  const result = response(); result.data.sources = [{ id: 'valid', url: 'javascript:alert(1)' }, { id: '__proto__', url: 'https://evil.test' }];
  const h = await fixture(result); await h.send(routineUserText);
  const links = flatten(h.reply()).filter(node => node.tag === 'a');
  assert.equal(links.length, 1); assert.equal(links[0].href, h.context.FitFlowScience.references.valid.url);
});

test('logout remove programa e mensagem da memória; resposta pendente não recria rascunho', async () => {
  const h = await fixture(); await h.send(routineUserText);
  assert.ok(h.view.chatState.messages[1].program);
  let resolve; h.context.API.post = () => new Promise(ok => { resolve = ok; });
  h.nodes['ia-message'].value = 'Revise'; h.nodes['ia-chat-form'].listeners.submit({ preventDefault() {} });
  h.events['auth:logout'](); assert.equal(h.view.chatState, null);
  resolve(response()); await settle(); assert.equal(h.view.chatState, null);
});

function responseGeometry(h) {
  const thread = h.nodes['ia-thread'], create = h.context.document.createElement;
  thread.getBoundingClientRect = () => ({ top: 100, bottom: 400, height: 300 });
  h.context.document.createElement = tag => {
    const element = create(tag);
    if (tag === 'article') element.getBoundingClientRect = () => ({ top: 500 - thread.scrollTop, height: 1200 });
    return element;
  };
  const append = thread.appendChild.bind(thread);
  thread.appendChild = child => {
    const result = append(child);
    if (child.className === 'ia-message ia-message-assistant') thread.scrollHeight = 1800;
    return result;
  };
  return thread;
}

test('nova resposta longa ancora o começo do artigo, sem levar ao rodapé nem mover foco', async () => {
  const h = await fixture(), thread = responseGeometry(h);
  let resolve; h.context.API.post = () => new Promise(ok => { resolve = ok; });
  await h.send(routineUserText);
  resolve(response()); await settle();
  assert.equal(thread.scrollTop, 400, 'scrollTop anterior + topo do artigo - topo do thread');
  assert.ok(thread.scrollTop < thread.scrollHeight - thread.clientHeight);
  assert.equal(h.nodes['ia-message'].focusCount, 0);
});

test('leitura do histórico durante geração não é interrompida pela nova resposta', async () => {
  const h = await fixture(), thread = responseGeometry(h);
  let resolve; h.context.API.post = () => new Promise(ok => { resolve = ok; });
  await h.send(routineUserText);
  thread.scrollTop = 0; thread.scrollWrites = 0;
  resolve(response()); await settle();
  assert.equal(thread.scrollTop, 0); assert.equal(thread.scrollWrites, 0);
});

test('redraw sem nova mensagem mantém scroll e o mesmo details aberto', async () => {
  const h = await fixture(), thread = responseGeometry(h); await h.send(routineUserText);
  const article = h.reply(), details = flatten(article).find(node => node.className === 'ia-routine-interpretation');
  details.open = true; thread.scrollTop = 1500; thread.scrollWrites = 0;
  const context = { state: h.view.chatState, container: h.container, thread,
    rendered: thread.children.map(node => ({ node, message: h.view.chatState.messages[thread.children.indexOf(node)] })) };
  h.view.drawChat(context);
  assert.equal(thread.scrollWrites, 0); assert.equal(thread.scrollTop, 1500);
  assert.equal(h.reply(), article); assert.equal(details.open, true); assert.equal(thread.children.length, 2);
});

function viewportGeometry(h, { workspaceTop = -300, workspaceBottom = 700, threadTop = -140, threadBottom = 400, visible = true } = {}) {
  const thread = responseGeometry(h), reveals = [];
  h.context.window.innerHeight = 800; h.context.document.visibilityState = visible ? 'visible' : 'hidden';
  h.context.document.querySelector = selector => selector === '.topbar' ? { getBoundingClientRect: () => ({ top: 0, bottom: 72 }) } : null;
  thread.parentElement = { getBoundingClientRect: () => ({ top: workspaceTop, bottom: workspaceBottom }) };
  thread.getBoundingClientRect = () => ({ top: threadTop, bottom: threadBottom, height: threadBottom - threadTop });
  thread.scrollIntoView = options => reveals.push(JSON.parse(JSON.stringify(options)));
  return { thread, reveals };
}

test('resposta nova traz região de leitura cortada à vista com nearest, sem mudar foco', async () => {
  const h = await fixture(), { reveals } = viewportGeometry(h);
  await h.send(routineUserText);
  assert.equal(reveals.length, 1);
  assert.deepEqual(reveals[0], { block: 'nearest', inline: 'nearest', behavior: 'instant' });
  assert.equal(h.nodes['ia-message'].focusCount, 0);
});

for (const [placement, geometry] of [['sticky-header', { threadTop: 40, threadBottom: 580 }], ['below-viewport', { threadTop: 350, threadBottom: 890 }]]) {
  test(`resposta revela região cortada por ${placement}`, async () => {
    const h = await fixture(), { reveals } = viewportGeometry(h, geometry); await h.send(routineUserText);
    assert.equal(reveals.length, 1); assert.equal(reveals[0].block, 'nearest');
  });
}

for (const scenario of ['workspace-above', 'workspace-below', 'hidden-page', 'thread-visible', 'reading-history']) {
  test(`resposta não desloca página externa em ${scenario}`, async () => {
    const h = await fixture();
    const geometry = scenario === 'workspace-above' ? { workspaceTop: -1000, workspaceBottom: 60 }
      : scenario === 'workspace-below' ? { workspaceTop: 850, workspaceBottom: 1500 }
      : scenario === 'hidden-page' ? { visible: false }
      : scenario === 'thread-visible' ? { threadTop: 100, threadBottom: 640 } : {};
    const { thread, reveals } = viewportGeometry(h, geometry);
    let resolve; h.context.API.post = () => new Promise(ok => { resolve = ok; });
    await h.send(routineUserText);
    if (scenario === 'reading-history') thread.scrollTop = 0;
    resolve(response()); await settle();
    assert.equal(reveals.length, 0);
  });
}

test('renderização da conversa existente não revela viewport externo nem fecha details', async () => {
  const h = await fixture(), { thread, reveals } = viewportGeometry(h); await h.send(routineUserText);
  const details = flatten(h.reply()).find(node => node.className === 'ia-routine-interpretation'); details.open = true;
  const context = { state: h.view.chatState, container: h.container, thread,
    rendered: thread.children.map((node, i) => ({ node, message: h.view.chatState.messages[i] })) };
  reveals.length = 0; thread.scrollTop = thread.scrollHeight - thread.clientHeight;
  h.view.drawChat(context);
  assert.equal(reveals.length, 0); assert.equal(details.open, true); assert.equal(thread.children.length, 2);
});
