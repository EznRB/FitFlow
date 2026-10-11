/** Seleção da IA; conteúdo científico literal e aritmética apresentados pelo servidor. */
const AppError = require('../utils/AppError');
const { references } = require('../../../client/js/science');
const { extractDraftContext, groupLabels } = require('./ia-routine');

const nutritionIds = new Set(['mifflin-1990', 'harris-1984', 'protein-2018', 'dri']);
const sourceIds = Object.keys(references).filter(id => !nutritionIds.has(id));
const kinds = ['evidence', 'draft_counts', 'tracking', 'progression', 'limits', 'question'];
const followUps = ['routine', 'equipment', 'logging', 'priority', 'recovery', 'sources'];
const answerSources = sourceIds.map(id => ({ id, title: references[id].title, summary: references[id].summary }));
const blockSchema = (kind, fields = {}) => ({ type: 'object', additionalProperties: false,
  properties: { kind: { type: 'string', enum: [kind] }, ...fields }, required: ['kind', ...Object.keys(fields)] });
const answerSchema = { type: 'object', additionalProperties: false, properties: {
  blocks: { type: 'array', items: { anyOf: [
    blockSchema('evidence', { sourceIds: { type: 'array', items: { type: 'string', enum: sourceIds } } }),
    blockSchema('draft_counts', { groups: { type: 'array', items: { type: 'string', enum: Object.keys(groupLabels) } } }),
    blockSchema('question', { followUp: { type: 'string', enum: followUps } }),
    ...['tracking', 'progression', 'limits'].map(kind => blockSchema(kind)),
  ] } },
  kind: { type: 'string', enum: ['answer'] }, program: { type: 'null' },
}, required: ['blocks', 'kind', 'program'] };

// Definições do produto e critérios práticos conferidos pela curadoria; não atribuir a artigos.
const canonical = {
  tracking: 'Séries previstas pertencem à proposta; séries executadas dependem do que você registrar. Nas sessões, registre cada série realizada com carga externa, repetições e RIR estimado, se informado; mantenha aquecimentos separados. Finalizar uma sessão não preenche séries ausentes. Dados incompletos não são zero. Tonelagem é a soma de carga externa × repetições registradas: não é trabalho mecânico, estímulo muscular ou medida de hipertrofia. Compare registros do mesmo exercício, equipamento, técnica e amplitude.',
  progression: 'Como critério prático, acompanhe carga, repetições, técnica e esforço. Ao cumprir a faixa proposta com execução consistente e esforço compatível, discuta com o instrutor um pequeno ajuste de carga ou repetições, conforme equipamento e recuperação. Não há regra universal de aumento por calendário ou percentual fixo. Cumprir o alvo de uma série não comprova que o volume semanal seja adequado ou ótimo, e não garante hipertrofia.',
  limits: 'As fontes disponíveis oferecem contexto geral para adultos saudáveis; não determinam a dose ótima, segurança individual ou o melhor exercício para cada pessoa. O rascunho usa escolhas práticas revisáveis. Se a pergunta exige informação que o corpus não aborda, essa lacuna precisa permanecer explícita; podemos esclarecer o contexto e discutir quais dados levar ao instrutor. Dor, lesão ou condições clínicas precisam de avaliação específica, sem diagnóstico pelo chat.',
};
const questions = {
  routine: 'Quais dias você quer treinar e quanto tempo tem por sessão? Conte também seu objetivo, experiência e equipamentos, e confirme se o cenário é de adulto saudável sem limitação clínica relevante.',
  equipment: 'Quais equipamentos estão realmente disponíveis e quais você prefere usar?',
  logging: 'Você quer analisar uma proposta ou registros de séries já realizadas? Para registros, quais exercícios, cargas e repetições foram anotados?',
  priority: 'Qual objetivo ou grupo muscular você quer priorizar, e essa preferência já foi discutida com seu instrutor?',
  recovery: 'Você quer discutir o descanso entre séries ou a distribuição dos dias de treino? Qual é o tempo ou calendário atual?',
  sources: 'Qual afirmação ou referência você quer examinar com mais detalhe?',
};
const exact = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key));
const invalid = () => { throw new AppError('A IA não concluiu uma seleção válida para a resposta. Tente reformular a pergunta.', 502); };
const enumArray = (array, allowed, max) => Array.isArray(array) && array.length <= max
  && new Set(array).size === array.length && array.every(item => typeof item === 'string' && allowed.includes(item));

