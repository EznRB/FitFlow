const test = require('node:test');
const assert = require('node:assert/strict');
const { references } = require('../../client/js/science');
const { answerSources, renderAnswerSelection } = require('../src/services/ia-answer');
const { validateProgram, renderProgram } = require('../src/services/ia-routine');
const { program, exercise, routineUserText } = require('./fixtures/ia-routine.cjs');

const block = (kind, options = {}) => ({ kind, ...options });
const selection = (...blocks) => ({ blocks, kind: 'answer', program: null });
const render = (...blocks) => renderAnswerSelection(selection(...blocks), []);
function history() {
  const draft = program();
  draft.sessions[0].exercises = [exercise('Supino na máquina', 'chest', 3), exercise('Remada sentada', 'back', 3)];
  draft.sessions[1].exercises = [exercise('Crucifixo na máquina', 'chest', 3), exercise('Puxada na máquina', 'back', 3)];
  draft.sessions[2].exercises = [exercise('Remada na máquina', 'back', 3), exercise('Flexão de joelho na máquina', 'hamstrings', 3)];
  return [{ role: 'user', content: routineUserText },
    { role: 'assistant', content: renderProgram(validateProgram(draft, [{ role: 'user', content: routineUserText }])) },
    { role: 'user', content: 'Explique as seis séries de peito, nove de costas e o que preciso registrar.' }];
}

test('cada fonte selecionada apresenta resumo completo e qualificações, com link canônico e sem duplicação', () => {
  for (const { id } of answerSources) {
    const result = render(block('evidence', { sourceIds: [id] }), block('evidence', { sourceIds: [id] }));
    assert.equal(result.message, `${references[id].title}\n${references[id].summary}`);
    assert.deepEqual(result.sources, [{ id, title: references[id].title, url: references[id].url }]);
    assert.equal(result.scientificTextFromCorpus, true);
    assert.equal(result.generatedByAI, true);
    assert.deepEqual(Object.keys(result).sort(), ['generatedByAI', 'kind', 'message', 'scientificTextFromCorpus', 'sources']);
  }
});

test('contagens e frequência usam contribuições explícitas, não totais antigos contraditórios nem anatomia inferida', () => {
  const messages = history();
  messages[1].content = messages[1].content.replace('Peito: 6 séries diretas em 2 sessões', 'Peito: 99 séries diretas em 6 sessões');
  const result = renderAnswerSelection(selection(block('draft_counts', { groups: ['chest', 'back'] })), messages);
  assert.match(result.message, /Peito: 6 séries diretas planejadas em 2 sessões/);
  assert.match(result.message, /Costas: 9 séries diretas planejadas em 3 sessões/);
  assert.match(result.message, /Segunda — Supino na máquina \(3 séries\); Quarta — Crucifixo na máquina \(3 séries\)/);
  assert.match(result.message, /Sexta — Remada na máquina \(3 séries\)/);
  assert.doesNotMatch(result.message, /99 séries|6 sessões|dose ótima/);
  assert.match(result.message, /não comprovam autoria, classificação anatômica correta ou execução/);
  assert.equal(result.message.match(/não comprovam autoria/g).length, 1);
  assert.match(result.message, /Séries planejadas não comprovam séries realizadas/);
  assert.deepEqual(result.sources, []);
});

test('grupo principal ausente, histórico não reconhecido ou nome injetado produz lacuna, sem inventar registros', () => {
  const missing = history();
  missing[1].content = missing[1].content.replace(/; grupo principal: [^.]+/g, '');
  const injected = history();
  injected[1].content = injected[1].content.replace('Supino na máquina', '<script>execução</script>');
  for (const messages of [[], missing, injected]) {
    const result = renderAnswerSelection(selection(block('draft_counts', { groups: ['chest'] })), messages);
    assert.match(result.message, /faltam declarações completas/);
    assert.doesNotMatch(result.message, /6 séries|<script>|directPlannedSets|classificationComplete/);
    assert.deepEqual(result.sources, []);
  }
});

