const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('voltar ao login fecha o modal real, remove conteúdo privado e libera o formulário inert', () => {
  const login = { style: {}, inert: true }, app = { style: {}, inert: true };
  const body = { style: { overflow: 'hidden' } };
  const context = vm.createContext({
    document: { body, addEventListener() {}, getElementById: id => id === 'login-screen' ? login : app },
    window: {},
  });
  for (const file of ['components/modal.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../client/js', file), 'utf8'), context);
  }
  vm.runInContext('globalThis.views = { App, Modal };', context);
  const { App, Modal } = context.views;
  Modal.overlay = { style: { display: 'flex' } };
  Modal.titleEl = { textContent: 'Perfil privado de fixture' };
  Modal.bodyEl = { innerHTML: '<form>Dados privados fictícios</form>' };
  Modal.footerEl = { innerHTML: '<button>Salvar</button>' };
  Modal.background = [{ node: login, inert: false }, { node: app, inert: false }];
  App.showLogin();
  assert.equal(Modal.overlay.style.display, 'none');
  assert.equal(Modal.titleEl.textContent, '');
  assert.equal(Modal.bodyEl.innerHTML, ''); assert.equal(Modal.footerEl.innerHTML, '');
  assert.equal(login.inert, false); assert.equal(app.inert, false);
  assert.equal(body.style.overflow, '');
  assert.equal(login.style.display, 'flex'); assert.equal(app.style.display, 'none');
});