function renderAnswerSelection(selection, messages) {
  if (!exact(selection, ['blocks', 'kind', 'program']) || selection.kind !== 'answer' || selection.program !== null
    || !Array.isArray(selection.blocks) || selection.blocks.length < 1 || selection.blocks.length > 12) invalid();
  for (const block of selection.blocks) {
    const fields = block?.kind === 'evidence' ? ['kind', 'sourceIds'] : block?.kind === 'draft_counts'
      ? ['kind', 'groups'] : block?.kind === 'question' ? ['kind', 'followUp'] : ['kind'];
    if (!exact(block, fields) || !kinds.includes(block.kind)
      || (block.kind === 'evidence' && (!enumArray(block.sourceIds, sourceIds, 8) || !block.sourceIds.length))
      || (block.kind === 'draft_counts' && (!enumArray(block.groups, Object.keys(groupLabels), 10) || !block.groups.length))
      || (block.kind === 'question' && !followUps.includes(block.followUp))) invalid();
  }
  const draft = extractDraftContext(messages), parts = [], seen = new Set(), selectedSources = new Set();
  const append = (key, text) => { if (!seen.has(key)) { seen.add(key); parts.push(text); } };
  for (const block of selection.blocks) {
    if (block.kind === 'evidence') for (const id of block.sourceIds) {
      selectedSources.add(id); append(`evidence:${id}`, `${references[id].title}\n${references[id].summary}`);
    } else if (block.kind === 'draft_counts') {
      for (const group of block.groups) {
      const label = groupLabels[group], contributors = draft?.declaredContributors.find(row => row.group === label);
      if (!contributors?.classificationComplete || !contributors.exercises.length
        || contributors.exercises.some(row => /[<>]|https?:\/\/|www\.|\b(?:draftContext|directPlannedSets|declaredContributors|classificationComplete)\b/i.test(row.name))) {
        append(`counts:${group}`, `${label}: faltam declarações completas do grupo principal por exercício no histórico para conferir a origem da contagem. Não vou inferir músculos pela anatomia ou tratar a proposta como treino realizado.`);
        continue;
      }
      const rows = contributors.exercises;
      const sets = rows.reduce((total, row) => total + row.sets, 0), frequency = new Set(rows.map(row => row.day)).size;
      append(`counts:${group}`, `${label}: ${sets} séries diretas planejadas em ${frequency} ${frequency === 1 ? 'sessão' : 'sessões'} semanalmente no rascunho recebido. Origem declarada: ${rows.map(row => `${row.day} — ${row.name} (${row.sets} séries)`).join('; ')}.`);
      }
      append('counts:notice', 'Essas declarações do histórico não comprovam autoria, classificação anatômica correta ou execução; a razão individual da dose não foi documentada. Séries planejadas não comprovam séries realizadas.');
    } else if (block.kind === 'question') append(`question:${block.followUp}`, questions[block.followUp]);
    else append(block.kind, canonical[block.kind]);
  }
  const message = parts.join('\n\n');
  if (message.length < 10 || message.length > 5000 || selectedSources.size > 8) invalid();
  return { message, kind: 'answer', generatedByAI: true, scientificTextFromCorpus: true,
    sources: [...selectedSources].map(id => ({ id, title: references[id].title, url: references[id].url })) };
}

module.exports = { answerSchema, answerSources, renderAnswerSelection };
