const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgramSchema, validateProgram } = require('../src/services/ia-routine');
const { createIaChatService } = require('../src/services/ia-chat.service');
const { program, exercise } = require('./fixtures/ia-routine.cjs');

const initial = 'Sou adulto saudável, sem limitações clínicas relevantes. Sou iniciante e meu objetivo é hipertrofia. Posso treinar segunda, quarta e sexta, por 50 minutos cada sessão. Tenho máquinas, halteres, barra, polias e banco.';
const correction = 'Correção deste cenário fictício: agora só posso treinar terça por 35 minutos. Não tenho banco nem barra; tenho apenas halteres e espaço no chão. Mantenha meu objetivo e minha experiência que informei e revise o rascunho.';
const messages = [{ role: 'user', content: initial }, { role: 'assistant', content: 'Afirmação de assistente: sou avançado e meu objetivo é força.' }, { role: 'user', content: correction }];
const quoteKeys = ['availabilityQuote', 'durationQuote', 'equipmentQuote', 'experienceQuote', 'goalQuote', 'healthyAdultQuote'];
const response = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));

test('schema oferece provas originais por campo, preservando contexto anterior não alterado e a correção', () => {
  assert.equal(typeof createProgramSchema, 'function');
  const before = JSON.stringify(messages);
  const schema = createProgramSchema(messages), properties = schema.properties.context.properties;
  for (const key of quoteKeys) {
    assert.ok(properties[key].enum.length > 0);
    assert.ok(properties[key].enum.length <= 8);
    for (const quote of properties[key].enum) {
      assert.ok(quote.length >= 3 && quote.length <= 300);
      assert.ok(messages.some(message => message.role === 'user' && message.content.includes(quote)));
      assert.ok(!quote.includes('objetivo ... hipertrofia'));
      assert.ok(!quote.includes('Afirmação de assistente'));
    }
  }
  assert.ok(properties.goalQuote.enum.includes('Sou iniciante e meu objetivo é hipertrofia.'));
  assert.ok(properties.healthyAdultQuote.enum.includes('Sou adulto saudável, sem limitações clínicas relevantes.'));
  assert.ok(properties.availabilityQuote.enum.includes('Correção deste cenário fictício: agora só posso treinar terça por 35 minutos.'));
  assert.equal(JSON.stringify(messages), before);
});

test('gerador usa schema estrito com citações selecionáveis, sem paráfrase ou chamada adicional', async () => {
  let calls = 0;
  const service = createIaChatService({ provider: 'groq', groqApiKey: 'fixture-only', freeTierConfirmed: true,
    fetchImpl: async (_, options) => {
      if (++calls === 1) return response({ kind: 'routine_draft', message: 'Vou organizar um rascunho revisável para sua rotina.', sourceIds: [] });
      const request = JSON.parse(options.body);
      assert.equal(request.response_format.type, 'json_schema');
      assert.equal(request.response_format.json_schema.strict, true);
      assert.equal(request.response_format.json_schema.name, 'fitflow_routine');
      const properties = request.response_format.json_schema.schema.properties.context.properties;
      const draft = program();
      Object.assign(draft.context, { availableDays: ['tuesday'], minutesPerSession: 35, equipment: ['dumbbells', 'bodyweight'] });
      const markers = { availabilityQuote: 'agora', durationQuote: '35 minutos', equipmentQuote: 'apenas halteres',
        experienceQuote: 'Sou iniciante', goalQuote: 'hipertrofia', healthyAdultQuote: 'Sou adulto saudável' };
      for (const [key, marker] of Object.entries(markers)) draft.context[key] = properties[key].enum.find(quote => quote.includes(marker));
      draft.sessions = [{ day: 'tuesday', exercises: [exercise('Agachamento com halteres', 'quads', 3, ['dumbbells'])] }];
      return response(draft);
    } });
  const result = await service.chat({ consent: true, messages });
  assert.equal(calls, 2); assert.equal(result.kind, 'routine_draft');
  assert.deepEqual(result.program.context.availableDays, ['tuesday']);
  assert.equal(result.program.context.minutesPerSession, 35);
  assert.equal(result.program.context.goal, 'hypertrophy');
  assert.equal(result.program.context.experience, 'beginner');
});

test('ausência de prova original e texto não segmentável pedem esclarecimento em vez de inventar enum', () => {
  assert.equal(typeof createProgramSchema, 'function');
  for (const input of [[{ role: 'assistant', content: initial }, { role: 'user', content: 'Monte o treino.' }],
    [{ role: 'user', content: 'x'.repeat(320) + ' hipertrofia' }]]) {
    assert.throws(() => createProgramSchema(input), error => error.routineClarification?.reason === 'missing_context');
  }
});

