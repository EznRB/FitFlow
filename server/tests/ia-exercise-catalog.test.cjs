const test = require('node:test');
const assert = require('node:assert/strict');
const { eligibleVariants, resolveSessions } = require('../src/services/ia-exercise-catalog');
const context = (equipment = ['dumbbells','bench','cables'], equipmentQuote = 'Tenho halteres, banco e polia.') => ({
  availableDays: ['tuesday','thursday'], equipment, equipmentQuote,
});
const choice = (exerciseId, extra={}) => ({ exerciseId, sets:3, repsMin:8, repsMax:12, rir:2, restSeconds:90, ...extra });
const sessions = exercise => [{ day:'tuesday', exercises:[exercise] }];

test('variações dependem dos recursos completos e não inventam apoio por peso corporal ou polia', () => {
  const ids=eligibleVariants(context()).map(v=>v.id);
  assert.ok(ids.includes('db-flat-press')); assert.ok(ids.includes('db-rdl'));
  assert.ok(!ids.includes('bw-push-up')); assert.ok(!ids.includes('machine-chest-press'));
  assert.ok(!eligibleVariants(context(['dumbbells'],'Apenas halteres.')).some(v=>v.id==='db-flat-press'));
  assert.ok(eligibleVariants(context(['bodyweight'],'Somente peso corporal.')).some(v=>v.id==='bw-push-up'));
});

test('máquinas e acessórios específicos exigem declaração positiva, não academia completa genérica', () => {
  for(const text of ['Tenho máquinas.', 'Tenho academia completa.', 'Sem máquina de supino.', 'Não tenho máquina de supino.'])
    assert.ok(!eligibleVariants(context(['machines'],text)).some(v=>v.id==='machine-chest-press'));
  assert.ok(eligibleVariants(context(['machines'],'Tenho máquina de supino.')).some(v=>v.id==='machine-chest-press'));
  assert.ok(!eligibleVariants(context(['dumbbells'],'Tenho máquina de supino.')).some(v=>v.id==='machine-chest-press'));
  for (const text of ['Não sei se tenho máquina de supino.', 'Se tiver máquina de supino.', 'Tenho máquina de supino?',
    'Não tenho banco nem máquina de supino.', 'Tenho máquina de supino, mas não tenho acesso a ela.'])
    assert.ok(!eligibleVariants(context(['machines'],text)).some(v=>v.id==='machine-chest-press'), text);
});

test('IDs resolvem nome e classificação editoriais fixos sem aceitar nome ou grupo do provedor', () => {
  const raw=sessions(choice('db-flat-press')), before=structuredClone(raw);
  assert.deepEqual(resolveSessions(raw,context()),[{ day:'tuesday',exercises:[{
    name:'Supino com halteres no banco',primaryGroup:'chest',equipment:['dumbbells','bench'],
    sets:3,repsMin:8,repsMax:12,rir:2,restSeconds:90,
  }] }]);
  assert.deepEqual(raw,before);
  for(const extra of [{name:'Flexão nórdica assistida na polia'},{primaryGroup:'hamstrings'},{equipment:['cables']}])
    assert.throws(()=>resolveSessions(sessions(choice('db-flat-press',extra)),context()),e=>e.statusCode===502&&e.iaValidationCode==='routine_catalog');
});

test('seleção desconhecida, indisponível, duplicada ou livre é recusada integralmente sem substituição', () => {
  for(const raw of [sessions(choice('inventado')),sessions(choice('machine-chest-press')),
    [{day:'tuesday',exercises:[choice('db-rdl'),choice('db-rdl')]}],
    [...sessions(choice('db-rdl')),...sessions(choice('db-flat-press'))],
    [{day:'monday',exercises:[choice('db-rdl')]}],
    sessions({name:'Supino na polia',primaryGroup:'chest',equipment:['cables'],sets:3,repsMin:8,repsMax:12,rir:2,restSeconds:90})]) {
    const before=structuredClone(raw);
    assert.throws(()=>resolveSessions(raw,context()),e=>e.statusCode===502&&e.iaValidationCode==='routine_catalog');
    assert.deepEqual(raw,before);
  }
});

test('dose mantém limites locais e não coage strings nem preenche campos ausentes', () => {
  for(const extra of [{sets:'3'},{sets:0},{sets:7},{repsMin:0},{repsMax:7},{rir:6},{restSeconds:29},{restSeconds:301},{sets:undefined}])
    assert.throws(()=>resolveSessions(sessions(choice('db-rdl',extra)),context()),e=>e.statusCode===502);
});

test('banco inclinado e polia dependem dos apoios e acessórios específicos', () => {
  const has = (equipment, quote, id) => eligibleVariants(context(equipment, quote)).some(v => v.id === id);
  assert.equal(has(['dumbbells', 'bench'], 'Tenho halteres e banco.', 'db-incline-press'), false);
  assert.equal(has(['dumbbells', 'bench'], 'Tenho halteres e banco ajustável.', 'db-incline-press'), true);
  assert.equal(has(['cables'], 'Tenho polia.', 'cable-single-row'), false);
  assert.equal(has(['cables'], 'Tenho polia e puxador individual.', 'cable-single-row'), true);
  assert.equal(has(['cables'], 'Tenho polia na altura dos olhos.', 'cable-face-pull'), false);
  assert.equal(has(['cables'], 'Tenho polia na altura dos olhos com corda.', 'cable-face-pull'), true);
});

test('consulta e resolução não permitem alterar o catálogo para outra conversa', () => {
  const variants=eligibleVariants(context()); assert.ok(variants.length>0);
  try { variants[0].name='Nome adulterado'; variants[0].equipment.push('machines'); } catch {}
  const output=resolveSessions(sessions(choice('db-flat-press')),context());
  output[0].exercises[0].equipment.push('machines');
  assert.deepEqual(resolveSessions(sessions(choice('db-flat-press')),context())[0].exercises[0].equipment,['dumbbells','bench']);
  assert.ok(eligibleVariants(context()).every(v=>v.name!=='Nome adulterado'&&/^https:\/\//.test(v.sourceUrl)));
});
