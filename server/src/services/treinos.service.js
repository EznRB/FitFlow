/**
 * ============================================
 * FitFlow Caraguá — Service de Treinos
 * ============================================
 * Lógica de negócios para gestão de fichas de treino.
 * 
 * Responsabilidades:
 * - Validar dados de entrada (nome, aluno, exercícios)
 * - Garantir permissões (somente admin cria/edita)
 * - Orquestrar criação atômica de treino + exercícios
 * - Gerenciar histórico (soft delete, append-only logs)
 * 
 * Regras de negócio importantes:
 * 1. Somente admin/instructor pode criar e editar treinos
 * 2. Aluno pode apenas visualizar treinos e registrar cargas
 * 3. Histórico de treinos nunca é apagado (soft delete)
 * 4. Histórico de cargas é append-only (sem update/delete)
 */

const treinosRepo = require('../repositories/treinos.repository');
const AppError = require('../utils/AppError');
const { prisma } = require('../config/prisma');
const businessRules = require('../utils/businessRules');

class TreinosService {

  // ============================================
  // OPERAÇÕES DE ADMIN (INSTRUTOR)
  // ============================================

  /**
   * Lista todos os treinos com filtros opcionais.
   * Acesso exclusivo do admin.
   * @param {object} filters - { studentId, active }
   * @returns {Promise<Array>} Lista de treinos
   */
  async listar(filters = {}) {
    return treinosRepo.findAll(filters);
  }

  /**
   * Busca um treino específico por ID.
   * Inclui exercícios e dados completos.
   * @param {number} id - ID do treino
   * @returns {Promise<object>} Treino encontrado
   * @throws {AppError} 404 se não encontrar
   */
  async buscarPorId(id) {
    const treino = await treinosRepo.findById(id);
    if (!treino) {
      throw new AppError('Treino não encontrado.', 404);
    }
    return treino;
  }

  /**
   * Cria um novo treino com exercícios para um aluno.
   * 
   * Fluxo:
   * 1. Valida campos obrigatórios (nome, aluno, exercícios)
   * 2. Verifica se o aluno existe
   * 3. Cria treino + exercícios em transação atômica
   * 
   * @param {object} data - { name, description, notes, studentId, exercises[] }
   * @param {number} instructorId - ID do usuário instrutor que está criando
   * @returns {Promise<object>} Treino criado
   */
  async criar(data, instructorId) {
    // Validações de entrada
    this.validarDadosTreino(data);

    // Verifica se o aluno existe
    const aluno = await prisma.student.findUnique({
      where: { id: parseInt(data.studentId) },
    });
    if (!aluno) {
      throw new AppError('Aluno não encontrado.', 404);
    }

    // Prepara dados do treino
    const workoutData = {
      name: data.name.trim(),
      description: data.description || null,
      notes: data.notes || null,
      studentId: data.studentId,
      instructorId,
    };

    // Valida e prepara exercícios
    const exercises = this.prepararExercicios(data.exercises);

    // Cria em transação atômica (treino + exercícios)
    return treinosRepo.createWithExercises(workoutData, exercises);
  }

  /**
   * Atualiza um treino existente.
   * Se houver histórico de cargas, preserva os exercícios.
   * 
   * @param {number} id - ID do treino
   * @param {object} data - Dados atualizados
   * @param {number} instructorId - ID do instrutor
   * @returns {Promise<object>} Treino atualizado
   */
  async atualizar(id, data, instructorId) {
    // Verifica se o treino existe
    const treino = await this.buscarPorId(id);

    // Validações de entrada
    this.validarDadosTreino(data);

    const workoutData = {
      name: data.name.trim(),
      description: data.description || null,
      notes: data.notes || null,
    };

    const exercises = this.prepararExercicios(data.exercises);

    const resultado = await treinosRepo.updateWithExercises(id, workoutData, exercises);

    return resultado;
  }

  /**
   * Desativa um treino (soft delete).
   * Preserva todos os dados para histórico.
   * @param {number} id - ID do treino
   * @returns {Promise<object>} Treino desativado
   */
  async desativar(id) {
    await this.buscarPorId(id); // Garante que existe
    return treinosRepo.deactivate(id);
  }

  // ============================================
  // OPERAÇÕES DO ALUNO
  // ============================================

  /**
   * Retorna os treinos ativos do aluno logado.
   * O aluno vê apenas SEUS treinos ativos.
   * @param {number} userId - ID do usuário logado 
   * @returns {Promise<Array>} Treinos ativos do aluno
   */
  async buscarMeusTreinos(userId) {
    // Busca o registro de aluno vinculado ao userId
    const aluno = await prisma.student.findUnique({
      where: { userId: parseInt(userId) },
    });

    if (!aluno) {
      throw new AppError('Perfil de aluno não encontrado.', 404);
    }

    // REGRA DE NEGÓCIO CENTRAL: Bloqueia a visualização se inadimplente > 5 dias
    businessRules.validateWorkoutView(aluno);

    return treinosRepo.findByStudentId(aluno.id);
  }

