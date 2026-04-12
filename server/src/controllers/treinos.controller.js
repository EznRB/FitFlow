/**
 * ============================================
 * FitFlow Caraguá — Controller de Treinos
 * ============================================
 * Gerencia treinos (admin) e permite aluno
 * visualizar treino e registrar cargas.
 * 
 * Rotas Admin:
 * GET    /api/treinos          — Listar todos os treinos
 * GET    /api/treinos/:id      — Buscar treino por ID
 * POST   /api/treinos          — Criar treino para aluno
 * PUT    /api/treinos/:id      — Atualizar treino
 * DELETE /api/treinos/:id      — Desativar treino (soft delete)
 * 
 * Rotas Aluno:
 * GET    /api/treinos/meus     — Meus treinos ativos
 * POST   /api/treinos/carga    — Registrar carga executada
 * GET    /api/treinos/historico — Histórico de cargas
 */

const { sendSuccess } = require('../utils/helpers');
const treinosService = require('../services/treinos.service');

const treinosController = {

  // ============================================
  // ROTAS DO ADMIN (INSTRUTOR)
  // ============================================

  /**
   * GET /api/treinos
   * Lista todos os treinos com filtros opcionais.
   * Query params: studentId, active (true/false)
   */
  async listar(req, res, next) {
    try {
      const filters = {};

      // Filtra por aluno específico
      if (req.query.studentId) {
        filters.studentId = req.query.studentId;
      }

      // Filtra por status ativo/inativo
      if (req.query.active !== undefined) {
        filters.active = req.query.active === 'true';
      }

      const treinos = await treinosService.listar(filters);
      sendSuccess(res, 200, 'Treinos listados com sucesso', treinos);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/treinos/:id
   * Busca um treino completo por ID com exercícios.
   */
  async buscarPorId(req, res, next) {
    try {
      const treino = await treinosService.buscarPorId(req.params.id);
      sendSuccess(res, 200, 'Treino encontrado', treino);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/treinos
   * Cria um novo treino com exercícios para um aluno.
   * o instructorId é extraído do token JWT (req.user.id).
   * 
   * Body esperado:
   * {
   *   name: "Treino A - Peito e Tríceps",
   *   description: "Foco em hipertrofia",
   *   notes: "Descanso de 60s entre séries",
   *   studentId: 1,
   *   exercises: [
   *     { name: "Supino Reto", muscleGroup: "Peito", sets: 4, reps: "12", suggestedLoad: "40kg" },
   *     { name: "Tríceps Pulley", muscleGroup: "Tríceps", sets: 3, reps: "15", suggestedLoad: "20kg" }
   *   ]
   * }
   */
  async criar(req, res, next) {
    try {
      const instructorId = req.user.id; // ID extraído do JWT
      const treino = await treinosService.criar(req.body, instructorId);
      sendSuccess(res, 201, 'Treino criado com sucesso', treino);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/treinos/:id
   * Atualiza um treino existente.
   * Se houver logs de carga, preserva exercícios existentes.
   */
  async atualizar(req, res, next) {
    try {
      const instructorId = req.user.id;
      const treino = await treinosService.atualizar(req.params.id, req.body, instructorId);

      // Avisa o admin se os exercícios não puderam ser alterados
      const mensagem = treino._exercisesLocked
        ? 'Treino atualizado (exercícios mantidos — histórico de cargas existente)'
        : 'Treino atualizado com sucesso';

      sendSuccess(res, 200, mensagem, treino);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/treinos/:id (soft delete)
   * Desativa o treino sem apagar dados.
   * Histórico completo é preservado.
   */
  async desativar(req, res, next) {
    try {
      await treinosService.desativar(req.params.id);
      sendSuccess(res, 200, 'Treino desativado com sucesso. Histórico preservado.');
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // ROTAS DO ALUNO
  // ============================================

  /**
   * GET /api/treinos/meus
   * Retorna os treinos ativos do aluno logado.
   * O userId vem do token JWT.
   */
  async meusTreinos(req, res, next) {
    try {
      const treinos = await treinosService.buscarMeusTreinos(req.user.id);
      sendSuccess(res, 200, 'Seus treinos foram carregados', treinos);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/treinos/carga
   * Registra a carga executada pelo aluno em um exercício.
   * 
   * Body esperado:
   * {
   *   exerciseId: 5,
   *   weight: 42.5,
   *   repsCompleted: 10,
   *   notes: "Últimas 2 reps com ajuda"
   * }
   */
  async registrarCarga(req, res, next) {
    try {
      const log = await treinosService.registrarCarga(req.body, req.user.id);
      sendSuccess(res, 201, 'Carga registrada com sucesso', log);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/treinos/historico
   * Retorna o histórico de cargas do aluno.
   * Query param opcional: exerciseId
   */
  async historicoCarga(req, res, next) {
    try {
      const exerciseId = req.query.exerciseId || null;
      const historico = await treinosService.listarHistoricoCarga(req.user.id, exerciseId);
      sendSuccess(res, 200, 'Histórico de cargas carregado', historico);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = treinosController;
