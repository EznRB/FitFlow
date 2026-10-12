'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { program, routineUserText } = require('./fixtures/ia-routine.cjs');
const { validateProgram } = require('../src/services/ia-routine');
const { createIaChatService } = require('../src/services/ia-chat.service');
const messages = text => [{ role: 'user', content: text }];
const rejected = (plan, conversation) => assert.throws(() => validateProgram(plan, conversation), error => error.statusCode === 502);
const upstream = result => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] }));
const service = fetchImpl => createIaChatService({ provider: 'groq', groqApiKey: 'synthetic-private-key', freeTierConfirmed: true, fetchImpl });

test('escopo negativo e objetivo contrário não passam como confirmação original', () => {
  const negative = program();
  negative.context.healthyAdultQuote = 'não sou adulto saudável, tenho uma condição clínica e não confirmei o escopo';
  rejected(negative, messages(routineUserText + ' ' + negative.context.healthyAdultQuote));
  const mismatch = program(); mismatch.context.goal = 'strength';
  rejected(mismatch, messages(routineUserText));
});

test('rascunho não ignora correção de disponibilidade, recursos ou escopo posterior', () => {
  for (const correction of ['Correção: não tenho banco nem barra, só halteres; só posso treinar na terça.',
    'Na verdade meu objetivo é força, não hipertrofia.', 'Correção: não sou adulto saudável.']) {
    rejected(program(), [{ role: 'user', content: routineUserText }, { role: 'assistant', content: 'Vamos revisar.' },
      { role: 'user', content: correction }]);
  }
});

test('trecho positivo não esconde negação de escopo no mesmo turno', () => {
  const raw = program(); raw.context.healthyAdultQuote = 'adulto saudável';
  rejected(raw, messages(routineUserText.replace('adulto saudável sem limitações', 'não sou adulto saudável')));
});

test('pergunta ou incerteza sobre adulto saudável não equivale a confirmação positiva', () => {
  for (const statement of ['Não sei se sou adulto saudável.', 'O que significa adulto saudável?',
    'Sou adulto saudável?', 'Talvez eu seja adulto saudável.', 'Acho que sou adulto saudável.']) {
    const raw = program(); raw.context.healthyAdultQuote = statement.startsWith('Adulto') ? 'Adulto saudável' : 'adulto saudável';
    rejected(raw, messages(routineUserText.replace('adulto saudável sem limitações', statement)));
  }
});

test('afirmação natural ou cenário fictício explicitamente declarado adulto saudável são aceitos', () => {
  for (const statement of ['Sou adulto saudável, sem limitações relevantes.',
    'Este é um cenário fictício de adulto saudável sem limitações.', 'Adulto saudável sem limitações.']) {
    const raw = program(); raw.context.healthyAdultQuote = statement.startsWith('Adulto') ? 'Adulto saudável' : 'adulto saudável';
    assert.equal(validateProgram(raw, messages(routineUserText.replace('adulto saudável sem limitações', statement))).context.adultHealthyConfirmed, true);
  }
});

test('negação de outro objetivo termina antes da afirmação positiva após vírgula', () => {
  const raw = program(); raw.context.goalQuote = 'hipertrofia';
  assert.equal(validateProgram(raw, messages(routineUserText.replace('objetivo hipertrofia',
    'Não quero força, meu objetivo é hipertrofia'))).context.goal, 'hypertrophy');
});

test('dia explicitamente negado no mesmo contexto não fica disponível ao rascunho', () => {
  const raw = program(); raw.context.availabilityQuote = 'Não posso treinar segunda, posso quarta e sexta';
  rejected(raw, messages(routineUserText.replace('Segunda, quarta e sexta', raw.context.availabilityQuote)));
});

test('declaração textual de lesão não é escondida por citação positiva curta de escopo', () => {
  for (const statement of ['Sou adulto saudável, mas tenho uma lesão.', 'Sou adulto saudável, estou com uma lesão.']) {
    const raw = program(); raw.context.healthyAdultQuote = 'Sou adulto saudável';
    rejected(raw, messages(routineUserText.replace('adulto saudável sem limitações', statement)));
  }
});

test('correções no mesmo turno não deixam citações antigas esconder a nova disponibilidade', () => {
  rejected(program(), messages(routineUserText + ' Correção: não tenho banco nem barra, só halteres; só posso treinar na terça.'));
});

test('citação curta de equipamento não esconde a negação no turno original', () => {
  const raw = program(); raw.context.equipmentQuote = 'halteres'; raw.context.equipment = ['dumbbells'];
  raw.sessions = [{ day: 'monday', exercises: [{ ...raw.sessions[0].exercises[0], name: 'Supino com halteres no chão', equipment: ['dumbbells'] }] }];
  rejected(raw, messages(routineUserText + ' Correção: não tenho halteres.'));
});