  /**
   * Retorna o histórico completo de treinos do aluno (ativos + inativos).
   * Permite ver fichas antigas para comparação de evolução.
   * @param {number} userId - ID do usuário logado
   * @returns {Promise<Array>} Todos os treinos do aluno
   */
  async buscarHistoricoTreinos(userId) {
    const aluno = await prisma.student.findUnique({
      where: { userId: parseInt(userId) },
    });

    if (!aluno) {
      throw new AppError('Perfil de aluno não encontrado.', 404);
    }

    // REGRA DE NEGÓCIO CENTRAL: Bloqueia a visualização se inadimplente > 5 dias
    businessRules.validateWorkoutView(aluno);

    return treinosRepo.findHistoryByStudentId(aluno.id);
  }

  /**
   * Registra a carga executada pelo aluno em um exercício.
   * Operação append-only: cria novo registro sempre.
   * 
   * Validações:
   * - Exercício deve existir
   * - Exercício deve pertencer a um treino do aluno
   * - Carga deve ser um valor positivo
   * 
   * @param {object} data - { exerciseId, weight, repsCompleted, notes }
   * @param {number} userId - ID do usuário aluno logado
   * @returns {Promise<object>} Registro de carga criado
   */
  async registrarCarga(data, userId) {
    // Busca o aluno pelo userId
    const aluno = await prisma.student.findUnique({
      where: { userId: parseInt(userId) },
    });

    if (!aluno) {
      throw new AppError('Perfil de aluno não encontrado.', 404);
    }

    // Valida dados de carga
    if (!data.exerciseId) {
      throw new AppError('ID do exercício é obrigatório.', 400);
    }
    if (!data.weight || parseFloat(data.weight) <= 0) {
      throw new AppError('A carga deve ser um valor positivo.', 400);
    }

    // Verifica se o exercício pertence a um treino do aluno
    const exercicio = await prisma.exercise.findUnique({
      where: { id: parseInt(data.exerciseId) },
      include: { workout: { select: { studentId: true, active: true } } },
    });

    if (!exercicio) {
      throw new AppError('Exercício não encontrado.', 404);
    }

    if (exercicio.workout.studentId !== aluno.id) {
      throw new AppError('Este exercício não pertence ao seu treino.', 403);
    }

    // Cria o registro de carga (append-only)
    return treinosRepo.createWorkoutLog({
      studentId: aluno.id,
      exerciseId: data.exerciseId,
      weight: data.weight,
      repsCompleted: data.repsCompleted || null,
      notes: data.notes || null,
    });
  }

  /**
   * Consulta o histórico de cargas do aluno.
   * Pode filtrar por exercício específico.
   * @param {number} userId - ID do usuário aluno
   * @param {number|null} exerciseId - Filtro por exercício (opcional)
   * @returns {Promise<Array>} Histórico de cargas
   */
  async listarHistoricoCarga(userId, exerciseId = null) {
    const aluno = await prisma.student.findUnique({
      where: { userId: parseInt(userId) },
    });

    if (!aluno) {
      throw new AppError('Perfil de aluno não encontrado.', 404);
    }

    return treinosRepo.findWorkoutLogs(aluno.id, exerciseId);
  }

  // ============================================
  // VALIDAÇÕES INTERNAS
  // ============================================

  /**
   * Valida os dados obrigatórios de um treino.
   * @param {object} data - Dados do treino
   * @throws {AppError} Se dados inválidos
   */
  validarDadosTreino(data) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      throw new AppError('O nome do treino é obrigatório.', 400);
    }

    if (!data.studentId) {
      throw new AppError('O aluno é obrigatório para criar um treino.', 400);
    }

    if (!data.exercises || !Array.isArray(data.exercises) || data.exercises.length === 0) {
      throw new AppError('O treino deve conter pelo menos 1 exercício.', 400);
    }
  }

  /**
   * Prepara e valida a lista de exercícios para inserção.
   * Garante que cada exercício tem nome e índice de ordem.
   * @param {Array} exercises - Lista de exercícios crus
   * @returns {Array} Exercícios validados e formatados
   */
  prepararExercicios(exercises) {
    return exercises.map((ex, index) => {
      if (!ex.name || ex.name.trim() === '') {
        throw new AppError(`O exercício na posição ${index + 1} deve ter um nome.`, 400);
      }

      return {
        name: ex.name.trim(),
        muscleGroup: ex.muscleGroup || null,
        sets: parseInt(ex.sets) || 3,
        reps: String(ex.reps || '12'),
        restSeconds: parseInt(ex.restSeconds) || 60,
        suggestedLoad: ex.suggestedLoad || null,
        notes: ex.notes || null,
        orderIndex: index + 1,
      };
    });
  }
}

module.exports = new TreinosService();
