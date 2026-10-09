'use strict';
const { isDeepStrictEqual } = require('node:util');
const AppError = require('../utils/AppError');
const businessRules = require('../utils/businessRules');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AppError('Use um identificador UUID válido.', 400);
  return value.toLowerCase();
}
function numeric(value, label, min, max, integer = false) {
  if (!['number', 'string'].includes(typeof value) || !String(value).trim() || !/^\d+(?:\.\d+)?$/.test(String(value).trim())) throw new AppError(`Preencha ${label} com um número.`, 400);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new AppError(`${label} fora do intervalo permitido.`, 400);
  return n;
}
function date(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new AppError('Data inválida: inclua o fuso horário.', 400);
  const d = new Date(value);
  if (!Number.isFinite(d.getTime()) || (now && (d > new Date(now.getTime() + 300000) || d < new Date(now.getTime() - 366 * 86400000)))) throw new AppError('Data do registro fora do intervalo permitido.', 400);
  return d.toISOString();
}
function body(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('Corpo da solicitação inválido.', 400);
  return value;
}
// JSON databases may reorder object keys. Values, types and array order still
// belong to the request identity, so compare structure instead of serialized text.
function same(a, b) { return isDeepStrictEqual(a, b); }
function assertSame(a, b) { if (!same(a, b)) throw new AppError('Este identificador já foi usado com outros dados. Revise o registro.', 409); }
function sessionSummary(session) {
  const exercises = session.planSnapshot.exercises;
  const counts = new Map();
  let workingVolumeKg = 0, warmupVolumeKg = 0, workingSets = 0, warmupSets = 0;
  for (const set of session.sets || []) {
    const volume = Number(set.weightKg) * set.reps;
    if (set.kind === 'working') { workingVolumeKg += volume; workingSets++; counts.set(set.exerciseId, (counts.get(set.exerciseId) || 0) + 1); }
    else { warmupVolumeKg += volume; warmupSets++; }
  }
  const plannedWorkingSets = exercises.reduce((sum, e) => sum + e.sets, 0);
  const missingPlannedSets = exercises.reduce((sum, e) => sum + Math.max(0, e.sets - (counts.get(e.id) || 0)), 0);
  return { workingVolumeKg, warmupVolumeKg, workingSets, warmupSets, plannedWorkingSets, missingPlannedSets, planFullyLogged: exercises.length > 0 && missingPlannedSets === 0 };
}
function present(session) { return { ...session, summary: sessionSummary(session) }; }
const genericMuscleGroups = new Set(['multiplos', 'outros', 'nao informado', 'cardio', 'funcional']);
function directMuscleGroup(value) {
  if (typeof value !== 'string') return null;
  const group = value.trim();
  const key = group.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').toLowerCase();
  return !group || genericMuscleGroups.has(key) ? null : group;
}
function summarizeSessions(sessions, now = new Date()) {
  const from = new Date(now.getTime() - 7 * 86400000);
  const result = { from: from.toISOString(), to: now.toISOString(), workingSets: 0, warmupSets: 0, workingVolumeKg: 0, warmupVolumeKg: 0, directSetsByMuscle: Object.create(null), unknownMuscleSets: 0, timing: 'performedAt informado pelo aluno', scope: 'Somente grupo registrado na ficha; músculos secundários não são estimados.' };
  for (const session of sessions) for (const set of session.sets || []) {
    const time = new Date(set.performedAt);
    if (!Number.isFinite(time.getTime()) || time < from || time > now) continue;
    const weight = Number(set.weightKg), reps = set.reps;
    if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps < 1) continue;
    if (set.kind === 'warmup') { result.warmupSets++; result.warmupVolumeKg += weight * reps; }
    else if (set.kind === 'working') {
      result.workingSets++; result.workingVolumeKg += weight * reps;
      const exercise = session.planSnapshot.exercises.find(e => e.id === set.exerciseId);
      const muscle = directMuscleGroup(Object.hasOwn(set, 'muscleGroup') ? set.muscleGroup : exercise?.muscleGroup);
      if (muscle !== null) result.directSetsByMuscle[muscle] = (result.directSetsByMuscle[muscle] || 0) + 1;
      else result.unknownMuscleSets++;
    }
  }
  return result;
}
function createSessoesService(repo, { now = () => new Date() } = {}) {
  async function student(tx, userId) {
    const record = await tx.findStudent(numeric(userId, 'usuário', 1, 2147483647, true));
    if (!record) throw new AppError('Perfil de aluno não encontrado.', 404);
    return record;
  }
  async function owned(tx, id, owner) {
    const session = await tx.lockSession(id);
    if (!session) throw new AppError('Sessão não encontrada.', 404);
    if (session.studentId !== owner.id) throw new AppError('Esta sessão não pertence à sua conta.', 403);
    return session;
  }
  return {
    async start(userId, input) {
      const data = body(input);
      const request = { id: uuid(data.id), workoutId: numeric(data.workoutId, 'ficha', 1, 2147483647, true), clientStartedAt: date(data.clientStartedAt) };
      return repo.transaction(async tx => {
        const owner = await student(tx, userId);
        const existing = await tx.findSession(request.id);
        if (existing) {
          if (existing.studentId !== owner.id) throw new AppError('Este identificador pertence a outra conta.', 403);
          assertSame(existing.startRequest, request); return present(existing);
        }
        businessRules.validateWorkoutView(owner);
        date(request.clientStartedAt, now());
        if (owner.status === 'inactive') throw new AppError('Sua matrícula está inativa.', 403);
        const workout = await tx.findWorkout(request.workoutId);
        if (!workout) throw new AppError('Ficha não encontrada.', 404);
        if (workout.studentId !== owner.id) throw new AppError('Esta ficha não pertence à sua conta.', 403);
        if (!workout.active) throw new AppError('Esta ficha está inativa.', 409);
        if (!workout.exercises.length) throw new AppError('A ficha não contém exercícios.', 409);
        const planSnapshot = { workoutId: workout.id, name: workout.name, description: workout.description || null, notes: workout.notes || null, exercises: workout.exercises.map(e => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup || null, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds ?? null, suggestedLoad: e.suggestedLoad || null, notes: e.notes || null, orderIndex: e.orderIndex })) };
        return present(await tx.createSession({ id: request.id, studentId: owner.id, workoutId: request.workoutId, clientStartedAt: new Date(request.clientStartedAt), startRequest: request, planSnapshot, status: 'active' }));
      });
    },
    async addSet(userId, sessionId, input) {
      const id = uuid(sessionId), data = body(input), at = now();
      const weightKg = numeric(data.weightKg, 'carga (kg)', 0, 2000);
      if (Math.abs(weightKg * 100 - Math.round(weightKg * 100)) > 1e-7) throw new AppError('Carga: use até duas casas decimais.', 400);
      if (!['working', 'warmup'].includes(data.kind)) throw new AppError('Selecione trabalho ou aquecimento.', 400);
      if (data.notes !== undefined && data.notes !== null && (typeof data.notes !== 'string' || data.notes.length > 2000)) throw new AppError('Nota inválida (máximo de 2000 caracteres).', 400);
      const payload = { id: uuid(data.id), exerciseId: numeric(data.exerciseId, 'exercício', 1, 2147483647, true), weightKg, reps: numeric(data.reps, 'repetições', 1, 1000, true), rir: data.rir === undefined || data.rir === null ? null : numeric(data.rir, 'RIR', 0, 10), kind: data.kind, performedAt: date(data.performedAt), notes: typeof data.notes === 'string' ? data.notes.trim() || null : null };
      return repo.transaction(async tx => {
        const owner = await student(tx, userId), session = await owned(tx, id, owner);
        const existing = await tx.findSet(payload.id);
        if (existing) {
          if (existing.sessionId !== id) throw new AppError('ID de série já utilizado em outra sessão.', 409);
          assertSame(existing.payload, payload); return existing;
        }
        if (session.status !== 'active') throw new AppError('A sessão já foi finalizada.', 409);
        date(payload.performedAt, at);
        const exercise = session.planSnapshot.exercises.find(e => e.id === payload.exerciseId);
        if (!exercise) throw new AppError('Exercício ausente do plano desta sessão.', 400);
        if (session.sets.length >= 1000) throw new AppError('Limite de séries da sessão atingido.', 400);
        return tx.createSet({ ...payload, sessionId: id, exerciseName: exercise.name, muscleGroup: exercise.muscleGroup, performedAt: new Date(payload.performedAt), payload });
      });
    },
    async complete(userId, sessionId, input) {
      const id = uuid(sessionId), data = body(input);
      if (!Array.isArray(data.setIds) || data.setIds.length > 1000) throw new AppError('Informe os IDs das séries registradas.', 400);
      const request = { setIds: data.setIds.map(uuid).sort() };
      if (new Set(request.setIds).size !== request.setIds.length) throw new AppError('IDs de séries repetidos.', 400);
      return repo.transaction(async tx => {
        const owner = await student(tx, userId), session = await owned(tx, id, owner);
        if (session.status === 'completed') { assertSame(session.completionRequest, request); return present(session); }
        const actual = session.sets.map(s => s.id).sort();
        if (!same(actual, request.setIds)) throw new AppError('Há séries ainda não sincronizadas ou registros de outra aba. Sincronize o histórico antes de finalizar.', 409);
        return present(await tx.completeSession(id, { status: 'completed', completedAt: now(), completionRequest: request }));
      });
    },
    async mine(userId) {
      const owner = await student(repo, userId);
      const at = now(), from = new Date(at.getTime() - 7 * 86400000);
      const [sessions, recent] = await Promise.all([repo.listSessions(owner.id), repo.listRecentSessions(owner.id, from, at)]);
      return { sessions: sessions.map(present), historyLimit: 100, historyMayBeTruncated: sessions.length === 100, summary7Days: summarizeSessions(recent, at) };
    },
  };
}
module.exports = { createSessoesService, summarizeSessions, sessionSummary };
