const test = require('node:test');
const assert = require('node:assert/strict');
const { references } = require('../../client/js/science');
const { answerSources, renderAnswerSelection } = require('../src/services/ia-answer');
const { validateProgram, renderProgram } = require('../src/services/ia-routine');
const { program, exercise, routineUserText } = require('./fixtures/ia-routine.cjs');

const block = (kind, options = {}) => ({ kind, ...options });
const selection = (...blocks) => ({ blocks, kind: 'answer', program: null });
const render = (...blocks) => renderAnswerSelection(selection(...blocks), []);
test('definição de volume responde com unidades e exemplo aritmético, sem inventar uma rotina', () => {
  const result = render(block('volume_terms'));
  assert.match(result.message, /2 séries de 10 repetições com 20 kg/);
  assert.match(result.message, /400 kg·reps/);
  assert.match(result.message, /grupo principal declarado/);
  assert.match(result.message, /não mede hipertrofia/);
  assert.doesNotMatch(result.message, /Quais dias|Peito:|faltam declarações/);
  assert.deepEqual(result.sources, []);
  assert.throws(() => render(block('volume_terms', { text: 'Uma dose individual inventada.' })), error => error.statusCode === 502);
});
test('sem rascunho, uma seleção de contagens não repete lacunas para todos os músculos', () => {
  const result = render(block('draft_counts', { groups: ['chest', 'back', 'shoulders', 'quads'] }));
  assert.equal((result.message.match(/faltam declarações completas/g) || []).length, 1);
  assert.doesNotMatch(result.message, /Peito:|Costas:|Ombros:|Quadríceps:|não comprovam autoria/);
});
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
  ]) assert.throws(() => renderAnswerSelection(invalid, history()), error => error.statusCode === 502);
});

test('IDs e grupos válidos repetidos deduplicam conteúdo sem relaxar limites brutos ou allowlists', () => {
  const result = renderAnswerSelection(selection(block('evidence', { sourceIds: Array(8).fill('split-2024') }),
    block('draft_counts', { groups: Array(10).fill('chest') })), history());
  assert.equal(result.message.split(references['split-2024'].summary).length, 2);
  assert.equal(result.message.match(/Peito: 6 séries diretas planejadas/g).length, 1);
  assert.deepEqual(result.sources.map(source => source.id), ['split-2024']);
  for (const item of [block('evidence', { sourceIds: Array(9).fill('split-2024') }),
    block('draft_counts', { groups: Array(11).fill('chest') }),
    block('evidence', { sourceIds: ['split-2024', 'private-unknown-source'] })]) {
    assert.throws(() => renderAnswerSelection(selection(item), history()), error => error.statusCode === 502
      && error.iaValidationCode === 'answer_selection' && !error.message.includes('private-unknown-source'));
  }
});

function longHistory() {
  const lines = ['Rascunho interpretado da conversa — revise com seu instrutor.'];
  for (const [day, group] of [['Segunda', 'Peito'], ['Quarta', 'Costas'], ['Sexta', 'Quadríceps']]) {
    lines.push(`${day} — logística estimada: 50 min`);
    for (let index = 0; index < 6; index++) lines.push(`• Movimento ${day} ${index} ${'nome'.repeat(15)}: 3 séries × 8–12 repetições; RIR 2; descanso inicial 120 s; grupo principal: ${group}.`);
  }
  for (const group of ['Peito', 'Costas', 'Quadríceps']) lines.push(`• ${group}: 18 séries diretas em 1 sessão por semana.`);
  const rendered = lines.join('\n');
  assert.ok(rendered.length <= 6000, 'histórico cabe no limite real das mensagens assistant');
  return [{ role: 'assistant', content: rendered }];
}

