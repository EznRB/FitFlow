/** Resolve escolhas do provedor sem aceitar metadados ou substituir exercícios. */
const AppError = require('../utils/AppError');
const { variants } = require('./ia-exercise-variants');

const requirements = {
  adjustableBench: [/banco\s+(?:ajustavel|regulavel|inclinavel|inclinad[oa])|adjustable\s+bench|incline[d]?\s+bench/],
  chestPressMachine: [/maquina\s+(?:de\s+)?supino|supino\s+(?:na\s+)?maquina|chest[- ]press\s+machine/],
  seatedLegCurlMachine: [/cadeira\s+flexora|flexora\s+sentad[oa]|maquina\s+(?:de\s+)?flexao\s+de\s+joelho\s+sentad[oa]|seated\s+leg[- ]curl/],
  legPressMachine: [/\bleg[- ]press\b/],
  barbellRack: [/\brack\s+(?:de\s+|para\s+)?(?:barra|agachamento)|gaiola\s+(?:de\s+)?agachamento|power\s+rack|squat\s+rack/],
  singleCableHandle: [/puxador\s+(?:individual|unilateral)|pegador\s+(?:individual|unilateral)|single[- ](?:cable[- ])?handle/],
  eyeHeightCable: [/polia[^.;!?]{0,35}altura\s+(?:dos?\s+)?olhos|eye[- ](?:height|level)\s+(?:cable|pulley)/],
  ropeHandle: [/corda\s+(?:para|de|da)\s+(?:a\s+)?polia|polia[^.;!?]{0,70}\bcom\s+(?:uma\s+)?corda\s*(?:[.;!?]|$)|rope\s+(?:handle|attachment)/],
  resistanceTube: [/tubo\s+elastic|elastic[oa]\s+tubular|resistance\s+tub/, /alcas?|pegadores?|handles?/],
};
const normalize = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function resourceConfirmed(quote, required) {
  const patterns = requirements[required];
  if (!patterns || typeof quote !== 'string') return false;
  const text = normalize(quote);
  // Uma pergunta, hipótese ou recurso indisponível não comprova acesso. Na
  // dúvida, excluir a variante; não converter ausência de prova em confirmação.
  if (/\b(?:nao\s+(?:tenho acesso|posso|consigo|uso)|indisponivel|quebrad[oa]|em manutencao)\b/.test(text)) return false;
  const clauses = text.match(/[^.;!?\n]+[.;!?]?/g) || [];
  return patterns.every(pattern => {
    const relevant = clauses.filter(clause => pattern.test(clause));
    if (!relevant.length) return false;
    return relevant.every(clause => !/\?|\b(?:talvez|se tiver|se eu tiver|caso tenha|nao sei|nao tenho certeza|acho que|quero comprar|pretendo comprar|vou comprar|quero adquirir|pretendo adquirir|teria|costumava|antigamente)\b/.test(clause)
      && !/\b(?:nao|sem|nem|exceto|menos|falta)\b/.test(clause.slice(0, clause.search(pattern))));
  });
}
function eligibleVariants(context) {
  if (!Array.isArray(context?.equipment)) return [];
  return variants.filter(variant => variant.equipment.every(item => context.equipment.includes(item))
    && (variant.requirements || []).every(required => resourceConfirmed(context.equipmentQuote, required)));
}
function invalid() {
  const error = new AppError('A IA escolheu exercícios ou doses incompatíveis com o catálogo disponível. Esclareça os equipamentos e tente novamente.', 502);
  error.iaValidationCode = 'routine_catalog';
  throw error;
}
function keys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === expected.length && Object.keys(value).every(key => expected.includes(key));
}
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const doseFields = ['sets', 'repsMin', 'repsMax', 'rir', 'restSeconds'];
function resolveSessions(sessions, context) {
  if (!Array.isArray(sessions) || !sessions.length || sessions.length > Math.min(context?.availableDays?.length || 0, 6)) invalid();
  const available = new Map(eligibleVariants(context).map(variant => [variant.id, variant]));
  const seenDays = new Set();
  return sessions.map(session => {
    if (!keys(session, ['day', 'exercises']) || !context.availableDays.includes(session.day) || seenDays.has(session.day)
      || !Array.isArray(session.exercises) || !session.exercises.length || session.exercises.length > 6) invalid();
    seenDays.add(session.day);
    const seenExercises = new Set();
    const exercises = session.exercises.map(selection => {
      if (!keys(selection, ['exerciseId', ...doseFields]) || !available.has(selection.exerciseId) || seenExercises.has(selection.exerciseId)
        || !integer(selection.sets, 1, 6) || !integer(selection.repsMin, 1, 30)
        || !integer(selection.repsMax, selection.repsMin, 30) || !integer(selection.rir, 0, 5)
        || !integer(selection.restSeconds, 30, 300)) invalid();
      seenExercises.add(selection.exerciseId);
      const variant = available.get(selection.exerciseId);
      return { name: variant.name, primaryGroup: variant.primaryGroup, equipment: [...variant.equipment],
        ...Object.fromEntries(doseFields.map(field => [field, selection[field]])) };
    });
    return { day: session.day, exercises };
  });
}
module.exports = { eligibleVariants, resolveSessions };
