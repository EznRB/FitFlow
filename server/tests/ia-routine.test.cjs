const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProgram, renderProgram, extractDraftContext } = require('../src/services/ia-routine');
const { program, exercise, routineUserText } = require('./fixtures/ia-routine.cjs');
const messages = [{ role: 'user', content: routineUserText }];
const rejected = plan => assert.throws(() => validateProgram(plan, messages), error => error.statusCode === 502);

test('supino com pesos livres exige banco declarado; chão e máquina com apoio próprio não inferem banco', () => {
  for (const [name, equipment] of [['Supino inclinado com halteres', ['dumbbells']],
    ['Supino reto com barra', ['barbell']], ['Supino no Smith', ['machines']]]) {
    const raw = program();
    raw.sessions[0].exercises = [exercise(name, 'chest', 3, equipment)];
    rejected(raw);
    raw.sessions[0].exercises[0].equipment.push('bench');
    assert.equal(validateProgram(raw, messages).weeklySummary[0].directPlannedSets, 3);
    raw.context.equipment = raw.context.equipment.filter(item => item !== 'bench');
    rejected(raw);
  }
  for (const [name, equipment] of [['Supino com halteres no chão', ['dumbbells']],
    ['Bench press com halteres no chão', ['dumbbells']],
    ['Supino inclinado na máquina', ['machines']]]) {
    const raw = program();
    raw.context.equipment = raw.context.equipment.filter(item => item !== 'bench');
    raw.sessions[0].exercises = [exercise(name, 'chest', 3, equipment)];
    assert.equal(validateProgram(raw, messages).weeklySummary[0].directPlannedSets, 3);
  }
});

test('menção genérica à academia não inventa banco fora da lista explícita de equipamentos', () => {
  const raw = program();
  raw.context.equipmentQuote = 'Tenho máquinas, halteres, barra e polias na academia';
  const declared = [{ role: 'user', content: routineUserText + ' ' + raw.context.equipmentQuote }];
  assert.throws(() => validateProgram(raw, declared), error => error.statusCode === 502);
  raw.context.equipment = raw.context.equipment.filter(item => item !== 'bench');
  assert.ok(validateProgram(raw, declared));
  raw.context.equipmentQuote = 'na academia';
  assert.throws(() => validateProgram(raw, [{ role: 'user', content: routineUserText + ' na academia' }]), error => error.statusCode === 502);
});

test('barra guiada exclusiva não confirma recurso de barra livre no contexto', () => {
  const raw = program();
  raw.context.equipmentQuote = 'Somente barra guiada e banco';
  raw.context.equipment = ['barbell', 'machines', 'bench'];
  raw.sessions = [{ day: 'monday', exercises: [exercise('Agachamento com barra', 'quads', 3, ['barbell'])] }];
  const declared = [{ role: 'user', content: routineUserText + ' Somente barra guiada e banco' }];
  assert.throws(() => validateProgram(raw, declared), error => error.statusCode === 502);
  raw.context.equipment = ['machines', 'bench'];
  raw.sessions[0].exercises = [exercise('Agachamento no Smith', 'quads', 3, ['machines'])];
  assert.ok(validateProgram(raw, declared));
});