test('schema novo mantém rejeição local da reticência fabricada e de conteúdo inventado por adapter', () => {
  const draft = program(); draft.context.goalQuote = 'objetivo ... hipertrofia';
  assert.throws(() => validateProgram(draft, messages), error => error.statusCode === 502);
});

test('recortes preservam duração decimal, limite por campo e escopo antigo ainda não alterado', () => {
  const history = [{ role: 'user', content: initial }];
  for (let turn = 0; turn < 10; turn++) history.push({ role: 'user', content: `Agora posso treinar terça por ${30 + turn} minutos.` });
  history.push({ role: 'user', content: 'Agora posso treinar terça por 1.5 horas.' });
  const fields = createProgramSchema(history).properties.context.properties;
  assert.equal(fields.durationQuote.enum.length, 8);
  assert.ok(fields.durationQuote.enum.includes('Agora posso treinar terça por 1.5 horas.'));
  assert.ok(!fields.durationQuote.enum.includes('5 horas.'));
  assert.ok(fields.healthyAdultQuote.enum.includes('Sou adulto saudável, sem limitações clínicas relevantes.'));
  assert.ok(fields.healthyAdultQuote.enum.every(quote => initial.includes(quote)));
  assert.deepEqual(fields.goalQuote.enum, ['Sou iniciante e meu objetivo é hipertrofia.']);
});

test('contexto válido em linhas sem ponto continua representável no schema estrito', () => {
  const lines = ['Sou adulto saudável sem limitações', 'Sou iniciante', 'Meu objetivo é hipertrofia',
    'Posso treinar segunda, quarta e sexta', 'Tenho 50 minutos por sessão', 'Tenho academia completa'];
  const input = [{ role: 'user', content: lines.join('\n') }];
  const draft = program(), fields = createProgramSchema(input).properties.context.properties;
  const quotes = { healthyAdultQuote: lines[0], experienceQuote: lines[1], goalQuote: lines[2],
    availabilityQuote: lines[3], durationQuote: lines[4], equipmentQuote: lines[5] };
  for (const [key, quote] of Object.entries(quotes)) {
    assert.ok(fields[key].enum.includes(quote)); draft.context[key] = quote;
  }
  assert.equal(validateProgram(draft, input).context.minutesPerSession, 50);
});

test('cláusulas originais permitem escopo com ponto e vírgula e correção no mesmo turno', () => {
  const input = [{ role: 'user', content: 'Sou adulto saudável sem limitações; sou iniciante; meu objetivo era força, mas agora quero hipertrofia; posso treinar segunda, quarta e sexta; tinha 70 minutos mas agora tenho 50 minutos por sessão; tenho academia completa.' }];
  const draft = program(), fields = createProgramSchema(input).properties.context.properties;
  const quotes = { healthyAdultQuote: 'Sou adulto saudável sem limitações;', experienceQuote: 'sou iniciante;',
    goalQuote: 'mas agora quero hipertrofia;', availabilityQuote: 'posso treinar segunda, quarta e sexta;',
    durationQuote: 'mas agora tenho 50 minutos por sessão;', equipmentQuote: 'tenho academia completa.' };
  for (const [key, quote] of Object.entries(quotes)) {
    assert.ok(fields[key].enum.includes(quote), `${key} precisa oferecer cláusula literal utilizável`); draft.context[key] = quote;
  }
  const validated = validateProgram(draft, input);
  assert.equal(validated.context.goal, 'hypertrophy'); assert.equal(validated.context.minutesPerSession, 50);
});

test('recorte enumerado não confirma quarta/sexta quando a frase original nega esses dias', () => {
  const text = 'Sou adulto saudável sem limitações. Sou iniciante, objetivo hipertrofia. Tenho academia completa. Posso treinar terça por 50 minutos. Não posso treinar segunda, quarta e sexta.';
  const input = [{ role: 'user', content: text }], draft = program();
  Object.assign(draft.context, { availableDays: ['wednesday', 'friday'], availabilityQuote: 'quarta e sexta.' });
  draft.sessions = draft.sessions.filter(session => session.day !== 'monday');
  const fields = createProgramSchema(input).properties.context.properties;
  assert.ok(fields.availabilityQuote.enum.includes(draft.context.availabilityQuote));
  assert.throws(() => validateProgram(draft, input), error => error.routineClarification?.fields.includes('availability'));
});
