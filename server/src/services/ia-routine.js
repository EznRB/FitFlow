/** Valida e apresenta um rascunho de IA; nunca cria ficha ou mede treino executado. */
const AppError = require('../utils/AppError');

const dayLabels = { monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta',
  friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo' };
const groupLabels = { chest: 'Peito', back: 'Costas', shoulders: 'Ombros', quads: 'Quadríceps',
  hamstrings: 'Posteriores da coxa', glutes: 'Glúteos', calves: 'Panturrilhas', biceps: 'Bíceps', triceps: 'Tríceps', core: 'Abdômen' };
const equipmentLabels = { bodyweight: 'peso corporal', dumbbells: 'halteres', barbell: 'barra',
  machines: 'máquinas', cables: 'polias', bands: 'elásticos', kettlebell: 'kettlebell', bench: 'banco' };
const experienceLabels = { beginner: 'iniciante', intermediate: 'intermediário', advanced: 'avançado' };
const goalLabels = { hypertrophy: 'hipertrofia', strength: 'força', general: 'condicionamento geral' };
const days = Object.keys(dayLabels), groups = Object.keys(groupLabels), equipment = Object.keys(equipmentLabels);
const enumSchema = values => ({ type: 'string', enum: values });
const arraySchema = (items, maxItems, uniqueItems = false) => ({ type: 'array', items, minItems: 1, maxItems,
  ...(uniqueItems ? { uniqueItems: true } : {}) });
const quoteSchema = { type: 'string', minLength: 3, maxLength: 300 };
function objectSchema(properties) { return { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) }; }
const contextProperties = {
  availableDays: arraySchema(enumSchema(days), 7, true), minutesPerSession: { type: 'integer', minimum: 15, maximum: 150 },
  equipment: arraySchema(enumSchema(equipment), equipment.length, true), experience: enumSchema(Object.keys(experienceLabels)),
  goal: enumSchema(Object.keys(goalLabels)), adultHealthyConfirmed: { type: 'boolean' },
  availabilityQuote: quoteSchema, durationQuote: quoteSchema, equipmentQuote: quoteSchema,
  experienceQuote: quoteSchema, goalQuote: quoteSchema, healthyAdultQuote: quoteSchema,
};
const exerciseProperties = { name: { type: 'string', minLength: 3, maxLength: 100 }, primaryGroup: enumSchema(groups),
  equipment: arraySchema(enumSchema(equipment), equipment.length, true),
  sets: { type: 'integer', minimum: 1, maximum: 6 }, repsMin: { type: 'integer', minimum: 1, maximum: 30 },
  repsMax: { type: 'integer', minimum: 1, maximum: 30 }, rir: { type: 'integer', minimum: 0, maximum: 5 },
  restSeconds: { type: 'integer', minimum: 30, maximum: 300 } };
const programSchema = objectSchema({ context: objectSchema(contextProperties),
  sessions: arraySchema(objectSchema({ day: enumSchema(days), exercises: arraySchema(objectSchema(exerciseProperties), 6) }), 6) });

function plain(value, min = 3, max = 300) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max
    && !/[<>]|https?:\/\/|www\.|javascript:|data:|\]\s*\(|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/i.test(value);
}
function keys(value, expected) { return value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === expected.length && Object.keys(value).every(key => expected.includes(key)); }
function integer(value, min, max) { return Number.isSafeInteger(value) && value >= min && value <= max; }
function enumArray(value, values, min = 1, max = values.length) {
  return Array.isArray(value) && value.length >= min && value.length <= max
    && new Set(value).size === value.length && value.every(item => values.includes(item));
}
function invalid() { throw new AppError('A IA não gerou um rascunho consistente com a conversa. Tente esclarecer os dias, o tempo e os equipamentos disponíveis.', 502); }

