const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function harness() {
  const nodes = new Map(), messages = []; let focused;
  const node = id => { if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', attrs: {}, setAttribute(k,v) { this.attrs[k] = v; }, focus() { focused = id; } }); return nodes.get(id); };
  let html;
  const context = vm.createContext({ console, crypto: webcrypto, TextEncoder, navigator: {}, setTimeout() {},
    Auth: { user: { id: 7, role: 'admin' }, generation: 1 }, window: { addEventListener() {} },
    document: { getElementById: node }, localStorage: { getItem() { return null; } },
    Toast: { error(message) { messages.push(message); } },
    Modal: { open(title, body) { html = body; } } });
  for (const file of ['security', 'pagamentos']) vm.runInContext(fs.readFileSync(path.join(__dirname, `../../client/js/${file}.js`), 'utf8'), context);
  const view = vm.runInContext('PagamentosView', context);
  return { view, node, get html() { return html; }, get focused() { return focused; } };
}
test('registro manual oferece submit por Enter e ignora submissão de modal substituído', async () => {
  const h = harness(); await h.view.abrirModalRegistro();
  assert.match(h.html, /<button[^>]*type="submit"/);
  let calls = 0, prevented = 0; h.view.submeterPagamento = () => { calls++; };
  h.node('form-pagamento').onsubmit({ preventDefault() { prevented++; } });
  assert.equal(calls, 1); assert.equal(prevented, 1);
  h.view.invalidar();
  h.node('form-pagamento').onsubmit({ preventDefault() {} });
  assert.equal(calls, 1);
});
test('validação mantém erro associado ao aluno/valor e move foco ao campo inválido', async () => {
  const h = harness(); await h.view.abrirModalRegistro();
  assert.match(h.html, /id="input-pgto-aluno"[^>]*aria-describedby="pgto-aluno-error"/);
  assert.match(h.html, /id="input-pgto-valor"[^>]*aria-describedby="pgto-valor-error"/);
  await h.view.submeterPagamento();
  assert.equal(h.focused, 'input-pgto-aluno');
  assert.equal(h.node('input-pgto-aluno').attrs['aria-invalid'], 'true');
  assert.match(h.node('pgto-aluno-error').textContent, /Selecione/);
  h.node('input-pgto-aluno').value = '11';
  await h.view.submeterPagamento();
  assert.equal(h.focused, 'input-pgto-valor');
  assert.equal(h.node('input-pgto-aluno').attrs['aria-invalid'], 'false');
  assert.equal(h.node('pgto-aluno-error').textContent, '');
  assert.equal(h.node('input-pgto-valor').attrs['aria-invalid'], 'true');
  assert.match(h.node('pgto-valor-error').textContent, /valor/);
});
