/**
 * ============================================================================
 * FitFlow Caraguá — Controller do Painel do Aluno (TASK 10)
 * ============================================================================
 * Endpoints exclusivos para a área do aluno logado.
 * Todos os dados retornados são isolados para o aluno autenticado.
 *
 * Rotas:
 * GET /api/aluno/painel           — Dados consolidados (dashboard do aluno)
 * GET /api/aluno/mensalidade      — Detalhes da situação financeira
 * GET /api/aluno/checkins         — Histórico de check-ins (paginado)
 * GET /api/aluno/historico-carga  — Histórico de cargas por exercício
 *
 * Segurança:
 * ⚠️ Todas as rotas exigem autenticação + role 'student'.
 * ⚠️ O userId é extraído do token JWT — o aluno NUNCA informa seu próprio ID.
 */

const alunoPainelService = require('../services/aluno-painel.service');
const { sendSuccess } = require('../utils/helpers');

const alunoPainelController = {

  /**
   * GET /api/aluno/painel
   * Retorna TODOS os dados do aluno em uma única chamada.
   * Otimizado para a tela principal do app mobile-first.
   *
   * Dados incluídos:
   * - Perfil (nome, status, plano)
   * - Mensalidade (vencimento, dias restantes)
   * - Treinos ativos com exercícios e última carga
   * - Check-ins recentes e total do mês
   * - Alertas dinâmicos (bloqueio, vencimento, etc.)
   */
  async painel(req, res, next) {
    try {
      const dados = await alunoPainelService.getPainelCompleto(req.user.id);
      sendSuccess(res, 200, 'Painel do aluno carregado com sucesso', dados);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/aluno/mensalidade
   * Retorna detalhes financeiros: plano atual, últimos pagamentos,
   * dias até vencimento e status visual (em_dia, vencendo, vencido, bloqueado).
   */
  async mensalidade(req, res, next) {
    try {
      const dados = await alunoPainelService.getMensalidade(req.user.id);
      sendSuccess(res, 200, 'Dados de mensalidade carregados', dados);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/aluno/checkins
   * Retorna histórico completo de check-ins do aluno com paginação.
   * Query params: limit (padrão 20), offset (padrão 0)
   */
  async checkins(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const dados = await alunoPainelService.getCheckins(req.user.id, limit, offset);
      sendSuccess(res, 200, 'Histórico de check-ins carregado', dados);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/aluno/historico-carga
   * Retorna histórico de cargas agrupado por exercício.
   * Query param opcional: exerciseId (filtra por exercício específico)
   */
  async historicoCarga(req, res, next) {
    try {
      const { exerciseId } = req.query;
      const dados = await alunoPainelService.getHistoricoCarga(req.user.id, exerciseId);
      sendSuccess(res, 200, 'Histórico de cargas carregado', dados);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = alunoPainelController;
