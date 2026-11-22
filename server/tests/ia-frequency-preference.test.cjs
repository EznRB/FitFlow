'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgramSchema, createSessionsSchema, validateContext, validateProgram } = require('../src/services/ia-routine');
const { program, exercise, routineUserText } = require('./fixtures/ia-routine.cjs');
const { createIaChatService } = require('../src/services/ia-chat.service');
const { selectedExercise } = require('./fixtures/ia-routine-selection.cjs');
const first = { role: 'user', content: routineUserText };
const quote = 'Quero treinar duas vezes por semana.';
function context(preference = quote, count = 2) {
  return { ...program().context, desiredSessions: count, frequencyQuote: preference };
}
const messages = preference => [first, { role: 'assistant', content: 'Qual frequência você prefere?' }, { role: 'user', content: preference }];
const clarification = callback => assert.throws(callback, error => error.statusCode === 502
  && error.routineClarification?.fields.includes('availability'));

test('preferência explícita semanal acrescenta citação literal ao contrato sem confundir dias disponíveis', () => {
  const schema = createProgramSchema(messages(quote)).properties.context;
  assert.deepEqual(schema.properties.desiredSessions.enum, [2]);
  assert.ok(schema.properties.frequencyQuote.enum.includes(quote));
  assert.ok(schema.required.includes('desiredSessions'));
  assert.ok(schema.required.includes('frequencyQuote'));
  const validated = validateContext(context(), messages(quote));
  assert.equal(validated.desiredSessions, 2);
  const sessions = createSessionsSchema(validated).properties.sessions;
  assert.equal(sessions.minItems, 2);
  assert.equal(sessions.maxItems, 2);
});

test('rascunho com três dias disponíveis respeita duas sessões sem inventar frequência científica', () => {
  const raw = program(); raw.context = context();
  raw.sessions = raw.sessions.slice(0, 2);
  assert.equal(validateProgram(raw, messages(quote)).sessions.length, 2);
  raw.sessions.push({ day: 'friday', exercises: [exercise('Rosca com halteres', 'biceps', 2, ['dumbbells'])] });
  clarification(() => validateProgram(raw, messages(quote)));
  raw.sessions = raw.sessions.slice(0, 1);
  clarification(() => validateProgram(raw, messages(quote)));
});

test('correção posterior substitui preferência original e não aceita citação obsoleta', () => {
  const correction = 'Agora prefiro 1 sessão por semana.';
  const turns = [...messages(quote), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: correction }];
  const schema = createProgramSchema(turns).properties.context;
  assert.deepEqual(schema.properties.desiredSessions.enum, [1]);
  assert.deepEqual(schema.properties.frequencyQuote.enum, [correction]);
  clarification(() => validateContext(context(), turns));
  assert.equal(validateContext(context(correction, 1), turns).desiredSessions, 1);
});

test('perguntas, incerteza, negação e números conflitantes pedem esclarecimento em vez de escolher frequência', () => {
  for (const text of ['Talvez eu treine duas vezes por semana.', 'Devo treinar duas vezes por semana?',
    'Não quero treinar duas vezes por semana.', 'Quero treinar duas ou três vezes por semana.',
    'Quero treinar duas vezes por semana e três sessões por semana.', 'Não sei quantas sessões por semana quero.',
    'Não quero mais duas sessões por semana; ainda não decidi a nova frequência.',
    'Quero treinar no máximo três vezes por semana.', 'Quero treinar pelo menos duas vezes por semana.',
    'Quero duas sessões por semana, ou três.', 'Quero duas sessões por semana no mínimo.']) {
    clarification(() => createProgramSchema(messages(text)));
    clarification(() => validateContext(program().context, messages(text)));
  }
});

test('retirada posterior da frequência não reaproveita preferência antiga', () => {
  for (const correction of ['Não mais duas sessões por semana.', 'Não consigo mais treinar duas vezes por semana.',
    'Agora não sei a frequência.']) {
    const turns = [...messages(quote), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: correction }];
    clarification(() => createProgramSchema(turns));
    clarification(() => validateContext(context(), turns));
  }
});

test('correção semanal sem verbo de intenção substitui a frequência anterior', () => {
  const corrected = 'Na verdade, 2 treinos por semana.';
  const previous = 'Quero 3 treinos por semana.';
  const turns = [...messages(previous), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: corrected }];
  assert.deepEqual(createProgramSchema(turns).properties.context.properties.desiredSessions.enum, [2]);
  clarification(() => validateContext(context(previous, 3), turns));
  assert.equal(validateContext(context(corrected, 2), turns).desiredSessions, 2);
});

for (const correction of ['Agora prefiro três.', 'Nunca mais quero treinar duas vezes por semana.']) {
  test(`correção ou retirada não preserva frequência obsoleta: ${correction}`, () => {
    const correctedTurns = [...messages(quote), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: correction }];
    clarification(() => createProgramSchema(correctedTurns));
    clarification(() => validateContext(context(), correctedTurns));
  });
}

test('correção elíptica no mesmo turno e retirada sem verbo não preservam uma quantidade', () => {
  clarification(() => createProgramSchema(messages(`${quote} Agora prefiro três.`)));
  const turns = [...messages(quote), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: 'Nunca mais duas vezes por semana.' }];
  clarification(() => createProgramSchema(turns));
});

