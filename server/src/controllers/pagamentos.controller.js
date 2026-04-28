/**
 * ============================================================================
 * FitFlow Caraguá — Controller de Pagamentos (TASK 07)
 * ============================================================================
 * Gerencia endpoints financeiros. Apenas admin acessa (garantido pela Rota).
 * Delega regras de negócio para o pagamentos.service.js.
 */

const { sendSuccess } = require('../utils/helpers');
const pagamentosService = require('../services/pagamentos.service');
const AppError = require('../utils/AppError');

const pagamentosController = {
  /**
   * GET /api/pagamentos
   * Lista todos os pagamentos com filtros opcionais via query string.
   * Filtros: ?status=paid|pending|overdue &studentId=1 &startDate=... &endDate=...
   */
  async listar(req, res, next) {
    try {
      const pagamentos = await pagamentosService.listar(req.query);
      sendSuccess(res, 200, 'Lista de pagamentos recuperada com sucesso', pagamentos);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/pagamentos/:id
   * Busca um pagamento específico pelo ID.
   */
  async buscarPorId(req, res, next) {
    try {
      if (!req.params.id) throw new AppError('ID do pagamento não fornecido.', 400);

      const pagamento = await pagamentosService.buscarPorId(req.params.id);
      sendSuccess(res, 200, 'Detalhes do pagamento recuperados', pagamento);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/pagamentos/aluno/:alunoId
   * Retorna o histórico completo de pagamentos de um aluno.
   */
  async buscarPorAluno(req, res, next) {
    try {
      if (!req.params.alunoId) throw new AppError('ID do aluno não fornecido.', 400);

      const pagamentos = await pagamentosService.buscarPorAluno(req.params.alunoId);
      sendSuccess(res, 200, 'Histórico de pagamentos do aluno', pagamentos);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/pagamentos
   * Registra um novo pagamento e atualiza o vencimento do aluno.
   * Body: { studentId, planId?, amount, paymentMethod?, paymentDate?, notes? }
   */
  async registrar(req, res, next) {
    try {
      const { studentId, amount } = req.body;

      if (!studentId) throw new AppError('ID do aluno é obrigatório.', 400);
      if (!amount) throw new AppError('Valor do pagamento é obrigatório.', 400);

      // Passa o ID do admin que está registrando o pagamento
      const registeredBy = req.user ? req.user.id : null;

      const pagamento = await pagamentosService.registrar(req.body, registeredBy);
      sendSuccess(res, 201, 'Pagamento registrado com sucesso! Vencimento do aluno atualizado.', pagamento);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/pagamentos/:id
   * Atualiza dados de um pagamento existente (correção).
   * ⚠️ Nunca deleta — preserva histórico financeiro.
   */
  async atualizar(req, res, next) {
    try {
      if (!req.params.id) throw new AppError('ID do pagamento não fornecido.', 400);

      const pagamento = await pagamentosService.atualizar(req.params.id, req.body);
      sendSuccess(res, 200, 'Pagamento atualizado com sucesso.', pagamento);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/pagamentos/verificar-inadimplencia
   * Dispara a verificação de inadimplência manualmente.
   * Bloqueia alunos com atraso > 5 dias e marca pagamentos como "overdue".
   */
  async verificarInadimplencia(req, res, next) {
    try {
      const resultado = await pagamentosService.verificarInadimplencia();
      sendSuccess(res, 200, 'Verificação de inadimplência concluída.', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/pagamentos/inadimplentes
   * Retorna lista de alunos inadimplentes (bloqueados ou com vencimento passado).
   */
  async listarInadimplentes(req, res, next) {
    try {
      const inadimplentes = await pagamentosService.listarInadimplentes();
      sendSuccess(res, 200, 'Lista de alunos inadimplentes', inadimplentes);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/pagamentos/resumo
   * Retorna resumo financeiro para o dashboard (receita, pendentes, vencidos).
   */
  async resumoFinanceiro(req, res, next) {
    try {
      const resumo = await pagamentosService.resumoFinanceiro();
      sendSuccess(res, 200, 'Resumo financeiro', resumo);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = pagamentosController;
