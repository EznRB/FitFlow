/**
 * ============================================
 * FitFlow Caraguá — Controller de Exercícios
 * ============================================
 * CRUD do catálogo de exercícios da academia.
 * Apenas admin pode criar, editar e desativar.
 * 
 * Endpoints:
 * GET    /api/exercicios           — Listar todos
 * GET    /api/exercicios/grupos    — Listar grupos musculares
 * GET    /api/exercicios/:id       — Buscar por ID
 * POST   /api/exercicios           — Criar exercício
 * PUT    /api/exercicios/:id       — Atualizar exercício
 * DELETE /api/exercicios/:id       — Desativar exercício (soft delete)
 */

const { sendSuccess } = require('../utils/helpers');
const exerciciosService = require('../services/exercicios.service');
const wgerService = require('../services/wger.service');

const exerciciosController = {

  /**
   * GET /api/exercicios
   * Lista exercícios do catálogo com filtros opcionais.
   * Query params: grupo_muscular, ativo
   */
  async listar(req, res, next) {
    try {
      const filtros = {};

      // Permite filtrar por grupo muscular (ex: ?grupo_muscular=Peito)
      if (req.query.grupo_muscular) {
        filtros.grupoMuscular = req.query.grupo_muscular;
      }

      // Permite ver inativos (ex: ?ativo=false)
      if (req.query.ativo !== undefined) {
        filtros.ativo = req.query.ativo === 'true';
      }

      const exercicios = await exerciciosService.listar(filtros);
      sendSuccess(res, 200, 'Exercícios listados com sucesso', exercicios);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/exercicios/grupos
   * Lista os grupos musculares disponíveis no catálogo.
   * Usado para preencher selects e filtros no frontend.
   */
  async listarGrupos(req, res, next) {
    try {
      const grupos = await exerciciosService.listarGruposMusculares();
      sendSuccess(res, 200, 'Grupos musculares listados', grupos);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/exercicios/:id
   * Busca um exercício específico por ID.
   */
  async buscarPorId(req, res, next) {
    try {
      const exercicio = await exerciciosService.buscarPorId(req.params.id);
      sendSuccess(res, 200, 'Exercício encontrado', exercicio);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/exercicios
   * Cria um novo exercício no catálogo.
   * Body: { nome, grupo_muscular, instrucoes }
   */
  async criar(req, res, next) {
    try {
      const exercicio = await exerciciosService.criar(req.body);
      sendSuccess(res, 201, 'Exercício criado com sucesso', exercicio);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/exercicios/:id
   * Atualiza um exercício existente no catálogo.
   * Body: { nome, grupo_muscular, instrucoes }
   */
  async atualizar(req, res, next) {
    try {
      const exercicio = await exerciciosService.atualizar(req.params.id, req.body);
      sendSuccess(res, 200, 'Exercício atualizado com sucesso', exercicio);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/exercicios/:id
   * Desativa um exercício do catálogo (soft delete).
   * Não apaga de verdade para preservar referências em treinos.
   */
  async desativar(req, res, next) {
    try {
      await exerciciosService.desativar(req.params.id);
      sendSuccess(res, 200, 'Exercício desativado com sucesso');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/exercicios/sync
   * Sincroniza exercícios com a Wger API (Open-source)
   */
  async sincronizarAPI(req, res, next) {
    try {
      // Pega o limite do query, ou usa 50
      const limit = parseInt(req.query.limit) || 100;
      const resultado = await wgerService.sincronizar(limit);
      
      sendSuccess(res, 200, `Sincronização concluída. Inseridos: ${resultado.inseridos}, Ignorados (já existem): ${resultado.ignorados}`, resultado);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = exerciciosController;