test('conjunto legítimo longo preserva unidades inteiras, ressalva de contagens e referências somente exibidas', () => {
  const messages = longHistory();
  const countBlock = block('draft_counts', { groups: ['chest', 'back', 'quads'] });
  const sourceBlock = block('evidence', { sourceIds: answerSources.map(source => source.id) });
  const items = [countBlock, block('tracking'), block('progression'), block('limits'),
    ...['routine', 'equipment', 'logging', 'priority', 'recovery', 'sources'].map(followUp => block('question', { followUp })), sourceBlock];
  const result = renderAnswerSelection(selection(...items), messages);
  assert.ok(result.message.length <= 6000);
  assert.match(result.message, /Ficaram para uma próxima pergunta:/);
  assert.ok(result.sources.length < answerSources.length, 'fontes que não cabem ficam explicitamente para outra pergunta');
  for (const { id, summary } of answerSources) {
    const shown = result.sources.some(source => source.id === id);
    assert.equal(result.message.includes(summary), shown, `resumo ${id} inteiro ou ausente`);
    if (!shown) assert.ok(result.message.split('Ficaram para uma próxima pergunta:')[1].includes(references[id].title));
  }
  const countsOnly = renderAnswerSelection(selection(countBlock), messages).message.split('\n\n');
  for (const completeGroup of countsOnly.slice(0, -1)) assert.ok(result.message.includes(completeGroup));
  assert.equal(result.message.match(/não comprovam autoria/g).length, 1);
  assert.match(result.message, /classificação anatômica correta ou execução; a razão individual da dose não foi documentada/);
  assert.match(result.message, /Séries planejadas não comprovam séries realizadas/);
  assert.ok(result.message.indexOf('Peito:') < result.message.indexOf('Séries previstas'));

  // Alterar a prioridade não corta um resumo para dar espaço à contagem.
  const sourceFirst = renderAnswerSelection(selection(sourceBlock, ...items.slice(0, -1)), messages);
  for (const source of sourceFirst.sources) assert.ok(sourceFirst.message.includes(references[source.id].summary));
  assert.equal(sourceFirst.sources.length, answerSources.length);
  assert.ok(sourceFirst.message.length <= 6000);
  assert.match(sourceFirst.message, /não comprovam autoria/);
});

test('resposta legítima entre cinco e seis mil caracteres cabe inteira no limite da interface', () => {
  const result = renderAnswerSelection(selection(block('draft_counts', { groups: ['chest', 'back', 'quads'] }),
    block('evidence', { sourceIds: answerSources.map(source => source.id) }), block('tracking'), block('progression')), longHistory());
  assert.ok(result.message.length > 5000 && result.message.length <= 6000);
  assert.doesNotMatch(result.message, /Ficaram para uma próxima pergunta:/);
  assert.equal(result.sources.length, answerSources.length);
  for (const source of answerSources) assert.ok(result.message.includes(source.summary));
});

test('diagnóstico local usa código fixo e não copia campos desconhecidos da seleção', () => {
  for (const [candidate, code] of [[{ private: 'conteúdo-privado' }, 'answer_shape'],
    [selection(block('tracking', { private: 'conteúdo-privado' })), 'answer_selection']]) {
    assert.throws(() => renderAnswerSelection(candidate, []), error => error.statusCode === 502
      && error.iaValidationCode === code && !error.message.includes('conteúdo-privado'));
  }
});

test('um resumo isolado excessivo permanece recusado, sem corte ou sucesso vazio', () => {
  const source = references['split-2024'], original = source.summary;
  try {
    source.summary = 'Resumo integral excessivo. '.repeat(300);
    assert.throws(() => render(block('evidence', { sourceIds: ['split-2024'] })), error => error.statusCode === 502
      && error.iaValidationCode === 'answer_size' && !error.message.includes('Resumo integral excessivo'));
  } finally { source.summary = original; }
});

test('limites agregados rejeitam seleção excessiva e texto de histórico longo sem truncar parcialmente', () => {
  assert.throws(() => render(...Array.from({ length: 13 }, () => block('tracking'))), error => error.statusCode === 502);
  const lines = ['Rascunho interpretado da conversa — revise com seu instrutor.', 'Segunda — logística estimada: 50 min'];
  for (let index = 0; index < 30; index++) lines.push(`• Exercício ${index} ${'x'.repeat(80)}: 3 séries × 8–12 repetições; RIR 2; descanso inicial 120 s; grupo principal: Peito.`);
  lines.push('• Peito: 90 séries diretas em 1 sessão por semana.');
  const messages = [{ role: 'assistant', content: lines.join('\n') }];
  assert.throws(() => renderAnswerSelection(selection(block('draft_counts', { groups: ['chest'] }),
    block('evidence', { sourceIds: answerSources.map(row => row.id) }), block('tracking'), block('progression'), block('limits')), messages),
  error => error.statusCode === 502 && error.iaValidationCode === 'answer_size');
});
