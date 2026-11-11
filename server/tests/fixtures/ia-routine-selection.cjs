// Seleções autoradas para o contrato do gerador: nenhum metadado vem do modelo.
function selectedExercise(exerciseId, sets, restSeconds = 120) {
  return { exerciseId, sets, repsMin: 8, repsMax: 12, rir: 2, restSeconds };
}
function selection() {
  return { sessions: [
    { day: 'monday', exercises: [selectedExercise('db-flat-press', 3), selectedExercise('db-floor-press', 2), selectedExercise('db-standing-press', 2)] },
    { day: 'wednesday', exercises: [selectedExercise('db-bent-row', 3), selectedExercise('db-curl', 2)] },
    { day: 'friday', exercises: [selectedExercise('db-goblet-squat', 3), selectedExercise('db-rdl', 2)] },
  ] };
}
module.exports = { selection, selectedExercise };
