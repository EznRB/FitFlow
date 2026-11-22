'use strict';

/**
 * Editorial inventory of named, dynamic exercise variants, reviewed 2026-11-11.
 * Sources describe the movement and its resources; they do not establish an
 * optimal dose, suitability for a person, or a complete training prescription.
 * primaryGroup is a single bookkeeping category, not all muscles recruited.
 * Every equipment item and every additional requirement must be confirmed.
 * Source text/images are not reproduced. Update the version when entries change.
 */
const catalogVersion = '2026-11-11.1';
const nasm = slug => `https://www.nasm.org/resource-center/exercise-library/${slug}`;
const ace = (id, slug) => `https://www.acefitness.org/resources/everyone/exercise-library/${id}/${slug}/`;
const mayo = (slug, id) => `https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/${slug}/${id}`;

const entries = [
  { id: 'db-flat-press', name: 'Supino com halteres no banco', primaryGroup: 'chest',
    equipment: ['dumbbells', 'bench'], sourceUrl: ace(19, 'chest-press') },
  { id: 'db-floor-press', name: 'Supino com halteres no chão', primaryGroup: 'chest',
    equipment: ['dumbbells'], sourceUrl: 'https://www.acefitness.org/resources/pros/expert-articles/8972/be-a-chest-day-champion-an-evidence-based-approach-to-training-the-chest/' },
  // Only the descriptive standing-press procedure is used, not EMG rankings.
  { id: 'db-standing-press', name: 'Desenvolvimento em pé com halteres', primaryGroup: 'shoulders',
    equipment: ['dumbbells'], sourceUrl: 'https://contentcdn.eacefitness.com/certifiednews/images/article/pdfs/ACEShoulderStudy.pdf' },
  { id: 'db-bent-row', name: 'Remada curvada com halteres', primaryGroup: 'back',
    equipment: ['dumbbells'], sourceUrl: mayo('bent-over-row', 'vid-20084680') },
  { id: 'db-curl', name: 'Rosca com halteres', primaryGroup: 'biceps',
    equipment: ['dumbbells'], sourceUrl: mayo('biceps-curl', 'vid-20084675') },
  { id: 'db-goblet-squat', name: 'Agachamento goblet com halter', primaryGroup: 'quads',
    equipment: ['dumbbells'], sourceUrl: nasm('goblet-squat') },
  { id: 'db-rdl', name: 'Terra romeno com halteres', primaryGroup: 'hamstrings',
    equipment: ['dumbbells'], sourceUrl: nasm('dumbbell-romanian-deadlift') },
  { id: 'db-hammer-curl', name: 'Rosca martelo com halteres', primaryGroup: 'biceps',
    equipment: ['dumbbells'], sourceUrl: ace(10, 'hammer-curl') },
  { id: 'db-supported-row', name: 'Remada unilateral com halter apoiada no banco', primaryGroup: 'back',
    equipment: ['dumbbells', 'bench'], sourceUrl: ace(126, 'single-arm-row') },
  { id: 'db-incline-press', name: 'Supino inclinado com halteres', primaryGroup: 'chest',
    equipment: ['dumbbells', 'bench'], requirements: ['adjustableBench'],
    sourceUrl: nasm('two-arm-incline-dumbbell-chest-press') },
  { id: 'bw-push-up', name: 'Flexão de braços', primaryGroup: 'chest',
    equipment: ['bodyweight'], sourceUrl: nasm('push-up') },
  { id: 'bw-squat', name: 'Agachamento com peso corporal', primaryGroup: 'quads',
    equipment: ['bodyweight'], sourceUrl: ace(135, 'bodyweight-squat') },
  { id: 'bw-floor-bridge', name: 'Elevação de quadril no chão', primaryGroup: 'glutes',
    equipment: ['bodyweight'], sourceUrl: nasm('floor-bridge') },
  // Dead bug means alternating limb movement, never an isometric hold in reps.
  { id: 'bw-dead-bug', name: 'Dead bug com alternância de braços e pernas', primaryGroup: 'core',
    equipment: ['bodyweight'], sourceUrl: nasm('dead-bug') },
  { id: 'bw-crunch', name: 'Abdominal com flexão de tronco no chão', primaryGroup: 'core',
    equipment: ['bodyweight'], sourceUrl: ace(52, 'crunch') },
  { id: 'bb-curl', name: 'Rosca em pé com barra', primaryGroup: 'biceps',
    equipment: ['barbell'], sourceUrl: nasm('barbell-bicep-curl') },
  // This source starts with the bar on a rack; do not silently remove it.
  { id: 'bb-rack-row', name: 'Remada curvada com barra retirada do suporte', primaryGroup: 'back',
    equipment: ['barbell'], requirements: ['barbellRack'], sourceUrl: ace(12, 'bent-over-row') },
  { id: 'band-curl', name: 'Rosca com tubo elástico sob o pé', primaryGroup: 'biceps',
    equipment: ['bands'], requirements: ['resistanceTube'], sourceUrl: mayo('biceps-curl', 'vid-20084666') },
  { id: 'band-seated-row', name: 'Remada sentada com tubo elástico ao redor dos pés', primaryGroup: 'back',
    equipment: ['bands'], requirements: ['resistanceTube'], sourceUrl: mayo('seated-row', 'vid-20084669') },
  { id: 'kb-deadlift', name: 'Levantamento terra com kettlebell', primaryGroup: 'hamstrings',
    equipment: ['kettlebell'], sourceUrl: nasm('kettlebell-deadlift') },
  { id: 'kb-goblet-squat', name: 'Agachamento goblet com kettlebell', primaryGroup: 'quads',
    equipment: ['kettlebell'], sourceUrl: nasm('goblet-squat') },
  { id: 'machine-chest-press', name: 'Supino na máquina', primaryGroup: 'chest',
    equipment: ['machines'], requirements: ['chestPressMachine'], sourceUrl: nasm('chest-press-machine') },
  { id: 'machine-seated-leg-curl', name: 'Flexão de joelhos na máquina sentada', primaryGroup: 'hamstrings',
    equipment: ['machines'], requirements: ['seatedLegCurlMachine'], sourceUrl: nasm('seated-leg-curl') },
  { id: 'machine-leg-press', name: 'Leg press na máquina', primaryGroup: 'quads',
    equipment: ['machines'], requirements: ['legPressMachine'], sourceUrl: nasm('leg-press') },
  { id: 'cable-single-row', name: 'Remada unilateral em pé na polia com puxador individual', primaryGroup: 'back',
    equipment: ['cables'], requirements: ['singleCableHandle'], sourceUrl: ace(337, 'single-arm-row') },
  { id: 'cable-face-pull', name: 'Face pull na polia com corda na altura dos olhos', primaryGroup: 'shoulders',
    equipment: ['cables'], requirements: ['ropeHandle', 'eyeHeightCable'], sourceUrl: nasm('face-pull') },
];

const variants = Object.freeze(entries.map(entry => Object.freeze({
  ...entry,
  equipment: Object.freeze(entry.equipment),
  ...(entry.requirements ? { requirements: Object.freeze(entry.requirements) } : {}),
})));

module.exports = Object.freeze({ catalogVersion, variants });
