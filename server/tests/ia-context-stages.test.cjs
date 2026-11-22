const test = require('node:test');
const assert = require('node:assert/strict');
const { createIaChatService } = require('../src/services/ia-chat.service');
const { program, routineUserText } = require('./fixtures/ia-routine.cjs');
const { selection, selectedExercise } = require('./fixtures/ia-routine-selection.cjs');
const { validateContext } = require('../src/services/ia-routine');
const response = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));
const service = fetchImpl => createIaChatService({ provider: 'groq', groqApiKey: 'fixture-only', freeTierConfirmed: true, fetchImpl });
const input = text => ({ consent: true, messages: [{ role: 'user', content: text }] });

test('contexto puro é conferido sem exercícios e sem alterar o objeto original', () => {
  const original = program().context, before = structuredClone(original);
  assert.deepEqual(validateContext(original, input(routineUserText).messages), before);
  assert.deepEqual(original, before);
});

test('primeira etapa seleciona contexto; segunda só recebe sessões com dias e equipamentos verificados', async () => {
  const plan = program(); plan.context.equipment = ['machines'];
  plan.context.equipmentQuote = 'máquina de supino';
  const text = routineUserText.replace('academia completa', 'máquina de supino');
  const sessions = [{ day: 'monday', exercises: [selectedExercise('machine-chest-press', 3)] }];
  let calls = 0;
  const result = await service(async (_, options) => {
    const request = JSON.parse(options.body), schema = request.response_format.json_schema.schema;
    if (++calls === 1) {
      assert.deepEqual(schema.required, ['turn']);
      const variant = schema.properties.turn.anyOf.find(row => row.properties.kind.enum[0] === 'routine_draft');
      assert.ok(variant.properties.context.properties.goalQuote.enum.length);
      return response({ turn: { kind: 'routine_draft', context: plan.context } });
    }
    assert.deepEqual(schema.required, ['sessions']);
    assert.equal(schema.properties.context, undefined);
    const session = schema.properties.sessions.items;
    assert.deepEqual(session.properties.day.enum, plan.context.availableDays);
    const exercise = session.properties.exercises.items.properties;
    assert.ok(exercise.exerciseId.enum.includes('machine-chest-press'));
    assert.ok(!exercise.exerciseId.enum.includes('db-floor-press'));
    for (const field of ['name', 'primaryGroup', 'equipment']) assert.equal(exercise[field], undefined);
    return response({ sessions });
  }).chat(input(text));
  assert.equal(calls, 2); assert.deepEqual(result.program.context.equipment, ['machines']);
  assert.equal(result.program.sessions[0].exercises[0].name, 'Supino na máquina');
});

test('gerador não amplia equipamento do contexto e contexto rejeitado nunca chega à segunda etapa', async () => {
  let calls = 0;
  const context = program().context; context.equipment = ['machines']; context.equipmentQuote = 'máquina de supino';
  const text = routineUserText.replace('academia completa', 'máquina de supino');
  const sessions = [{ day: 'monday', exercises: [selectedExercise('db-floor-press', 3)] }];
  await assert.rejects(service(async () => {
    calls++;
    return response(calls === 1 ? { turn: { kind: 'routine_draft', context } } : { sessions });
  }).chat(input(text)), error => error.statusCode === 502);
  assert.equal(calls, 2); assert.deepEqual(context.equipment, ['machines']);
  calls = 0; context.goalQuote = 'inventado'; const events = [];
  await assert.rejects(createIaChatService({ provider: 'groq', groqApiKey: 'fixture-only', freeTierConfirmed: true,
    onDiagnostic: event => events.push(event), fetchImpl: async () => { calls++; return response({ turn: { kind: 'routine_draft', context } }); } })
    .chat(input(text)), error => error.statusCode === 502);
  assert.equal(calls, 1);
  assert.deepEqual(events, [{ stage: 'primary', status: 200, category: 'validation', code: 'context_evidence' }]);
});

test('segunda etapa não pode ampliar os dias extraídos pelo classificador', async () => {
  let calls = 0;
  const context = program().context; context.availableDays = ['monday'];
  const sessions = [selection().sessions[0]]; sessions[0].day = 'tuesday';
  await assert.rejects(service(async () => {
    calls++; return response(calls === 1 ? { turn: { kind: 'routine_draft', context } } : { sessions });
  }).chat(input(routineUserText)), error => error.statusCode === 502);
  assert.equal(calls, 2); assert.deepEqual(context.availableDays, ['monday']);
});

