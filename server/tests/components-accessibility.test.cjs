'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function fixture() {
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.style = {}; this.value = ''; this.inert = false; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    removeAttribute(key) { delete this.attributes[key]; }
    get classList() { return { contains: value => this.className?.split(' ').includes(value) || false }; }
    set innerHTML(value) { this.html = value; this.children = []; }
    get innerHTML() { return this.html || ''; }
    appendChild(child) { child.parentElement?.removeChild(child); this.children.push(child); child.parentElement = child.parentNode = this; return child; }
    removeChild(child) { this.children = this.children.filter(node => node !== child); child.parentElement = null; }
    insertBefore(child, before) { this.children.splice(this.children.indexOf(before), 0, child); child.parentElement = child.parentNode = this; }
    remove() { this.parentElement?.removeChild(this); }
    contains(target) { return this === target || this.children.some(child => child.contains(target)); }
    querySelector(selector) {
      const matches = node => selector === '[role="dialog"]' ? node.getAttribute('role') === 'dialog' :
        selector === '[data-modal-toast-container]' ? node.getAttribute('data-modal-toast-container') !== null :
        selector.startsWith('.') ? node.classList.contains(selector.slice(1)) : false;
      for (const child of this.children) { if (matches(child)) return child; const nested = child.querySelector(selector); if (nested) return nested; }
      // Toast close/message nodes are represented without an HTML parser.
      if ((selector === '.toast-close' || selector === '.toast-message') && this.innerHTML.includes(selector.slice(1))) { const node = new Element(); node.className = selector.slice(1); this.appendChild(node); return node; }
      return null;
    }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    focus() {}
    dispatch(type, values = {}) { const event = { target: this, key: '', preventDefault() { this.prevented = true; }, stopPropagation() {}, ...values }; for (const handler of this.listeners[type] || []) handler(event); return event; }
  }
  const body = new Element('body'), input = new Element('input'), wrapper = new Element();
  wrapper.className = 'autocomplete-wrapper'; body.appendChild(wrapper); wrapper.appendChild(input); input.id = 'search';
  const globalToasts = new Element(), overlay = new Element(), dialog = new Element();
  globalToasts.id = 'toast-container'; globalToasts.inert = true; body.appendChild(globalToasts);
  overlay.id = 'modal-overlay'; overlay.style.display = 'flex'; dialog.setAttribute('role', 'dialog'); body.appendChild(overlay); overlay.appendChild(dialog);
  const title = new Element(), modalBody = new Element(), footer = new Element(), closer = new Element('button');
  dialog.appendChild(title); dialog.appendChild(closer); dialog.appendChild(modalBody); dialog.appendChild(footer);
  const nodes = { search: input, 'toast-container': globalToasts, 'modal-overlay': overlay, 'modal-title': title, 'modal-body': modalBody, 'modal-footer': footer, 'btn-modal-close': closer };
  const document = { body, activeElement: input, getElementById: id => nodes[id], createElement: tag => new Element(tag), addEventListener() {} };
  const context = vm.createContext({ document, window: {}, setTimeout() {} });
  for (const name of ['autocomplete', 'toast']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, `../../client/js/components/${name}.js`), 'utf8') + `\nglobalThis.${name}Fixture = ${name === 'toast' ? 'Toast' : 'Autocomplete'};`, context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../client/js/components/modal.js'), 'utf8') + '\nglobalThis.modalFixture = Modal;', context);
  return { ...context, input, wrapper, dialog, overlay, globalToasts };
}