test('acompanhamento mantém plano distinto de execução, dados ausentes distintos de zero e tonelagem distinta de trabalho', () => {
  const result = render(block('tracking'), block('progression'), block('question', { followUp: 'logging' }));
  assert.match(result.message, /Finalizar uma sessão não preenche séries ausentes/);
  assert.match(result.message, /Dados incompletos não são zero/);
  assert.match(result.message, /carga externa × repetições registradas: não é trabalho mecânico/);
  assert.match(result.message, /critério prático/);
  assert.match(result.message, /Não há regra universal de aumento por calendário ou percentual fixo/);
  assert.match(result.message, /Cumprir o alvo de uma série não comprova que o volume semanal seja adequado ou ótimo/);
  assert.match(result.message, /proposta ou registros de séries já realizadas/);
  assert.deepEqual(result.sources, []);
});

test('declaração de exercício malformada impede contagem parcial apresentada como completa', () => {
  for (const replacement of ['99 séries × 8–12', '3 séries × 0–12', '3 séries × 8–99']) {
    const messages = history();
    messages[1].content = messages[1].content.replace('3 séries × 8–12', replacement);
    const result = renderAnswerSelection(selection(block('draft_counts', { groups: ['chest', 'back'] })), messages);
    assert.match(result.message, /faltam declarações completas/);
    assert.doesNotMatch(result.message, /séries diretas planejadas em/);
  }
});

test('perguntas e limitações são selecionadas, sem transformar texto livre em diagnóstico ou atribuição científica', () => {
  for (const followUp of ['routine', 'equipment', 'logging', 'priority', 'recovery', 'sources']) {
    const result = render(block('limits'), block('question', { followUp }));
    assert.ok(result.message.includes('?')); assert.deepEqual(result.sources, []);
    assert.match(result.message, /sem diagnóstico pelo chat/);
  }
  for (const invalid of [
    selection(block('evidence', { sourceIds: ['inventada'] })),
    selection(block('evidence', { sourceIds: ['mifflin-1990'] })),
    selection(block('evidence', { sourceIds: ['split-2024'], text: 'RIR um é suficiente e seguro.' })),
    selection(block('evidence', { sourceIds: ['split-2024'], sourceQuote: 'invenção' })),
    selection(block('tracking', { sourceIds: ['acsm-2026'] })),
    selection(block('evidence', { sourceIds: ['split-2024'], groups: ['chest'] })),
    selection(block('draft_counts', { groups: ['chest'], followUp: 'routine' })),
    selection(block('limits', { groups: ['chest'] })),
    selection(block('question')), selection(block('question', { followUp: 'diagnosis' })),
    selection(block('limits', { followUp: 'equipment' })),
    selection(block('tracking', { followUp: 'logging' })),
    selection(block('tracking', { sourceIds: [], groups: [], followUp: 'none' })),
    selection(block('question', { followUp: 'none' })),
    selection(block('evidence')), selection(block('draft_counts')),
    { ...selection(block('tracking')), message: 'Mensagem científica inventada.' },
    selection(block('evidence', { sourceIds: ['split-2024', 'split-2024'] })),
  ]) assert.throws(() => renderAnswerSelection(invalid, history()), error => error.statusCode === 502);
});

test('limites agregados rejeitam seleção excessiva e texto de histórico longo sem truncar parcialmente', () => {
  assert.throws(() => render(...Array.from({ length: 13 }, () => block('tracking'))), error => error.statusCode === 502);
  const lines = ['Rascunho interpretado da conversa — revise com seu instrutor.', 'Segunda — logística estimada: 50 min'];
  for (let index = 0; index < 30; index++) lines.push(`• Exercício ${index} ${'x'.repeat(80)}: 3 séries × 8–12 repetições; RIR 2; descanso inicial 120 s; grupo principal: Peito.`);
  lines.push('• Peito: 90 séries diretas em 1 sessão por semana.');
  const messages = [{ role: 'assistant', content: lines.join('\n') }];
  assert.throws(() => renderAnswerSelection(selection(block('draft_counts', { groups: ['chest'] }),
    block('evidence', { sourceIds: answerSources.map(row => row.id) }), block('tracking'), block('progression'), block('limits')), messages),
  error => error.statusCode === 502);
});
