'use strict';
const repository = require('../repositories/treinos.repository');
const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const businessRules = require('../utils/businessRules');

// These are storage limits, not exercise recommendations.
function numeric(value, label, min, max, integer = false) {
  if (!['number', 'string'].includes(typeof value) || !/^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    throw new AppError(`${label}: informe um número válido.`, 400);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new AppError(`${label} fora do intervalo permitido.`, 400);
  return n;
}
function id(value, label = 'ID') {
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) throw new AppError(`${label} inválido.`, 400);
  return numeric(value, label, 1, 2147483647, true);
}
function body(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('Dados de treino inválidos.', 400);
  return value;
}
function text(value, label, max, required = false) {
  if (!required && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new AppError(`${label}: use texto${required ? ' obrigatório' : ''} com até ${max} caracteres.`, 400);
  }
  return value.trim() || null;
}
function repetitions(value) {
  if (!['number', 'string'].includes(typeof value)) throw new AppError('Informe repetições ou uma faixa de repetições.', 400);
  const match = String(value).trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!match) throw new AppError('Use repetições inteiras ou uma faixa, como 8–12.', 400);
  const low = numeric(match[1], 'Repetições', 1, 1000, true);
  const high = match[2] ? numeric(match[2], 'Repetições', low, 1000, true) : null;
  return high === null ? String(low) : `${low}-${high}`;
}
function exercises(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new AppError('Informe entre 1 e 100 exercícios.', 400);
  return value.map((raw, index) => {
    const ex = body(raw);
    return { name: text(ex.name, `Nome do exercício ${index + 1}`, 100, true),
      muscleGroup: text(ex.muscleGroup, 'Grupo muscular', 50),
      sets: numeric(ex.sets, 'Séries', 1, 100, true), reps: repetitions(ex.reps),
      restSeconds: numeric(ex.restSeconds, 'Descanso em segundos', 0, 3600, true),
      suggestedLoad: text(ex.suggestedLoad, 'Carga sugerida', 50), notes: text(ex.notes, 'Observações', 10000),
      orderIndex: index + 1 };
  });
}
function workoutData(value) {
  const data = body(value);
  return { name: text(data.name, 'Nome da ficha', 100, true), description: text(data.description, 'Descrição', 10000),
    notes: text(data.notes, 'Observações', 10000) };
}

