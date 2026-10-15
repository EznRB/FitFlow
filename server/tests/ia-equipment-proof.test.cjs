const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgramSchema, validateProgram } = require('../src/services/ia-routine');
const { createIaChatService } = require('../src/services/ia-chat.service');
const first = 'Contexto fictício de teste: adulto saudável, iniciante, objetivo hipertrofia. Minha única disponibilidade é terça, 35 minutos. Equipamentos: apenas halteres, espaço no chão; sem banco ou barra. Organize um rascunho de treino revisável com instrutor.';
const confirmation = 'Confirmo explicitamente: neste cenário fictício sou adulto saudável, sem limitação clínica relevante. Sou iniciante, busco hipertrofia e posso treinar só terça-feira por 35 minutos, apenas com halteres e chão. Sem banco ou barra.';
const history = [{ role: 'user', content: first }, { role: 'assistant', content: 'Confirme explicitamente o cenário de adulto saudável.' }, { role: 'user', content: confirmation }];
const routineSentence = confirmation.match(/Sou iniciante[^.]+\./)[0];
const scopeSentence = confirmation.split('. ')[0] + '.';
function draft(equipmentQuote = confirmation) {
  return { context: { availableDays: ['tuesday'], minutesPerSession: 35, equipment: ['dumbbells', 'bodyweight'], experience: 'beginner', goal: 'hypertrophy', adultHealthyConfirmed: true,
    availabilityQuote: routineSentence, durationQuote: routineSentence, equipmentQuote, experienceQuote: routineSentence, goalQuote: routineSentence, healthyAdultQuote: scopeSentence },
    sessions: [{ day: 'tuesday', exercises: [{ name: 'Supino com halteres no chão', primaryGroup: 'chest', equipment: ['dumbbells'], sets: 2, repsMin: 8, repsMax: 12, rir: 2, restSeconds: 90 }] }] };
}
const upstream = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));

test('equipamento afirmado e negação complementar em frases diferentes oferecem prova integral original, não recortes inutilizáveis', () => {
  const original = JSON.stringify(history), properties = createProgramSchema(history).properties.context.properties;
  assert.ok(properties.equipmentQuote.enum.includes(confirmation));
  assert.ok(!properties.equipmentQuote.enum.includes(routineSentence));
  assert.ok(!properties.equipmentQuote.enum.includes('apenas com halteres e chão.'));
  assert.ok(!properties.equipmentQuote.enum.includes('Sem banco ou barra.'));
  assert.ok(properties.equipmentQuote.enum.every(quote => quote.length <= 300 && history.some(turn => turn.role === 'user' && turn.content.includes(quote))));
  assert.equal(properties.equipmentQuote.maxLength, 300);
  const plan = validateProgram(draft(properties.equipmentQuote.enum[0]), history);
  assert.deepEqual(plan.context.equipment, ['dumbbells', 'bodyweight']);
  assert.equal(JSON.stringify(history), original);
});

test('conversa real completa gera rascunho com duas chamadas controladas, sem nova confirmação falsa', async () => {
  let calls = 0;
  const service = createIaChatService({ provider: 'groq', groqApiKey: 'fixture-only', freeTierConfirmed: true, fetchImpl: async (_, options) => {
    if (++calls === 1) return upstream({ kind: 'routine_draft', message: 'Vou organizar um rascunho revisável para sua rotina.', sourceIds: [] });
    const properties = JSON.parse(options.body).response_format.json_schema.schema.properties.context.properties;
    return upstream(draft(properties.equipmentQuote.enum[0]));
  } });
  const result = await service.chat({ consent: true, messages: history });
  assert.equal(result.kind, 'routine_draft'); assert.equal(calls, 2);
  assert.equal(result.program.context.equipmentQuote, confirmation);
  assert.deepEqual(result.program.context.equipment, ['dumbbells', 'bodyweight']);
});

test('correção de equipamento no mesmo turno continua negando item removido, mesmo na prova integral', () => {
  const equipment = 'Tenho halteres. Mas agora só tenho máquinas, sem halteres, banco ou barra.';
  const input = [...history, { role: 'user', content: equipment }];
  const quotes = createProgramSchema(input).properties.context.properties.equipmentQuote.enum;
  assert.ok(quotes.includes(equipment));
  assert.ok(!quotes.includes('Tenho halteres.'));
  assert.throws(() => validateProgram(draft(equipment), input), error => error.statusCode === 502);
  const corrected = draft(equipment); corrected.context.equipment = ['machines', 'bodyweight'];
  corrected.sessions[0].exercises[0] = { ...corrected.sessions[0].exercises[0], name: 'Supino na máquina', equipment: ['machines'] };
  assert.deepEqual(validateProgram(corrected, input).context.equipment, ['machines', 'bodyweight']);
});

test('turno posterior que retira halteres invalida prova anterior e não herda equipamento nominal', () => {
  const removal = 'Agora não tenho halteres nem máquinas, banco ou barra. Só peso corporal.';
  const input = [...history, { role: 'user', content: removal }];
  const quotes = createProgramSchema(input).properties.context.properties.equipmentQuote.enum;
  assert.ok(quotes.every(quote => removal.includes(quote)));
  assert.ok(!quotes.includes(confirmation));
  assert.throws(() => validateProgram(draft(confirmation), input), error => error.routineClarification?.fields.includes('equipment'));
  assert.throws(() => validateProgram(draft(removal), input), error => error.statusCode === 502);
  const bodyweight = draft(removal); bodyweight.context.equipment = ['bodyweight'];
  bodyweight.sessions[0].exercises[0] = { ...bodyweight.sessions[0].exercises[0], name: 'Flexão de braços no chão', equipment: ['bodyweight'] };
  assert.deepEqual(validateProgram(bodyweight, input).context.equipment, ['bodyweight']);
});

test('prova composta não admite concatenação inventada, normalização de acento ou apoio inexistente', () => {
  for (const quote of [routineSentence + ' Banco disponível.', confirmation.replace('chão', 'chao'), confirmation.replace('Sem banco ou barra.', 'Tenho banco ou barra.')]) {
    assert.throws(() => validateProgram(draft(quote), history), error => error.statusCode === 502);
  }
  const bench = draft(); bench.context.equipment.push('bench');
  assert.throws(() => validateProgram(bench, history), error => error.statusCode === 502);
  const missingBench = draft(); missingBench.sessions[0].exercises[0].name = 'Supino com halteres no banco';
  assert.throws(() => validateProgram(missingBench, history), error => error.statusCode === 502);
});

test('turnos com mais de 300 caracteres não ganham prova integral nem truncamento artificial', () => {
  const long = 'Detalhe educativo de contexto. '.repeat(6) + confirmation;
  const input = [{ role: 'user', content: long }], quotes = createProgramSchema(input).properties.context.properties.equipmentQuote.enum;
  assert.ok(!quotes.includes(long));
  assert.ok(quotes.every(quote => quote.length <= 300 && long.includes(quote)));
});