test('pergunta geral não exige contexto; pedido de rotina incompleto esclarece sem enum vazio', async () => {
  for (const kind of ['answer', 'routine_draft']) {
    let calls = 0;
    const result = await service(async (_, options) => {
      const request = JSON.parse(options.body);
      if (++calls === 1) {
        const variants = request.response_format.json_schema.schema.properties.turn.anyOf;
        assert.deepEqual(variants.find(row => row.properties.kind.enum[0] === 'routine_draft').properties.context, { type: 'null' });
        assert.doesNotMatch(JSON.stringify(variants), /"enum":\[\]/);
        return response({ turn: kind === 'answer' ? { kind, sourceIds: [] } : { kind, context: null } });
      }
      return response({ blocks: [{ kind: 'limits' }], kind: 'answer', program: null });
    }).chat(input(kind === 'answer' ? 'O que é RIR?' : 'Monte um treino.'));
    assert.equal(result.kind, kind === 'answer' ? 'answer' : 'clarification');
    assert.equal(calls, kind === 'answer' ? 2 : 1);
  }
});

test('equipamento genérico sem variação elegível pede detalhe antes de chamar o gerador', async () => {
  const context = program().context;
  context.equipment = ['machines'];
  let calls = 0;
  const result = await service(async () => {
    calls++;
    return response({ turn: { kind: 'routine_draft', context } });
  }).chat(input(routineUserText));
  assert.equal(calls, 1);
  assert.equal(result.kind, 'clarification');
  assert.match(result.message, /equipamentos/i);
  assert.equal(result.program, undefined);
});

test('recorte literal não transforma dúvida de acesso em máquina confirmada', async () => {
  const context = program().context;
  context.equipment = ['machines'];
  context.equipmentQuote = 'máquina de supino';
  const text = 'Segunda, quarta e sexta por 50 minutos. Sou iniciante. Meu objetivo é hipertrofia. '
    + 'Sou adulto saudável sem limitações. Não sei se tenho máquina de supino. Monte um rascunho.';
  let calls = 0;
  const result = await service(async () => {
    calls++;
    return response(calls === 1 ? { turn: { kind: 'routine_draft', context } }
      : { sessions: [{ day: 'monday', exercises: [selectedExercise('machine-chest-press', 3)] }] });
  }).chat(input(text));
  assert.equal(result.kind, 'clarification');
  assert.equal(calls, 1);
});

test('dúvida, compra futura, negação invertida, acessório diferente e menoridade impedem geração', async () => {
  for (const [equipment, declaration, scope] of [
    [['dumbbells'], 'Talvez eu tenha halteres.'],
    [['dumbbells', 'bench'], 'Tenho halteres, mas banco não tenho.'],
    [['machines'], 'Quero comprar uma máquina de supino.'],
    [['cables'], 'Tenho polia na altura dos olhos e uma corda de pular.'],
    [['dumbbells'], 'Tenho halteres.', 'Sou adulto saudável, mas sou menor de 18 anos.'],
    [['dumbbells'], 'Tenho halteres. Mas não sei se estão disponíveis.'],
  ]) {
    let calls = 0;
    const text = 'Posso treinar segunda, quarta e sexta. Tenho 50 minutos por sessão. Sou iniciante. '
      + 'Meu objetivo é hipertrofia. ' + (scope || 'Sou adulto saudável sem limitações.') + ' ' + declaration;
    const result = await service(async (_, options) => {
      calls++;
      const schema = JSON.parse(options.body).response_format.json_schema.schema;
      if (calls === 1) {
        const context = program().context;
        context.equipment = equipment;
        const fields = schema.properties.turn.anyOf.find(row => row.properties.kind.enum[0] === 'routine_draft').properties.context.properties;
        for (const key of ['availabilityQuote', 'durationQuote', 'experienceQuote', 'goalQuote', 'healthyAdultQuote', 'equipmentQuote'])
          context[key] = fields[key].enum[0];
        return response({ turn: { kind: 'routine_draft', context } });
      }
      const ids = schema.properties.sessions.items.properties.exercises.items.properties.exerciseId.enum;
      return response({ sessions: [{ day: 'monday', exercises: [selectedExercise(ids[0], 3)] }] });
    }).chat(input(text));
    assert.equal(result.kind, 'clarification', declaration + ' ' + (scope || ''));
    assert.equal(calls, 1, declaration);
  }
});