test('correção de duração não é transformada em frequência desejada', () => {
  const turns = [...messages(quote), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: 'Agora prefiro 30 minutos por sessão.' }];
  assert.deepEqual(createProgramSchema(turns).properties.context.properties.desiredSessions.enum, [2]);
});

test('atualização de disponibilidade semanal não substitui duas sessões desejadas por seis dias possíveis', () => {
  for (const available of ['Agora posso treinar seis dias por semana.', 'Na verdade consigo treinar seis dias por semana.',
    'Agora tenho seis dias livres por semana.']) {
    const turns = [...messages(quote), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: available }];
    assert.deepEqual(createProgramSchema(turns).properties.context.properties.desiredSessions.enum, [2]);
  }
});

test('limite de capacidade com só consigo não impõe frequência exata, com ou sem preferência prévia', () => {
  for (const turns of [messages('Só consigo treinar três vezes por semana.'),
    [...messages(quote), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: 'Agora só consigo treinar três vezes por semana.' }]]) {
    clarification(() => createProgramSchema(turns));
    clarification(() => validateContext(context(), turns));
  }
});

for (const invalid of ['Quero treinar 3.5 vezes por semana.', 'Quero treinar 3,5 vezes por semana.', 'Quero -2 sessões por semana.']) {
  test(`quantidade semanal inválida não é convertida em inteiro válido: ${invalid}`, () => {
    for (const turns of [messages(invalid), [...messages(quote), { role: 'assistant', content: 'Entendi.' }, { role: 'user', content: invalid }]]) {
      clarification(() => createProgramSchema(turns));
      clarification(() => validateContext(context(), turns));
    }
  });
}

test('preferência não pode ser omitida ou inventada pelo provedor, nem vir apenas do assistente', () => {
  clarification(() => validateContext(program().context, messages(quote)));
  assert.throws(() => validateContext(context('Prefiro duas sessões por semana.'), messages(quote)), /rascunho|contexto/);
  assert.throws(() => validateContext(context(quote, 3), messages(quote)), /rascunho|contexto/);
  const turns = [first, { role: 'assistant', content: quote }, { role: 'user', content: 'Obrigado.' }];
  assert.throws(() => validateContext(context(), turns), /rascunho|contexto/);
});

test('contrato legado permanece igual quando há apenas disponibilidade e nenhuma preferência de frequência', () => {
  const schema = createProgramSchema([first]).properties.context;
  assert.equal(schema.properties.desiredSessions, undefined);
  assert.equal(schema.properties.frequencyQuote, undefined);
  assert.equal(validateProgram(program(), [first]).sessions.length, 3);
  const raw = program(); raw.sessions = raw.sessions.slice(0, 1);
  assert.equal(validateProgram(raw, [first]).sessions.length, 1);
});

test('dias livres não são preferência, frequência impossível pede confirmação e grafias explícitas são aceitas', () => {
  for (const preference of ['Tenho duas sessões livres por semana.', 'Posso ir seis dias por semana.']) {
    assert.equal(createProgramSchema(messages(preference)).properties.context.properties.desiredSessions, undefined);
  }
  for (const [text, count] of [['Prefiro 2 sessões semanais.', 2],
    ['Quero treinar três dias por semana.', 3], ['Quero 3 treinos por semana.', 3], ['Quero treinar 3x/semana.', 3]]) {
    assert.equal(validateContext(context(text, count), messages(text)).desiredSessions, count);
  }
  const impossible = 'Quero treinar seis vezes por semana.';
  clarification(() => validateContext(context(impossible, 6), messages(impossible)));
});

test('serviço valida preferência de três entre seis dias e recusa seis sessões devolvidas pelo provedor simulado', async () => {
  const available = 'Posso treinar segunda, terça, quarta, quinta, sexta e sábado.';
  const preference = 'Quero 3 treinos por semana.';
  const text = `${routineUserText} ${available} ${preference}`;
  for (const length of [3, 6]) {
    const raw = context(preference, 3);
    raw.availableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    raw.availabilityQuote = available;
    let calls = 0;
    const service = createIaChatService({ provider: 'groq', groqApiKey: 'fixture-only', freeTierConfirmed: true,
      fetchImpl: async (_, options) => {
        const body = JSON.parse(options.body);
        if (++calls === 1) {
          const routine = body.response_format.json_schema.schema.properties.turn.anyOf.find(row => row.properties.kind.enum[0] === 'routine_draft');
          assert.deepEqual(routine.properties.context.properties.desiredSessions.enum, [3]);
        }
        const value = calls === 1 ? { turn: { kind: 'routine_draft', context: raw } }
          : { sessions: raw.availableDays.slice(0, length).map(day => ({ day, exercises: [selectedExercise('db-curl', 2)] })) };
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));
      } });
    const result = await service.chat({ consent: true, messages: [{ role: 'user', content: text }] });
    assert.equal(calls, 2);
    if (length === 3) { assert.equal(result.kind, 'routine_draft'); assert.equal(result.program.sessions.length, 3); }
    else { assert.equal(result.kind, 'clarification'); assert.match(result.message, /quantas sessões/); assert.equal(result.program, undefined); }
  }
});
