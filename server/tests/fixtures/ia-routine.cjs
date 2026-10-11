const routineUserText = 'Segunda, quarta e sexta por 50 minutos. Sou iniciante em academia completa, objetivo hipertrofia, adulto saudável sem limitações.';
function exercise(name, primaryGroup, sets, equip = ['machines']) {
  return { name, primaryGroup, equipment: equip, sets, repsMin: 8, repsMax: 12, rir: 2, restSeconds: 120 };
}
function program() {
  return { context: { availableDays: ['monday', 'wednesday', 'friday'], minutesPerSession: 50,
    equipment: ['machines', 'dumbbells', 'barbell', 'cables', 'bench', 'bodyweight'], experience: 'beginner',
    goal: 'hypertrophy', adultHealthyConfirmed: true, availabilityQuote: 'Segunda, quarta e sexta',
    durationQuote: '50 minutos', equipmentQuote: 'academia completa', experienceQuote: 'iniciante',
    goalQuote: 'hipertrofia', healthyAdultQuote: 'adulto saudável sem limitações' }, sessions: [
    { day: 'monday', exercises: [exercise('Supino na máquina', 'chest', 3), exercise('Crucifixo na máquina', 'chest', 2), exercise('Desenvolvimento na máquina', 'shoulders', 2)] },
    { day: 'wednesday', exercises: [exercise('Remada sentada', 'back', 3), exercise('Rosca com halteres', 'biceps', 2, ['dumbbells'])] },
    { day: 'friday', exercises: [exercise('Agachamento com barra', 'quads', 3, ['barbell']), exercise('Flexão de joelho na máquina', 'hamstrings', 2)] },
  ] };
}
module.exports = { program, exercise, routineUserText };
