'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const planner = require('../../client/js/planejamento-ciencia');

function fixture() {
  const nodes = new Map();
  function node(id, value = '') {
    const listeners = new Map();
    let html = '', text = '';
    const element = { id, value, checked: true,
      get innerHTML() { return html; }, set innerHTML(value) { html = value; text = ''; },
      get textContent() { return text; }, set textContent(value) { text = value; html = ''; },
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); },
      fire(type) { for (const callback of listeners.get(type) || []) callback({ target: element }); } };
    nodes.set(id, element); return element;
  }
  for (const [id, value] of [['days', '3'], ['minutes', '45'], ['goal', 'general'], ['consistency', 'regular'],
    ['compare', ''], ['result', ''], ['sets', '4'], ['exposures', '2'], ['volume-result', ''], ['routine-summary', '']]) node(`planning-${id}`, value);
  const equipment = [node('equipment-bodyweight', 'bodyweight'), node('equipment-dumbbells', 'dumbbells')];
  const container = { innerHTML: '', querySelector: selector => nodes.get(selector.slice(1)),
    querySelectorAll: selector => selector.endsWith(':checked') ? equipment.filter(item => item.checked) : equipment };
  planner.mount(container);
  return { nodes, equipment, container };
}

test('alterar contexto remove comparação antiga sem apagar campos, ficha ou volume explícito', () => {
  for (const id of ['days', 'minutes', 'goal', 'consistency', 'equipment-dumbbells']) {
    const { nodes, equipment, container } = fixture();
    const result = nodes.get('planning-result');
    nodes.get('planning-compare').fire('click');
    assert.match(result.innerHTML, /planning-options/);
    planner.updateRoutine(container, [{ muscleGroup: 'Peito', sets: 3 }]);
    nodes.get('planning-sets').fire('input');
    const summary = nodes.get('planning-routine-summary').textContent;
    const volume = nodes.get('planning-volume-result').textContent;
    const control = nodes.get(id.startsWith('equipment') ? id : `planning-${id}`);
    if (id === 'equipment-dumbbells') { control.checked = false; }
    else control.value = { days: '2', minutes: '60', goal: 'strength', consistency: 'variable' }[id];
    control.fire(id === 'minutes' ? 'input' : 'change');
    assert.match(result.textContent, /contexto.*alterado|contexto.*mudou/i);
    assert.match(result.textContent, /comparar/i);
    assert.doesNotMatch(result.innerHTML, /planning-options/);
    assert.equal(nodes.get('planning-routine-summary').textContent, summary);
    assert.equal(nodes.get('planning-volume-result').textContent, volume);
    assert.equal(nodes.get('planning-sets').value, '4');
    assert.equal(equipment[0].checked, true);
    nodes.get('planning-compare').fire('click');
    assert.match(result.innerHTML, /planning-options/);
    if (id === 'minutes') assert.match(result.innerHTML, /60 minutos/);
  }
});
