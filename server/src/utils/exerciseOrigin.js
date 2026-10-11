'use strict';
const AppError = require('./AppError');
const clone = value => JSON.parse(JSON.stringify(value));

// Capture inside the transaction creating the ficha. Previous IDs only
// authorize inheritance within the revision of the same ficha.
async function captureCatalogExercises(tx, exercises, sourceWorkoutId = null) {
  const previousIds = [...new Set(exercises.map(e => e.sourceExerciseId).filter(id => id != null))];
  if (previousIds.length && sourceWorkoutId === null) throw new AppError('A origem anterior só pode ser usada na revisão da própria ficha.', 400);
  const previous = previousIds.length ? await tx.exercise.findMany({ where: { id: { in: previousIds }, workoutId: sourceWorkoutId } }) : [];
  const byPrevious = new Map(previous.map(e => [e.id, e]));
  for (const id of previousIds) if (!byPrevious.has(id)) throw new AppError('O exercício de origem não pertence à ficha revisada.', 400);
  const inherits = exercise => {
    const old = byPrevious.get(exercise.sourceExerciseId);
    return old && old.catalogExerciseId === exercise.catalogExerciseId && old.catalogSnapshot;
  };
  const ids = [...new Set(exercises.filter(e => e.catalogExerciseId != null && !inherits(e)).map(e => e.catalogExerciseId))];
  const catalog = ids.length ? await tx.catalogoExercicio.findMany({ where: { id: { in: ids }, ativo: true } }) : [];
  const byCatalog = new Map(catalog.map(e => [e.id, e]));
  return exercises.map(({ sourceExerciseId, ...exercise }) => {
    if (exercise.catalogExerciseId == null) return { ...exercise, catalogExerciseId: null };
    const inherited = inherits({ ...exercise, sourceExerciseId });
    if (inherited) return { ...exercise, catalogSnapshot: clone(inherited) };
    const item = byCatalog.get(exercise.catalogExerciseId);
    if (!item) throw new AppError('Exercício do catálogo inexistente ou inativo. Selecione outra origem.', 400);
    const metadata = item.sourceMetadata == null ? null : clone(item.sourceMetadata);
    if (metadata) delete metadata.upstream;
    return { ...exercise, catalogSnapshot: { version: 1, catalogExerciseId: item.id, source: item.source, externalId: item.externalId ?? null,
      locale: item.locale, curated: item.curated, originalName: item.nome, originalMuscleGroup: item.grupo_muscular,
      instructions: item.instrucoes ?? null, imageUrl: item.imagem_url ?? null, sourceMetadata: metadata,
      catalogUpdatedAt: item.atualizado_em ? new Date(item.atualizado_em).toISOString() : null, capturedAt: new Date().toISOString() } };
  });
}
module.exports = { captureCatalogExercises };
