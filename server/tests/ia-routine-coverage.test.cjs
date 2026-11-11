const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProgram, renderProgram, extractDraftContext } = require('../src/services/ia-routine');
const { program, exercise, routineUserText } = require('./fixtures/ia-routine.cjs');
const messages = [{ role: 'user', content: routineUserText }];
const coverageWarning = 'Isso não comprova ausência de participação, equilíbrio, cobertura anatômica completa ou dose adequada. Revise a classificação e as escolhas com seu instrutor.';

function twoDays() {
  const raw = program();
  raw.sessions = [
    { day: 'monday', exercises: [exercise('Supino na máquina', 'chest', 3), exercise('Remada na máquina', 'back', 3), exercise('Elevação lateral na máquina', 'shoulders', 3)] },
    { day: 'wednesday', exercises: [exercise('Agachamento com halteres', 'quads', 3, ['dumbbells']), exercise('Rosca com halteres', 'biceps', 3, ['dumbbells']), exercise('Tríceps na polia', 'triceps', 3, ['cables'])] },
  ];
  return raw;
}

test('proposta estreita de dois dias expõe categorias principais omitidas sem inferir anatomia pelo nome', () => {
  const plan = validateProgram(twoDays(), messages);
  assert.deepEqual(plan.coverageReview, {
    unrepresentedPrimaryGroups: ['hamstrings', 'glutes', 'calves', 'core'],
    sessions: [{ day: 'monday', primaryGroups: ['chest', 'back', 'shoulders'] },
      { day: 'wednesday', primaryGroups: ['quads', 'biceps', 'triceps'] }],
  });
  const rendered = renderProgram(plan);
  const paragraph = `Classificação principal a revisar: Posteriores da coxa, Glúteos, Panturrilhas, Abdômen. ${coverageWarning}`;
  assert.ok(rendered.includes(paragraph));
  assert.ok(rendered.indexOf(paragraph) > rendered.indexOf('A razão individual de cada dose'));
  assert.ok(rendered.indexOf(paragraph) < rendered.indexOf('Como ler:'));
});

test('repetir categoria principal na sessão não remove lacunas nem duplica a lista declarada', () => {
  const raw = twoDays();
  raw.sessions[0].exercises.push(exercise('Crucifixo na máquina', 'chest', 1));
  const review = validateProgram(raw, messages).coverageReview;
  assert.deepEqual(review?.sessions[0], { day: 'monday', primaryGroups: ['chest', 'back', 'shoulders'] });
  assert.deepEqual(review?.unrepresentedPrimaryGroups, ['hamstrings', 'glutes', 'calves', 'core']);
});

test('uma nova classificação remove somente a própria categoria, sem exigir todos os dez grupos', () => {
  const raw = twoDays();
  raw.sessions[1].exercises.push(exercise('Flexão de joelho na máquina', 'hamstrings', 1));
  assert.deepEqual(validateProgram(raw, messages).coverageReview?.unrepresentedPrimaryGroups, ['glutes', 'calves', 'core']);
});

test('todas as categorias representadas não viram certificação de equilíbrio ou dose adequada', () => {
  const raw = program();
  raw.sessions = [
    { day: 'monday', exercises: ['chest', 'back', 'shoulders', 'quads', 'hamstrings'].map((group, index) => exercise('Movimento educativo A' + index, group, 1)) },
    { day: 'wednesday', exercises: ['glutes', 'calves', 'biceps', 'triceps', 'core'].map((group, index) => exercise('Movimento educativo B' + index, group, 1)) },
  ];
  const plan = validateProgram(raw, messages);
  assert.deepEqual(plan.coverageReview?.unrepresentedPrimaryGroups, []);
  assert.ok(renderProgram(plan).includes(`Classificação principal a revisar: todas as categorias possuem uma entrada principal. ${coverageWarning}`));
});

test('plano focado com uma sessão permanece possível e sua revisão enumera somente declarações', () => {
  const raw = program();
  raw.sessions = [{ day: 'monday', exercises: [exercise('Rosca com halteres', 'biceps', 2, ['dumbbells'])] }];
  const plan = validateProgram(raw, messages);
  assert.equal(plan.sessions.length, 1);
  assert.deepEqual(plan.coverageReview, { unrepresentedPrimaryGroups: ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'calves', 'triceps', 'core'],
    sessions: [{ day: 'monday', primaryGroups: ['biceps'] }] });
});

test('histórico recalcula revisão de declarações completas sem confiar no aviso enviado pelo cliente', () => {
  const text = renderProgram(validateProgram(twoDays(), messages));
  const context = extractDraftContext([{ role: 'assistant', content: text.replace(/Classificação principal a revisar:[^\n]+/, 'Classificação principal a revisar: nenhuma lacuna.') }]);
  assert.deepEqual(context.coverageReview, {
    unrepresentedPrimaryGroups: ['hamstrings', 'glutes', 'calves', 'core'],
    sessions: [{ day: 'monday', primaryGroups: ['chest', 'back', 'shoulders'] }, { day: 'wednesday', primaryGroups: ['quads', 'biceps', 'triceps'] }],
  });
  assert.match(context.provenance, /sem comprovação de autoria, execução ou precisão da classificação/);
});

for (const mode of ['legacy', 'partial', 'malformed']) {
  test(`histórico ${mode} mantém cobertura desconhecida em vez de declarar ausência`, () => {
    const text = renderProgram(validateProgram(twoDays(), messages));
    const incomplete = mode === 'legacy' ? text.replace(/; grupo principal: [^.\n]+/g, '')
      : mode === 'partial' ? text.replace('; grupo principal: Peito', '')
        : text.replace('; grupo principal: Peito', '; grupo principal: Inventado');
    const context = extractDraftContext([{ role: 'assistant', content: incomplete }]);
    assert.equal(context.coverageReview, null);
  });
}

for (const heading of ['Dia inventado — logística estimada: 20 min', 'Segunda — logística estimada: 20 min']) {
  test(`sessão não reconhecida integralmente não ganha cobertura conhecida: ${heading}`, () => {
    const text = renderProgram(validateProgram(twoDays(), messages));
    const incomplete = text.replace(/Quarta — logística estimada: \d+ min/, heading);
    assert.equal(extractDraftContext([{ role: 'assistant', content: incomplete }]).coverageReview, null);
  });
}

test('revisão não relaxa o teto nem corta aviso para encaixar rascunho excessivo', () => {
  const raw = program();
  raw.context.minutesPerSession = 150; raw.context.durationQuote = '150 minutos';
  raw.context.availableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  raw.context.availabilityQuote = 'Segunda a sábado';
  raw.sessions = raw.context.availableDays.map((day, sessionIndex) => ({ day,
    exercises: Array.from({ length: 6 }, (_, index) => exercise('Movimento educativo ' + sessionIndex + index + 'x'.repeat(77), 'chest', 1)),
  }));
  const declared = [{ role: 'user', content: 'Segunda a sábado por 150 minutos. Sou iniciante em academia completa, objetivo hipertrofia, adulto saudável sem limitações.' }];
  const plan = validateProgram(raw, declared);
  assert.throws(() => renderProgram(plan), error => error.statusCode === 502);
});