function normalized(value) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
const dayPatterns = { monday: /\b(?:seg(?:unda(?:-feira)?)?|mon(?:day)?)\b/,
  tuesday: /\b(?:ter(?:ca(?:-feira)?)?|tue(?:sday)?)\b/, wednesday: /\b(?:qua(?:rta(?:-feira)?)?|wed(?:nesday)?)\b/,
  thursday: /\b(?:qui(?:nta(?:-feira)?)?|thu(?:rsday)?)\b/, friday: /\b(?:sex(?:ta(?:-feira)?)?|fri(?:day)?)\b/,
  saturday: /\b(?:sab(?:ado)?|sat(?:urday)?)\b/, sunday: /\b(?:dom(?:ingo)?|sun(?:day)?)\b/ };
const equipmentPatterns = { dumbbells: /halter|dumbbell/, barbell: /barra|barbell/, machines: /maquina|machine|smith/,
  cables: /polia|cabo|cable|pulley|crossover|cross-over/, bands: /elastic|band/, kettlebell: /kettlebell/, bench: /banco|bench/ };
function equipmentHints(text) { return Object.entries(equipmentPatterns).filter(([, pattern]) => pattern.test(text)).map(([item]) => item); }
function exerciseEquipmentConsistent(exercise) {
  const name = normalized(exercise.name);
  const hints = equipmentHints(name).filter(item => (item !== 'barbell' || !/barra fixa|barra paralela|barra guiada|smith/.test(name))
    && (item !== 'bench' || !/maquina|machine/.test(name)));
  return hints.every(item => exercise.equipment.includes(item));
}
function repetitionsRepresentable(name) {
  const value = normalized(name);
  if (/isometr|wall[- ]?sit|sustentacao|dead hang/.test(value)) return false;
  // Movimentos dinâmicos em posição de prancha podem ter repetições;
  // uma sustentação estática não pode ser convertida em reps ou RIR de duração.
  return !/prancha|plank/.test(value) || /toque|alternad|dinamic|remada|flexao|shoulder tap/.test(value);
}
function checkExplicitContext(context) {
  const available = normalized(context.availabilityQuote);
  let indicatedDays = days.filter(day => dayPatterns[day].test(available));
  if (/dias uteis|weekdays/.test(available)) indicatedDays = days.slice(0, 5);
  if (/fim de semana|finais de semana|weekends/.test(available)) indicatedDays = days.slice(5);
  if (indicatedDays.length === 2 && /\s(?:a|ate|to|through)\s/.test(available)) {
    const first = days.indexOf(indicatedDays[0]), last = days.indexOf(indicatedDays[1]);
    indicatedDays = days.slice(first, last + 1);
  }
  if (indicatedDays.length && context.availableDays.some(day => !indicatedDays.includes(day))) invalid();

  const duration = normalized(context.durationQuote);
  const minutes = duration.match(/\b(\d{1,3})(?:\s*[-–a]\s*(\d{1,3}))?\s*(?:min(?:uto)?s?|minutes?)\b/);
  const shortHours = duration.match(/\b(\d{1,2})h(\d{1,2})\b/);
  const mixedHours = duration.match(/\b(\d{1,2})\s*(?:h|horas?)\s*(?:e\s*)?(\d{1,2})\s*(?:min(?:uto)?s?)\b/);
  const hours = duration.match(/\b(\d{1,2})(?:[,.](\d))?\s*(?:h|horas?|hours?)\b/);
  const bounds = mixedHours ? Array(2).fill(Number(mixedHours[1]) * 60 + Number(mixedHours[2]))
    : shortHours ? Array(2).fill(Number(shortHours[1]) * 60 + Number(shortHours[2]))
      : minutes ? [Number(minutes[1]), Number(minutes[2] || minutes[1])]
      : hours ? Array(2).fill((Number(hours[1]) + Number(hours[2] || 0) / 10) * 60)
        : /meia hora/.test(duration) ? [30, 30] : /uma hora|one hour/.test(duration) ? [60, 60] : null;
  if (bounds && (context.minutesPerSession < Math.min(...bounds) || context.minutesPerSession > Math.max(...bounds))) invalid();

  const experience = normalized(context.experienceQuote);
  if (/\b(?:iniciante|beginner)\b/.test(experience) && context.experience !== 'beginner') invalid();
  if (/\b(?:intermediario|intermediate)\b/.test(experience) && context.experience !== 'intermediate') invalid();
  if (/\b(?:avancado|advanced)\b/.test(experience) && context.experience !== 'advanced') invalid();

  const equip = normalized(context.equipmentQuote);
  const allowed = new Set(['bodyweight']);
  if (/academia|gym|ginasio/.test(equip)) ['machines', 'dumbbells', 'barbell', 'cables', 'bench'].forEach(item => allowed.add(item));
  equipmentHints(equip).forEach(item => allowed.add(item));
  const denied = new Set();
  const negativeClauses = equip.match(/(?:nao\s+(?:tenho|possuo|ha|disponho(?:\s+de)?)|sem(?:\s+acesso\s+a)?)\s+[^;,.]+/g) || [];
  for (const clause of negativeClauses) {
    const negativePart = clause.split(/\b(?:mas|porem|contudo|but|however)\b/)[0];
    equipmentHints(negativePart).forEach(item => denied.add(item));
  }
  const exclusiveClauses = equip.match(/\b(?:apenas|somente|so)\s+[^;,.]+/g) || [];
  for (const clause of exclusiveClauses) {
    const explicit = equipmentHints(clause);
    if (explicit.length || /peso corporal|bodyweight/.test(clause)) {
      const exclusive = new Set(['bodyweight', ...explicit]);
      for (const item of equipment) if (!exclusive.has(item)) denied.add(item);
    }
  }
  if (context.equipment.some(item => denied.has(item))) invalid();
  if ((allowed.size > 1 || /peso corporal|bodyweight|sem equipamento/.test(equip))
    && context.equipment.some(item => !allowed.has(item))) invalid();
}

