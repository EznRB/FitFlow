'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
test('nova conta inicia com menu mobile fechado, sem recuperar foco da conta anterior', () => {
  const node = names => ({ classList: { values: new Set(names), contains(value) { return this.values.has(value); },
    add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); } },
    attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, focus() { focused.push(this); } });
  const focused = [], sidebar = node(['open']), overlay = node(['active']), opener = node([]), closer = node([]);
  const elements = { sidebar, 'sidebar-overlay': overlay, 'sidebar-nav': node([]), 'btn-open-sidebar': opener, 'btn-close-sidebar': closer };
  const context = vm.createContext({ document: { getElementById: id => elements[id], addEventListener() {} },
    window: { matchMedia: () => ({ matches: true, addEventListener() {} }) } });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../client/js/components/sidebar.js'), 'utf8') + '\nglobalThis.fixtureSidebar = Sidebar;', context);
  const menu = context.fixtureSidebar; menu.render = () => {};
  menu.init('admin');
  assert.equal(sidebar.classList.contains('open'), false); assert.equal(overlay.classList.contains('active'), false);
  assert.equal(sidebar.inert, true); assert.equal(opener.attributes['aria-expanded'], 'false'); assert.equal(focused.length, 0);
  menu.openMobile(); assert.equal(sidebar.inert, false); assert.equal(opener.attributes['aria-expanded'], 'true');
  assert.equal(focused.at(-1), closer);
  menu.init('student');
  assert.equal(sidebar.classList.contains('open'), false); assert.equal(sidebar.inert, true);
  assert.equal(focused.length, 1, 'A inicialização não desloca o foco para um botão da sessão anterior.');
});