function createTreinosService({ repo = repository, db = prisma, rules = businessRules } = {}) {
  function manager(user) {
    rules.validateInstructorAccess(user);
    // Defense in depth: ownership never depends only on the route middleware.
    if (!user || !['admin', 'instructor'].includes(user.role)) throw new AppError('Acesso à gestão de fichas negado.', 403);
    return { id: id(user.id, 'Usuário'), role: user.role };
  }
  function scope(user) { return user.role === 'instructor' ? { instructorId: user.id } : {}; }
  async function owned(workoutId, user) {
    const workout = await repo.findById(id(workoutId));
    if (!workout) throw new AppError('Treino não encontrado.', 404);
    if (user.role === 'instructor' && workout.instructorId !== user.id) throw new AppError('Esta ficha pertence a outro instrutor.', 403);
    return workout;
  }
  async function student(userId, checkAccess = false) {
    const record = await db.student.findUnique({ where: { userId: id(userId, 'Usuário') },
      select: { id: true, status: true, planEndDate: true, user: { select: { active: true } } } });
    if (!record) throw new AppError('Perfil de aluno não encontrado.', 404);
    if (checkAccess) {
      if (record.user?.active === false || record.status === 'inactive') throw new AppError('Matrícula inativa.', 403);
      rules.validateWorkoutView(record);
    }
    return record;
  }
  return {
    async listar(filters = {}, actor) {
      const user = manager(actor); body(filters);
      const safe = { ...scope(user) };
      if (filters.studentId !== undefined) safe.studentId = id(filters.studentId, 'Aluno');
      if (filters.active !== undefined) {
        if (typeof filters.active !== 'boolean') throw new AppError('Use active=true ou active=false.', 400);
        safe.active = filters.active;
      }
      return repo.findAll(safe);
    },
    async buscarPorId(workoutId, actor) { return owned(workoutId, manager(actor)); },
    async listarAlunosElegiveis(actor) {
      manager(actor);
      const students = await db.student.findMany({ where: { status: 'active', user: { active: true } },
        select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: 'asc' } } });
      return students.map(record => ({ id: record.id, name: record.user.name }));
    },
    async listarCatalogo(actor) {
      manager(actor);
      return db.catalogoExercicio.findMany({ where: { ativo: true }, orderBy: [{ grupo_muscular: 'asc' }, { nome: 'asc' }],
        select: { id: true, nome: true, grupo_muscular: true, source: true, externalId: true, locale: true, curated: true, sourceMetadata: true } });
    },
    async criar(input, actor) {
      const user = manager(actor); const data = body(input);
      const fields = workoutData(data); const plan = exercises(data.exercises); const studentId = id(data.studentId, 'Aluno');
      const record = await db.student.findUnique({ where: { id: studentId }, select: { id: true, status: true, user: { select: { active: true } } } });
      if (!record) throw new AppError('Aluno não encontrado.', 404);
      if (record.status !== 'active' || record.user?.active !== true) throw new AppError('Selecione um aluno com matrícula ativa.', 400);
      return repo.createWithExercises({ ...fields, studentId, instructorId: user.id }, plan);
    },
    async atualizar(workoutId, input, actor) {
      const user = manager(actor); const current = await owned(workoutId, user); const data = body(input);
      if (!current.active) throw new AppError('Ficha arquivada: crie uma nova ficha para preservar o histórico.', 409);
      if (data.studentId !== undefined && id(data.studentId, 'Aluno') !== current.studentId) throw new AppError('Uma ficha não pode ser transferida para outro aluno.', 400);
      return repo.updateWithExercises(current.id, workoutData(data), exercises(data.exercises), scope(user));
    },
    async desativar(workoutId, actor) {
      const user = manager(actor); const current = await owned(workoutId, user);
      return repo.deactivate(current.id, scope(user));
    },
    async buscarMeusTreinos(userId) { return repo.findByStudentId((await student(userId, true)).id); },
    async buscarHistoricoTreinos(userId) { return repo.findHistoryByStudentId((await student(userId, true)).id); },
    async registrarCarga(input, userId) {
      const data = body(input);
      const exerciseId = id(data.exerciseId, 'Exercício');
      const weight = numeric(data.weight, 'Carga em kg', 0, 9999.99);
      if (Math.abs(weight * 100 - Math.round(weight * 100)) > 1e-7) throw new AppError('A carga aceita até duas casas decimais.', 400);
      const repsCompleted = data.repsCompleted == null || data.repsCompleted === '' ? null : numeric(data.repsCompleted, 'Repetições', 1, 1000, true);
      const notes = text(data.notes, 'Observações', 10000);
      const owner = await student(userId, true);
      const exercise = await db.exercise.findUnique({ where: { id: exerciseId }, include: { workout: { select: { studentId: true, active: true } } } });
      if (!exercise) throw new AppError('Exercício não encontrado.', 404);
      if (exercise.workout.studentId !== owner.id) throw new AppError('Este exercício não pertence ao seu treino.', 403);
      if (!exercise.workout.active) throw new AppError('Esta ficha está arquivada.', 409);
      return repo.createWorkoutLog({ studentId: owner.id, exerciseId, weight, repsCompleted, notes });
    },
    async listarHistoricoCarga(userId, exerciseId = null) {
      const filter = exerciseId === null ? null : id(exerciseId, 'Exercício');
      return repo.findWorkoutLogs((await student(userId)).id, filter);
    },
  };
}
module.exports = { ...createTreinosService(), createTreinosService };
