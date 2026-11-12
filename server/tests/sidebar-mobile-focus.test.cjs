'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture() {
  const listeners = {}, query = { matches: true, addEventListener(type, fn) { this.change = fn; } };
  const document = { activeElement: null, getElementById: id => elements[id], addEventListener(type, fn) { listeners[type] = fn; } };
  function node(parent = null) { return { parentElement: parent, inert: false, hidden: false, disabled: false, tabIndex: 0,
    classList: { values: new Set(), contains(x) { return this.values.has(x); }, add(x) { this.values.add(x); }, remove(x) { this.values.delete(x); } },
    setAttribute() {}, getClientRects() { return [1]; }, closest(selector) { for (let n = this; n; n = n.parentElement) if (n.inert && selector.includes('inert')) return n; return null; },
    contains(other) { for (let n = other; n; n = n.parentElement) if (n === this) return true; return false; }, focus() { document.activeElement = this; } }; }
  const app = node(), sidebar = node(app), closer = node(sidebar), nav = node(sidebar), logout = node(sidebar), opener = node(app), modalButton = node();
  const elements = { sidebar, 'sidebar-overlay': node(app), 'sidebar-nav': nav, 'btn-close-sidebar': closer, 'btn-open-sidebar': opener };
  sidebar.querySelectorAll = () => [closer, nav, logout];
  const context = vm.createContext({ document, window: { matchMedia: () => query } });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../client/js/components/sidebar.js'), 'utf8') + '\nglobalThis.subject = Sidebar;', context);
  const subject = context.subject; subject.render = () => {}; subject.init('admin');
  function key(key, shiftKey = false) { const event = { key, shiftKey, target: document.activeElement, prevented: false, preventDefault() { this.prevented = true; } }; listeners.keydown(event); return event; }
  return { subject, document, sidebar, closer, nav, logout, opener, app, query, modalButton, key, elements };
}
test('mobile sidebar wraps Tab in both directions and skips disabled or hidden controls', () => {
  const f = fixture(); f.subject.openMobile();
  f.logout.focus(); assert.equal(f.key('Tab').prevented, true); assert.equal(f.document.activeElement, f.closer);
  assert.equal(f.key('Tab', true).prevented, true); assert.equal(f.document.activeElement, f.logout);
  f.logout.disabled = true; f.nav.focus(); f.key('Tab'); assert.equal(f.document.activeElement, f.closer);
  f.logout.disabled = false; f.logout.hidden = true; f.nav.focus(); f.key('Tab'); assert.equal(f.document.activeElement, f.closer);
});
test('Escape restores opener, desktop and resize release keyboard containment', () => {
  const f = fixture(); f.subject.openMobile(); f.key('Escape'); assert.equal(f.document.activeElement, f.opener); assert.equal(f.sidebar.inert, true);
  f.subject.openMobile(); f.query.matches = false; f.query.change(); assert.equal(f.sidebar.inert, false); assert.equal(f.sidebar.classList.contains('open'), false);
  f.logout.focus(); assert.equal(f.key('Tab').prevented, false);
});
test('a modal owning focus and inert background takes precedence over the mobile sidebar', () => {
  const f = fixture(); f.subject.openMobile(); f.app.inert = true; f.modalButton.focus();
  assert.equal(f.key('Tab').prevented, false); f.key('Escape'); assert.equal(f.sidebar.classList.contains('open'), true);
  f.app.inert = false; f.key('Escape'); assert.equal(f.sidebar.classList.contains('open'), true, 'modal Escape must not also dismiss the drawer');
  f.logout.focus(); f.key('Tab'); assert.equal(f.document.activeElement, f.closer);
});
test('Tab arriving from covered content returns to the drawer unless a modal is open', () => {
  const f = fixture(); f.subject.openMobile(); f.opener.focus();
  assert.equal(f.key('Tab').prevented, true); assert.equal(f.document.activeElement, f.closer);
  f.opener.focus(); f.key('Tab', true); assert.equal(f.document.activeElement, f.logout);
  f.elements['modal-overlay'] = { style: { display: 'flex' } }; f.modalButton.focus();
  assert.equal(f.key('Tab').prevented, false); assert.equal(f.document.activeElement, f.modalButton);
});