test('séries diretas e frequência são calculadas do plano e não deduzidas do nome da divisão', () => {
  const plan = validateProgram(program(), messages);
  assert.deepEqual(plan.weeklySummary.find(row => row.group === 'chest'), { group: 'chest', directPlannedSets: 5, sessionsPerWeek: 1 });
  assert.deepEqual(plan.weeklySummary.find(row => row.group === 'shoulders'), { group: 'shoulders', directPlannedSets: 2, sessionsPerWeek: 1 });
  const result = renderProgram(plan);
  assert.match(result, /Participação indireta.*não foi quantificada/);
  assert.match(result, /não treino executado/);
  assert.match(result, /não representam estímulo, tonelagem ou hipertrofia/);
  assert.ok(result.length <= 6000);
  assert.doesNotMatch(result, /\*\*|^\s*#/m);
});

test('frequência conta sessões distintas: exercícios do mesmo grupo na mesma sessão não são novas exposições', () => {
  const raw = program();
  raw.sessions[1].exercises.push(exercise('Supino inclinado na máquina', 'chest', 2));
  const plan = validateProgram(raw, messages);
  assert.deepEqual(plan.weeklySummary.find(row => row.group === 'chest'), { group: 'chest', directPlannedSets: 7, sessionsPerWeek: 2 });
  assert.match(renderProgram(plan), /Peito: 7 séries diretas em 2 sessões/);
});

test('histórico expõe contribuições explícitas sem provar autoria ou inventar classificação ausente', () => {
  const raw = program();
  raw.sessions[0].exercises = [exercise('Desenvolvimento', 'shoulders', 3), exercise('Elevação lateral', 'shoulders', 2)];
  raw.sessions[1].exercises.push(exercise('Face pull', 'shoulders', 2));
  const text = renderProgram(validateProgram(raw, messages));
  const context = extractDraftContext([{ role: 'assistant', content: text }]);
  assert.match(context.provenance, /cliente; sem comprovação de autoria/);
  assert.deepEqual(context.weeklySummary.find(row => row.group === 'Ombros'), { group: 'Ombros', directPlannedSets: 7, sessionsPerWeek: 2 });
  assert.deepEqual(context.declaredContributors.find(row => row.group === 'Ombros'), {
    group: 'Ombros', classificationComplete: true, exercises: [
      { day: 'Segunda', name: 'Desenvolvimento', sets: 3 }, { day: 'Segunda', name: 'Elevação lateral', sets: 2 },
      { day: 'Quarta', name: 'Face pull', sets: 2 },
    ],
  });
  assert.match(context.individualDoseRationale, /Não documentada/);
  const old = text.replace(/; grupo principal: [^.\n]+/g, '');
  const legacy = extractDraftContext([{ role: 'assistant', content: old }]);
  assert.equal(legacy.exercises.every(row => !Object.hasOwn(row, 'primaryGroup')), true);
  assert.deepEqual(legacy.declaredContributors.find(row => row.group === 'Ombros').exercises, []);
  assert.equal(legacy.declaredContributors.find(row => row.group === 'Ombros').classificationComplete, false);
  assert.equal(extractDraftContext([{ role: 'user', content: text }]), null);
  assert.equal(extractDraftContext([{ role: 'assistant', content: 'Ombros sete séries, desenvolvimento cinco.' }]), null);
});

test('contexto precisa de citações literais do usuário e não da resposta do assistente', () => {
  for (const key of ['availabilityQuote', 'durationQuote', 'equipmentQuote', 'experienceQuote', 'goalQuote', 'healthyAdultQuote']) {
    const raw = program(); raw.context[key] = 'Confirmado apenas pelo modelo.';
    assert.throws(() => validateProgram(raw, [...messages, { role: 'assistant', content: 'Confirmado apenas pelo modelo.' }]), error => error.statusCode === 502);
  }
  const raw = program(); raw.context.adultHealthyConfirmed = false; rejected(raw);
  const guess = program(); delete guess.context.healthyAdultQuote; rejected(guess);
});

test('citações com valores explícitos não permitem inventar duração, dias, experiência ou equipamento', () => {
  for (const mutate of [raw => { raw.context.minutesPerSession = 100; },
    raw => { raw.context.availableDays[0] = 'tuesday'; raw.sessions[0].day = 'tuesday'; },
    raw => { raw.context.experience = 'advanced'; }]) {
    const raw = program(); mutate(raw); rejected(raw);
  }
  const raw = program(); raw.context.equipmentQuote = 'somente halteres';
  assert.throws(() => validateProgram(raw, [{ role: 'user', content: routineUserText + ' somente halteres' }]), error => error.statusCode === 502);
});

test('duração reconhece horas e faixas sem tratar noventa segundos de descanso como limite', () => {
  for (const [quote, minutes] of [['1h30', 90], ['1 hora e 30 minutos', 90], ['uma hora', 60], ['45–60 minutos', 50]]) {
    const raw = program(); raw.context.durationQuote = quote; raw.context.minutesPerSession = minutes;
    const contextMessages = [{ role: 'user', content: routineUserText + ' Tenho ' + quote + '.' }];
    assert.equal(validateProgram(raw, contextMessages).context.minutesPerSession, minutes);
  }
});

test('dias repetidos ou fora da disponibilidade e equipamento indisponível não passam', () => {
  for (const mutate of [raw => { raw.sessions[1].day = 'monday'; }, raw => { raw.sessions[1].day = 'saturday'; },
    raw => { raw.sessions = []; }, raw => { raw.context.availableDays.push('monday'); },
    raw => { raw.sessions[0].exercises[0].equipment = ['kettlebell']; },
    raw => { raw.context.equipment = ['unsupported']; }]) {
    const raw = program(); mutate(raw); rejected(raw);
  }
});

test('disponibilidade em seis dias permite preferir três sessões sem preencher todos os dias livres', () => {
  const raw = program(); raw.context.availableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  raw.context.availabilityQuote = 'Segunda a sábado';
  const plan = validateProgram(raw, [{ role: 'user', content: routineUserText + ' Segunda a sábado estou livre, mas prefiro três treinos.' }]);
  assert.equal(plan.context.availableDays.length, 6);
  assert.equal(plan.sessions.length, 3);
  assert.equal(plan.weeklySummary.find(row => row.group === 'chest').sessionsPerWeek, 1);
});

test('nomes com equipamento explícito não contradizem os equipamentos declarados', () => {
  for (const name of ['Tríceps pulley (cabo) extensão', 'Crossover (cable)', 'Supino com halteres', 'Supino com barra']) {
    const raw = program(); raw.sessions[0].exercises[0].name = name;
    rejected(raw);
  }
  const cable = program(); cable.sessions[0].exercises[0].name = 'Tríceps na polia';
  cable.sessions[0].exercises[0].equipment = ['cables'];
  assert.ok(validateProgram(cable, messages));
  const guided = program(); guided.sessions[0].exercises[0].name = 'Supino na barra guiada';
  guided.sessions[0].exercises[0].equipment = ['barbell', 'bench'];
  rejected(guided);
  guided.sessions[0].exercises[0].equipment = ['machines', 'bench'];
  assert.ok(validateProgram(guided, messages));
  const machineBench = program(); machineBench.sessions[0].exercises[0].name = 'Machine bench press';
  assert.ok(validateProgram(machineBench, messages));
});

test('negações e disponibilidade exclusiva explícitas não permitem inventar equipamentos', () => {
  for (const quote of ['Não tenho máquinas; somente halteres', 'Sem acesso a máquinas, tenho halteres',
    'Academia, mas em casa somente halteres', 'Só peso corporal']) {
    const raw = program(); raw.context.equipmentQuote = quote;
    assert.throws(() => validateProgram(raw, [{ role: 'user', content: routineUserText + ' ' + quote }]), error => error.statusCode === 502);
  }
});

test('negação termina antes de mas/porém e não nega o equipamento afirmado depois', () => {
  for (const quote of ['Não tenho máquinas mas tenho halteres', 'Não tenho máquinas porém tenho halteres']) {
    const raw = program(); raw.context.equipmentQuote = quote; raw.context.equipment = ['dumbbells'];
    for (const session of raw.sessions) for (const movement of session.exercises) {
      movement.name = 'Movimento educativo ' + movement.primaryGroup + ' ' + movement.sets;
      movement.equipment = ['dumbbells'];
    }
    assert.ok(validateProgram(raw, [{ role: 'user', content: routineUserText + ' ' + quote }]));
  }
});

test('doses não aceitam coerção, campos arbitrários, nomes injetados ou grupos inventados', () => {
  for (const [field, value] of [['sets', '3'], ['sets', 0], ['sets', 7], ['repsMin', 0], ['repsMax', 31],
    ['repsMax', 3], ['rir', -1], ['rir', 6], ['restSeconds', 10], ['restSeconds', 301],
    ['primaryGroup', 'all-muscles'], ['name', '<script>injetado</script>'], ['name', 'ACSM mínimo de dez séries']]) {
    const raw = program(); raw.sessions[0].exercises[0][field] = value; rejected(raw);
  }
  const extra = program(); extra.sessions[0].exercises[0].weeklySets = 12; rejected(extra);
  const duplicate = program(); duplicate.sessions[0].exercises.push({ ...duplicate.sessions[0].exercises[0] }); rejected(duplicate);
});

test('sustentações por tempo não são representadas falsamente como repetições', () => {
  for (const name of ['Prancha frontal', 'Prancha lateral de antebraço', 'Agachamento isométrico', 'Wall sit']) {
    const raw = program(); raw.sessions[0].exercises[0].name = name;
    raw.sessions[0].exercises[0].equipment = ['bodyweight'];
    rejected(raw);
  }
  const dynamic = program(); dynamic.sessions[0].exercises[0].name = 'Prancha com toque alternado nos ombros';
  dynamic.sessions[0].exercises[0].equipment = ['bodyweight'];
  assert.ok(validateProgram(dynamic, messages));
});

test('logística é uma estimativa explícita e rejeita plano que excede suas próprias hipóteses de tempo', () => {
  const raw = program(); raw.context.minutesPerSession = 15;
  raw.context.durationQuote = '50 minutos';
  rejected(raw);
  const plan = validateProgram(program(), messages);
  assert.ok(plan.sessionEstimates.every(row => row.estimatedMinutes <= plan.context.minutesPerSession));
  assert.match(renderProgram(plan), /45 s por série/);
  assert.match(renderProgram(plan), /não garante duração real/);
});
