'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const session = id => ({ id: `session-${id}`, planSnapshot: { name: `Ficha ${id}`, exercises: [{ id, name: 'Supino', notes: '<b>Amplitude</b>', catalogSnapshot: { sourceMetadata: { equipment: [{ name: 'Halteres' }] } } }] }, sets: [
 { id: `set-${id}`, exerciseId: id, weightKg: id === 3 ? 20 : 25, reps: 10, kind: 'working', performedAt: '2026-11-22T12:00:00Z' },
 { id: `eight-${id}`, exerciseId: id, weightKg: 30, reps: 8, kind: 'working', performedAt: '2026-11-22T12:01:00Z' },
 { id: `warmup-${id}`, exerciseId: id, weightKg: 10, reps: 10, kind: 'warmup', performedAt: '2026-11-22T11:59:00Z' }
] });
async function fixture() {
 const nodes = new Map(), charts = [];
 function node(selector) { if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', value: '', checked: false, disabled: false, hidden: false, setAttribute() {}, querySelector: node, parentElement: { classList: { add() {} } } }); return nodes.get(selector); }
 const container = { isConnected: true, innerHTML: '', querySelector: node };
 const context = vm.createContext({ Auth: { user: { id: 7, role: 'student' } }, window: { addEventListener() {} },
  API: { get: async () => ({ data: { sessions: [session(3), session(9)], summary7Days: { workingSets: 4, workingVolumeKg: 930, warmupSets: 2 } } }) },
  Chart: class { constructor(canvas, config) { charts.push(config); } destroy() {} },
  FitFlowSecurity: { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]) } });
 vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/progressao.js'), 'utf8'), context);
 const view = context.ProgressaoView; await view.render(container); return { view, node, charts };
}
test('second exercise requires explicit distinct ID and context confirmation; defaults remain separate', async () => {
 const { view, node, charts } = await fixture();
 const select = node('[data-progress-compare]'), consent = node('[data-progress-confirm]');
 assert.equal(view.comparisonId, null); assert.equal(consent.checked, false);
 assert.equal(consent.disabled, true);
 assert.equal(charts.at(-1).data.datasets.length, 1);
 select.value = '9'; select.onchange();
 assert.equal(consent.disabled, false, 'choosing a distinct ID must enable the actual checkbox');
 assert.equal(charts.at(-1).data.datasets.length, 1);
 assert.match(node('[data-progress-comparison-note]').textContent, /confirme/i);
 consent.checked = true; consent.onchange();
 assert.equal(charts.at(-1).data.datasets.length, 2);
 assert.match(charts.at(-1).data.datasets[1].label, /9/);
 assert.match(node('[data-progress-series]').innerHTML, /Identificação 9/);
 assert.match(node('[data-progress-series]').innerHTML, /490/);
 assert.match(node('[data-progress-series]').innerHTML, /&lt;b&gt;Amplitude/);
 const primary = node('[data-progress-exercise]'); primary.value = '9'; primary.onchange();
 assert.equal(consent.checked, false); assert.equal(view.comparisonId, null);
 assert.equal(consent.disabled, true);
 assert.equal(charts.at(-1).data.datasets.length, 1);
 select.value = '3'; select.onchange(); assert.equal(consent.disabled, false);
 select.value = ''; select.onchange(); assert.equal(consent.disabled, true);
});
test('repetition filter applies to each distinct dataset and warmups never merge with work', async () => {
 const { view, node, charts } = await fixture();
 const second = node('[data-progress-compare]'); second.value = '9'; second.onchange();
 const consent = node('[data-progress-confirm]'); consent.checked = true; consent.onchange();
 const reps = node('[data-progress-reps]'); reps.value = '10'; reps.oninput();
 let datasets = charts.at(-1).data.datasets;
 assert.deepEqual(Array.from(datasets, d => d.data.length), [1, 1]);
 assert.equal(datasets[0].data[0].record.exerciseId, 3); assert.equal(datasets[1].data[0].record.exerciseId, 9);
 const warmups = node('[data-progress-warmups]'); warmups.checked = true; warmups.onchange();
 datasets = charts.at(-1).data.datasets;
 assert.equal(datasets.length, 4); assert.match(datasets[1].label, /Aquecimento/); assert.match(datasets[3].label, /Aquecimento/);
 assert.equal(view.data.summary7Days.workingVolumeKg, 930);
 const refresh = view.load(); await refresh;
 assert.equal(consent.checked, false); assert.equal(charts.at(-1).data.datasets.length, 2);
 assert.equal(consent.disabled, false, 'refresh retains an explicit valid pair but requires confirmation again');
});
test('legacy catalog equipment metadata with null entries cannot prevent loading recorded history', () => {
 const { buildExerciseHistory } = require('../../client/js/progressao.js');
 const data = session(3);
 data.planSnapshot.exercises[0].catalogSnapshot.sourceMetadata.equipment = [null, {}, { name: 'Halteres' }];
 const history = buildExerciseHistory([data]);
 assert.equal(history.exercises[0].records.length, 3);
 assert.match(history.exercises[0].contexts.join(' '), /Halteres/);
 assert.doesNotMatch(history.exercises[0].contexts.join(' '), /undefined|null/);
});