test('contexto reconfirmado depois da mudança pode formar rascunho; pergunta geral não invalida as declarações', () => {
  const raw = program(); raw.context.availableDays = ['tuesday']; raw.context.equipment = ['dumbbells'];
  raw.context.availabilityQuote = 'só posso treinar na terça'; raw.context.equipmentQuote = 'só halteres';
  raw.sessions = [{ day: 'tuesday', exercises: [{ ...raw.sessions[0].exercises[0], name: 'Supino com halteres no chão', equipment: ['dumbbells'] }] }];
  const conversation = [{ role: 'user', content: routineUserText }, { role: 'assistant', content: 'Vamos revisar.' },
    { role: 'user', content: 'Correção: não tenho banco nem barra; só halteres; só posso treinar na terça.' }];
  assert.equal(validateProgram(raw, conversation).sessions[0].day, 'tuesday');
  assert.equal(validateProgram(program(), [{ role: 'user', content: routineUserText }, { role: 'assistant', content: 'Vamos revisar.' },
    { role: 'user', content: 'Qual descanso foi estudado para hipertrofia? Posso perguntar sobre halteres?' }]).sessions.length, 3);
});

test('gerador inconsistente retorna esclarecimento controlado sem liberar o rascunho ou chamada extra', async () => {
  let calls = 0; const raw = program(); raw.context.healthyAdultQuote = 'sim';
  const current = service(async () => { calls++; return upstream(calls === 1
    ? { kind: 'routine_draft', message: 'Vou organizar um rascunho revisável para sua rotina.', sourceIds: [] } : raw); });
  const result = await current.chat({ consent: true, messages: messages(routineUserText + ' sim') });
  assert.equal(result.kind, 'clarification'); assert.match(result.message, /Confirme explicitamente/);
  assert.equal(result.program, undefined); assert.deepEqual(result.sources, []); assert.equal(calls, 2);
});

test('esclarecimento antigo livre não devolve ciência inventada nem fonte decorativa', async () => {
  let calls = 0;
  const current = service(async () => { calls++; return upstream({ kind: 'clarification', sourceIds: ['acsm-2026'],
    message: 'RIR dois garante segurança e dez séries são mínimo obrigatório. Quais dias você tem disponíveis?' }); });
  await assert.rejects(current.chat({ consent: true, messages: messages('RIR dois é seguro?') }), error => error.statusCode === 502);
  assert.equal(calls, 1);
});

test('esclarecimento estruturado faz perguntas úteis sem prosa do provedor ou atribuição científica', async () => {
  let calls = 0;
  const current = service(async () => { calls++; return upstream({ kind: 'clarification', sourceIds: [],
    message: { reason: 'missing_context', fields: ['duration', 'equipment'] } }); });
  const result = await current.chat({ consent: true, messages: messages('Pode montar uma divisão?') });
  assert.equal(result.kind, 'clarification'); assert.equal(result.generatedByAI, true);
  assert.deepEqual(result.sources, []); assert.match(result.message, /tempo|minutos/); assert.match(result.message, /equipamentos/);
  assert.equal(calls, 1);
});

test('esclarecimento ambíguo de escopo não vira diagnóstico nem rotina', async () => {
  let calls = 0;
  const current = service(async () => { calls++; return upstream({ kind: 'clarification', sourceIds: [],
    message: { reason: 'scope_confirmation', fields: ['scope'] } }); });
  const result = await current.chat({ consent: true, messages: messages('Precisa de algum contexto?') });
  assert.match(result.message, /confirme|confirma/i); assert.match(result.message, /adulto saudável/);
  assert.equal(result.program, undefined); assert.equal(calls, 1);
});

test('objeto de esclarecimento não aceita instruções, texto adicional, fontes ou campos fora da seleção', async () => {
  const valid = { kind: 'clarification', sourceIds: [], message: { reason: 'missing_context', fields: ['duration'] } };
  for (const result of [{ ...valid, sourceIds: ['acsm-2026'] },
    { ...valid, message: { ...valid.message, text: 'RIR dois garante segurança.' } },
    { ...valid, message: { reason: 'free_diagnosis', fields: ['scope'] } },
    { ...valid, message: { reason: 'scope_confirmation', fields: ['equipment'] } },
    { ...valid, message: { reason: 'missing_context', fields: ['diagnosis'] } },
    { ...valid, message: { reason: 'missing_context', fields: ['duration', 'duration'] } },
    { ...valid, message: { reason: 'missing_context', fields: [] } },
    { ...valid, message: { reason: 'outside_scope', fields: ['scope'] } }]) {
    let calls = 0;
    await assert.rejects(service(async () => { calls++; return upstream(result); })
      .chat({ consent: true, messages: messages('Pode montar uma rotina?') }), error => error.statusCode === 502);
    assert.equal(calls, 1);
  }
  const result = await service(async () => upstream({ ...valid, message: { reason: 'outside_scope', fields: [] } }))
    .chat({ consent: true, messages: messages('Quero uma rotina clínica individual.') });
  assert.match(result.message, /avaliação profissional/); assert.doesNotMatch(result.message, /você tem|diagnóstico:/i);
  assert.deepEqual(Object.keys(result).sort(), ['generatedByAI', 'kind', 'message', 'sources']);
});
