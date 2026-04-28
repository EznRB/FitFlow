/**
 * Dicionário de tradução para exercícios de musculação (EN -> PT-BR)
 * Focado nos exercícios mais comuns da Wger API e terminologia fitness.
 */
const EXERCISE_TRANSLATIONS = {
  // Frases Completas (Prioridade Máxima)
  "Bench Press": "Supino Reto",
  "Incline Bench Press": "Supino Inclinado",
  "Decline Bench Press": "Supino Declinado",
  "Dumbbell Flys": "Crucifixo com Halteres",
  "Chest Press": "Supino na Máquina",
  "Pushups": "Flexão de Braços",
  "Cable Cross Over": "Cross Over",
  "Dumbbell Press": "Supino com Halteres",
  "Lat Pulldown": "Puxada Pulley",
  "Bent Over Row": "Remada Curvada",
  "Deadlift": "Levantamento Terra",
  "Pull-ups": "Barra Fixa",
  "Chin-ups": "Barra Fixa (Supinada)",
  "Seated Row": "Remada Sentada",
  "One Arm Dumbbell Row": "Remada Unilateral (Serrote)",
  "T-Bar Row": "Remada Cavalo",
  "Hyperextensions": "Extensão Lombar",
  "Shoulder Press": "Desenvolvimento de Ombros",
  "Military Press": "Desenvolvimento Militar",
  "Lateral Raise": "Elevação Lateral",
  "Front Raise": "Elevação Frontal",
  "Arnold Press": "Desenvolvimento Arnold",
  "Shrugs": "Encolhimento de Ombros",
  "Reverse Flys": "Crucifixo Invertido",
  "Squat": "Agachamento",
  "Leg Press": "Leg Press",
  "Leg Extension": "Cadeira Extensora",
  "Leg Curl": "Mesa Flexora",
  "Lunge": "Avanço",
  "Calf Raise": "Elevação de Panturrilha",
  "Stiff Leg Deadlift": "Levantamento Stiff",
  "Hack Squat": "Agachamento Hack",
  "Glute Bridge": "Elevação Pélvica",
  "Biceps Curl": "Rosca Direta",
  "Hammer Curl": "Rosca Martelo",
  "Preacher Curl": "Rosca Scott",
  "Triceps Extension": "Extensão de Tríceps",
  "Triceps Pushdown": "Tríceps Pulley",
  "Dips": "Paralelas",
  "Skullcrushers": "Tríceps Testa",
  "Concentration Curl": "Rosca Concentrada",
  "Crunches": "Abdominal Supra",
  "Leg Raise": "Elevação de Pernas",
  "Plank": "Prancha",
  "Russian Twist": "Rotação Russa",
  "Mountain Climbers": "Mountain Climbers",
  "Sit-ups": "Abdominal",
  "Woodchoppers": "Lenhador (Woodchopper)",
  "Ab Rollout": "Extensão Abdominal",
  "Deadbug": "Deadbug",
  "Hollow Hold": "Canoa Isométrica",
  "Step-ups": "Step-up",

  // Termos Individuais (Substituição por partes)
  "Dumbbell": "Haltere",
  "Barbell": "Barra",
  "Cable": "Cabo",
  "Machine": "Máquina",
  "Seated": "Sentado",
  "Standing": "Em pé",
  "Incline": "Inclinado",
  "Decline": "Declinado",
  "One Arm": "Unilateral",
  "Single Arm": "Unilateral",
  "Reverse": "Invertido",
  "Biceps": "Bíceps",
  "Triceps": "Tríceps",
  "Tricep": "Tríceps",
  "Chest": "Peito",
  "Back": "Costas",
  "Shoulder": "Ombro",
  "Leg": "Perna",
  "Abs": "Abdominal",
  "Ab": "Abdominal",
  "Box": "Caixa",
  "Hold": "Isometria",
  "Hollow": "Canoa",
  "TRX": "TRX",
  "With": "com",
  "And": "e",
  "Pushdown": "Extensão",
  "On": "no/na",
  "Lying": "Deitado",
  "Row": "Remada",
  "Bench": "Banco",
  "Fly": "Crucifixo",
  "Weighted": "com Peso",
  "Lateral": "Lateral"
};

/**
 * Traduz o nome de um exercício usando o dicionário ou padrões conhecidos.
 */
function traduzirNome(nomeEn) {
  if (!nomeEn) return "";
  
  let nomePt = nomeEn;

  // Ordenar as chaves por comprimento descendente para substituir frases longas antes de palavras curtas
  const keys = Object.keys(EXERCISE_TRANSLATIONS).sort((a, b) => b.length - a.length);

  keys.forEach(original => {
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    nomePt = nomePt.replace(regex, EXERCISE_TRANSLATIONS[original]);
  });

  // Limpezas finais
  nomePt = nomePt.trim().replace(/\s+/g, ' ');
  return nomePt.charAt(0).toUpperCase() + nomePt.slice(1);
}

module.exports = {
  EXERCISE_TRANSLATIONS,
  traduzirNome
};