function validateProgram(program, messages) {
  if (!keys(program, ['context', 'sessions']) || !keys(program.context, Object.keys(contextProperties))) invalid();
  const context = program.context;
  if (!enumArray(context.availableDays, days, 1, 7) || !integer(context.minutesPerSession, 15, 150)
    || !enumArray(context.equipment, equipment) || !Object.hasOwn(experienceLabels, context.experience)
    || !Object.hasOwn(goalLabels, context.goal) || context.adultHealthyConfirmed !== true) invalid();
  // As citações demonstram que o usuário forneceu contexto, não que o modelo o interpretou corretamente.
  const userTexts = messages.filter(message => message.role === 'user').map(message => message.content);
  for (const name of ['availabilityQuote', 'durationQuote', 'equipmentQuote', 'experienceQuote', 'goalQuote', 'healthyAdultQuote']) {
    if (!plain(context[name]) || !userTexts.some(text => text.includes(context[name]))) invalid();
  }
  checkExplicitContext(context);
  if (!Array.isArray(program.sessions) || program.sessions.length < 1 || program.sessions.length > context.availableDays.length
    || program.sessions.length > 6 || new Set(program.sessions.map(session => session?.day)).size !== program.sessions.length) invalid();
  const weekly = new Map();
  const sessionEstimates = [];
  for (const session of program.sessions) {
    if (!keys(session, ['day', 'exercises']) || !context.availableDays.includes(session.day)
      || !Array.isArray(session.exercises) || session.exercises.length < 1 || session.exercises.length > 6) invalid();
    const seenNames = new Set(), sessionGroups = new Set();
    let seconds = 5 * 60; // Hipótese logística explícita, não estimativa fisiológica validada.
    for (const exercise of session.exercises) {
      if (!keys(exercise, Object.keys(exerciseProperties)) || !plain(exercise.name, 3, 100)
        || !repetitionsRepresentable(exercise.name)
        || /s[ée]ries|seman|\brir\b|acsm|[óo]tim|estudo|revis[aã]o|m[ií]nimo/i.test(exercise.name)
        || !groups.includes(exercise.primaryGroup) || !enumArray(exercise.equipment, equipment)
        || !exerciseEquipmentConsistent(exercise)
        || exercise.equipment.some(item => !context.equipment.includes(item))
        || !integer(exercise.sets, 1, 6) || !integer(exercise.repsMin, 1, 30)
        || !integer(exercise.repsMax, exercise.repsMin, 30) || !integer(exercise.rir, 0, 5)
        || !integer(exercise.restSeconds, 30, 300)) invalid();
      const name = exercise.name.trim().toLocaleLowerCase('pt-BR');
      if (seenNames.has(name)) invalid(); seenNames.add(name);
      const totals = weekly.get(exercise.primaryGroup) || { group: exercise.primaryGroup, directPlannedSets: 0, sessionsPerWeek: 0 };
      totals.directPlannedSets += exercise.sets;
      weekly.set(exercise.primaryGroup, totals); sessionGroups.add(exercise.primaryGroup);
      // 45s por série + descanso apenas entre séries do exercício + 1min de transição.
      seconds += exercise.sets * 45 + (exercise.sets - 1) * exercise.restSeconds + 60;
    }
    for (const group of sessionGroups) weekly.get(group).sessionsPerWeek++;
    const estimatedMinutes = Math.ceil(seconds / 60);
    // Recusa uma proposta que já excede o tempo sob estas próprias hipóteses.
    if (estimatedMinutes > context.minutesPerSession) invalid();
    sessionEstimates.push({ day: session.day, estimatedMinutes });
  }
  return { context, sessions: program.sessions, weeklySummary: [...weekly.values()], sessionEstimates };
}