test('correção posterior com idade abaixo de 18 invalida confirmação adulta antiga', async () => {
  const context = program().context;
  const history = [{ role: 'user', content: routineUserText }, { role: 'assistant', content: 'Confirme o contexto.' },
    { role: 'user', content: 'Correção: tenho 16 anos. Monte a rotina.' }];
  let calls = 0;
  const result = await service(async (_, options) => {
    calls++;
    const schema = JSON.parse(options.body).response_format.json_schema.schema;
    if (calls === 1) {
      const field = schema.properties.turn.anyOf.find(row => row.properties.kind.enum[0] === 'routine_draft').properties.context;
      return response({ turn: { kind: 'routine_draft', context: field.type === 'null' ? null : context } });
    }
    return response(selection());
  }).chat({ consent: true, messages: history });
  assert.equal(result.kind, 'clarification');
  assert.equal(calls, 1);
});

test('negar banco depois de confirmar halteres não nega os halteres', async () => {
  const context = program().context;
  context.equipment = ['dumbbells'];
  context.equipmentQuote = 'Tenho halteres e não tenho banco.';
  const text = 'Posso treinar segunda, quarta e sexta. Tenho 50 minutos por sessão. Sou iniciante. '
    + 'Meu objetivo é hipertrofia. Sou adulto saudável sem limitações. ' + context.equipmentQuote;
  let calls = 0;
  const result = await service(async (_, options) => {
    if (++calls === 1) {
      const schema = JSON.parse(options.body).response_format.json_schema.schema;
      const fields = schema.properties.turn.anyOf.find(row => row.properties.kind.enum[0] === 'routine_draft').properties.context.properties;
      for (const key of ['availabilityQuote', 'durationQuote', 'experienceQuote', 'goalQuote', 'healthyAdultQuote']) context[key] = fields[key].enum[0];
      return response({ turn: { kind: 'routine_draft', context } });
    }
    return response({ sessions: [{ day: 'monday', exercises: [selectedExercise('db-floor-press', 3)] }] });
  }).chat(input(text));
  assert.equal(result.kind, 'routine_draft');
  assert.equal(calls, 2);
});

test('diagnósticos de envelope, JSON, truncamento e recusa indicam etapa sem copiar conteúdo', async () => {
  for (const stage of ['primary', 'routine', 'grounded']) for (const [code, body] of [
    ['body_json', 'private-body'],
    ['content_json', JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'private-json' } }] })],
    ['envelope', JSON.stringify({ private: 'private-envelope' })],
    ['truncated', JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: 'private-length' } }] })],
    ['refusal', JSON.stringify({ choices: [{ finish_reason: 'stop', message: { refusal: 'private-refusal' } }] })],
  ]) {
    const events = []; let calls = 0;
    const current = createIaChatService({ provider: 'groq', groqApiKey: 'fixture-only', freeTierConfirmed: true,
      onDiagnostic: event => events.push(event), fetchImpl: async () => {
        calls++;
        if (stage !== 'primary' && calls === 1) return response({ turn: stage === 'routine'
          ? { kind: 'routine_draft', context: program().context } : { kind: 'answer', sourceIds: [] } });
        return new Response(body);
      } });
    await assert.rejects(current.chat(input(routineUserText)), error => error.statusCode === 502);
    assert.deepEqual(events, [{ stage, status: 200, category: 'response', code }]);
    assert.equal(calls, stage === 'primary' ? 1 : 2);
    assert.doesNotMatch(JSON.stringify(events), /private|fixture/);
  }
});

test('rascunho extenso é recusado integralmente com diagnóstico de apresentação, sem nova inferência', async () => {
  const plan = program();
  const availability = 'Posso treinar segunda, terça, quarta, quinta, sexta e sábado.';
  plan.context.availableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  plan.context.availabilityQuote = availability;
  plan.sessions = plan.context.availableDays.map(day => ({ day, exercises: ['db-flat-press', 'db-floor-press', 'db-standing-press', 'db-bent-row', 'db-curl', 'db-goblet-squat'].map(id => selectedExercise(id, 1)) }));
  const events = []; let calls = 0;
  const current = createIaChatService({ provider: 'groq', groqApiKey: 'fixture-only', freeTierConfirmed: true,
    onDiagnostic: event => events.push(event), fetchImpl: async () => {
      calls++; return response(calls === 1 ? { turn: { kind: 'routine_draft', context: plan.context } } : { sessions: plan.sessions });
    } });
  await assert.rejects(current.chat(input(routineUserText + ' ' + availability)), error => error.statusCode === 502 && error.iaValidationCode === 'routine_size');
  assert.equal(calls, 2);
  assert.deepEqual(events, [{ stage: 'routine', status: 200, category: 'validation', code: 'routine_size' }]);
});