test('autocomplete exposes results and selects via arrows/Enter without firing on typing', () => {
  const f = fixture(), selected = [], item = { id: 7, label: '<Ana>' };
  f.autocompleteFixture.init('search', [item, { id: 8, label: 'Anabela' }], value => selected.push(value));
  assert.equal(f.input.getAttribute('role'), 'combobox');
  f.input.value = 'ana'; f.input.dispatch('input');
  assert.equal(selected.length, 0);
  const dropdown = f.wrapper.querySelector('.autocomplete-dropdown');
  assert.equal(dropdown.getAttribute('role'), 'listbox'); assert.equal(f.input.getAttribute('aria-expanded'), 'true');
  assert.equal(dropdown.children[0].textContent, '<Ana>');
  assert.equal(f.input.dispatch('keydown', { key: 'ArrowDown' }).prevented, true);
  assert.equal(f.input.getAttribute('aria-activedescendant'), dropdown.children[0].id);
  assert.equal(dropdown.children[0].getAttribute('aria-selected'), 'true');
  assert.equal(f.input.dispatch('keydown', { key: 'Enter' }).prevented, true);
  assert.equal(selected[0], item); assert.equal(f.input.value, '<Ana>');
  assert.equal(f.input.getAttribute('aria-expanded'), 'false'); assert.equal(f.input.getAttribute('aria-activedescendant'), null);
});

test('autocomplete supports up, Escape, Tab, empty results and mouse selection', () => {
  const f = fixture(), selected = [];
  f.autocompleteFixture.init('search', [{ id: 1, label: 'Ana' }, { id: 2, label: 'Anabela' }], value => selected.push(value));
  f.input.value = 'ana'; f.input.dispatch('input'); f.input.dispatch('keydown', { key: 'ArrowUp' });
  const dropdown = f.wrapper.querySelector('.autocomplete-dropdown');
  assert.equal(f.input.getAttribute('aria-activedescendant'), dropdown.children[1].id);
  f.input.dispatch('keydown', { key: 'Escape' }); assert.equal(f.input.getAttribute('aria-expanded'), 'false');
  f.input.dispatch('input'); f.input.dispatch('keydown', { key: 'Tab' }); assert.equal(f.input.getAttribute('aria-expanded'), 'false');
  f.input.dispatch('input'); dropdown.children[0].dispatch('click'); assert.equal(selected[0].id, 1);
  f.input.value = 'missing'; f.input.dispatch('input'); f.input.dispatch('keydown', { key: 'ArrowDown' }); f.input.dispatch('keydown', { key: 'Enter' });
  assert.equal(selected.length, 1); assert.equal(f.input.getAttribute('aria-activedescendant'), null);
  f.input.value = ''; f.input.dispatch('input'); assert.equal(selected.at(-1), null);
});

test('modal validation toast is an accessible alert inside dialog while background stays inert', () => {
  const f = fixture(); f.toastFixture.error('<img src=x onerror=alert(1)>');
  assert.equal(f.globalToasts.inert, true); assert.equal(f.globalToasts.children.length, 0);
  const container = f.dialog.querySelector('[data-modal-toast-container]'); assert.ok(container);
  assert.equal(container.children[0].getAttribute('role'), 'alert');
  assert.equal(container.children[0].getAttribute('aria-atomic'), 'true');
  assert.equal(container.children[0].querySelector('.toast-message').textContent, '<img src=x onerror=alert(1)>');
  assert.ok(!container.children[0].innerHTML.includes('<img'));
});

test('toast outside a modal uses global container and announces success', () => {
  const f = fixture(); f.overlay.style.display = 'none'; f.globalToasts.inert = false;
  f.toastFixture.success('Salvo'); assert.equal(f.globalToasts.children[0].getAttribute('role'), 'status');
});

test('real modal lifecycle keeps background inert and clears scoped alerts on close/reopen', () => {
  const f = fixture(); f.overlay.style.display = 'none'; f.globalToasts.inert = false;
  f.modalFixture.open('Cadastro', '<form></form>');
  assert.equal(f.globalToasts.inert, true);
  f.toastFixture.error('Confira a senha'); assert.ok(f.dialog.querySelector('[data-modal-toast-container]'));
  f.modalFixture.open('Outro diálogo', '<p>Conteúdo</p>');
  assert.equal(f.dialog.querySelector('[data-modal-toast-container]'), null); assert.equal(f.globalToasts.inert, true);
  f.toastFixture.error('Erro'); f.modalFixture.close();
  assert.equal(f.dialog.querySelector('[data-modal-toast-container]'), null); assert.equal(f.globalToasts.inert, false);
});