const guidance = [
  'Como ler: séries e repetições são propostas de trabalho, não aquecimentos. Os valores são hipóteses práticas iniciais para revisar com seu instrutor; os estudos não prescrevem este arranjo exato. RIR é a estimativa de repetições ainda possíveis com a mesma técnica, com margem de erro.',
  'Progressão: registre carga, repetições e esforço. Quando completar a faixa proposta com técnica consistente e esforço compatível, discuta um pequeno ajuste de carga ou repetições, conforme equipamento e recuperação. Não há aumento obrigatório por calendário ou percentual fixo; dez séries não são mínimo universal nem meta automática.',
  'Fundamento: split e full body tiveram resultados semelhantes quando o volume foi igualado. A ACSM apresenta recomendações gerais para adultos saudáveis, sem exigir duas exposições de cada grupo como condição para hipertrofia. Maior volume pode favorecer resultados no agregado, sem determinar uma dose individual ótima.',
  'Esforço e descanso: a relação entre proximidade da falha e hipertrofia é exploratória; falha absoluta não é obrigatória e não há RIR ótimo universal. A revisão de descanso não estabelece noventa segundos como teto: ajuste para manter execução e desempenho.',
].join('\n\n');

function renderProgram(plan) {
  const { context, sessions, weeklySummary, sessionEstimates } = plan;
  const lines = [
    'Rascunho interpretado da conversa — revise com seu instrutor. Nenhuma ficha foi salva ou aplicada.',
    `Interpretação: ${experienceLabels[context.experience]}, objetivo de ${goalLabels[context.goal]}, ${context.minutesPerSession} min disponíveis por sessão. Equipamentos: ${context.equipment.map(item => equipmentLabels[item]).join(', ')}. Se alguma interpretação estiver errada, corrija no chat.`,
  ];
  for (const session of sessions) {
    lines.push(`${dayLabels[session.day]} — logística estimada: ${sessionEstimates.find(item => item.day === session.day).estimatedMinutes} min`);
    lines.push(...session.exercises.map(exercise => `• ${exercise.name.trim()}: ${exercise.sets} séries × ${exercise.repsMin}–${exercise.repsMax} repetições; RIR ${exercise.rir}; descanso inicial ${exercise.restSeconds} s; grupo principal: ${groupLabels[exercise.primaryGroup]}.`));
  }
  lines.push('Contagem direta planejada, por grupo principal indicado no rascunho (não treino executado):');
  lines.push(...weeklySummary.map(row => `• ${groupLabels[row.group]}: ${row.directPlannedSets} séries diretas em ${row.sessionsPerWeek} ${row.sessionsPerWeek === 1 ? 'sessão' : 'sessões'} por semana.`));
  lines.push('Participação indireta em outros músculos não foi quantificada. Essas contagens não representam estímulo, tonelagem ou hipertrofia. A classificação de grupo e o contexto foram interpretados pela IA e precisam de revisão.');
  lines.push('Tempo é uma hipótese logística: 5 min de preparação, 45 s por série, os descansos entre séries e 1 min de transição por exercício. Não inclui filas ou toda a preparação específica; não garante duração real.');
  lines.push('A razão individual de cada dose não foi documentada. Tempo disponível não comprova necessidade dessa dose ou segurança; a distribuição é uma escolha prática inicial revisável.');
  lines.push(guidance);
  const message = lines.join('\n\n');
  if (message.length > 6000) invalid();
  return message;
}

/** Extrai somente campos explícitos do formato do rascunho no histórico recebido.
 * O cliente pode modificar esse texto: isto não prova autoria nem execução. */
function extractDraftContext(messages) {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'assistant' || !message.content.startsWith('Rascunho interpretado da conversa — revise com seu instrutor.')) continue;
    const exercises = [], weeklySummary = [], sessionEstimates = [];
    let day;
    for (const line of message.content.split('\n')) {
      const session = line.match(/^(Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo) — logística estimada: (\d{1,3}) min$/);
      if (session) { day = session[1]; sessionEstimates.push({ day, estimatedMinutes: Number(session[2]) }); continue; }
      const movement = line.match(/^• (.{3,100}): ([1-6]) séries × (\d{1,2})–(\d{1,2}) repetições; RIR ([0-5]); descanso inicial (\d{2,3}) s(?:; grupo principal: (Peito|Costas|Ombros|Quadríceps|Posteriores da coxa|Glúteos|Panturrilhas|Bíceps|Tríceps|Abdômen))?\.$/);
      if (movement && day) {
        const [name, sets, repsMin, repsMax, rir, restSeconds, primaryGroup] = movement.slice(1);
        if (Number(repsMin) < 1 || Number(repsMax) > 30 || Number(repsMax) < Number(repsMin) || Number(restSeconds) < 30 || Number(restSeconds) > 300) continue;
        exercises.push({ day, name, sets: Number(sets), repsMin: Number(repsMin), repsMax: Number(repsMax), rir: Number(rir), restSeconds: Number(restSeconds), ...(primaryGroup ? { primaryGroup } : {}) });
      }
      const summary = line.match(/^• (Peito|Costas|Ombros|Quadríceps|Posteriores da coxa|Glúteos|Panturrilhas|Bíceps|Tríceps|Abdômen): (\d{1,3}) séries diretas em ([1-6]) sess(?:ão|ões) por semana\.$/);
      if (summary) weeklySummary.push({ group: summary[1], directPlannedSets: Number(summary[2]), sessionsPerWeek: Number(summary[3]) });
    }
    if (!exercises.length || !weeklySummary.length) continue;
    return {
      provenance: 'Campos explícitos em texto assistant enviado pelo cliente; sem comprovação de autoria, execução ou precisão da classificação.',
      individualDoseRationale: 'Não documentada; não inferir necessidade, equilíbrio, preencher tempo, segurança ou dose ideal.',
      exercises, weeklySummary, sessionEstimates,
      declaredContributors: weeklySummary.map(row => ({ group: row.group,
        exercises: exercises.filter(exercise => exercise.primaryGroup === row.group).map(({ day, name, sets }) => ({ day, name, sets })),
        classificationComplete: exercises.every(exercise => Boolean(exercise.primaryGroup)),
      })),
    };
  }
  return null;
}

module.exports = { programSchema, validateProgram, renderProgram, extractDraftContext };
