/**
 * ============================================================================
 * FitFlow Caraguá — Rotas de Pagamentos (TASK 07)
 * ============================================================================
 * IMPORTANTE: Rotas com path fixo (ex: /inadimplentes, /resumo) devem vir
 * ANTES das rotas com parâmetro dinâmico (ex: /:id), caso contrário o Express
 * interpretará "inadimplentes" como um ID numérico e falhará.
 *
 * GET    /api/pagamentos                     — Listar todos (com filtros)
 * GET    /api/pagamentos/inadimplentes       — Lista de inadimplentes
 * GET    /api/pagamentos/resumo              — Resumo financeiro
 * GET    /api/pagamentos/aluno/:alunoId      — Histórico do aluno
 * GET    /api/pagamentos/:id                 — Buscar por ID
 * POST   /api/pagamentos                     — Registrar pagamento
 * POST   /api/pagamentos/verificar-inadimplencia — Executar verificação
 * PUT/PATCH/DELETE /api/pagamentos/:id       — Não permitidos; registro preservado
 */

const express = require('express');
const router = express.Router();
const pagamentosController = require('../controllers/pagamentos.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação + role admin
router.use(authenticate, authorize('admin'));

// Rotas com path fixo (ANTES de /:id)
router.get('/inadimplentes', pagamentosController.listarInadimplentes);
router.get('/resumo', pagamentosController.resumoFinanceiro);
router.post('/verificar-inadimplencia', pagamentosController.verificarInadimplencia);

// Rotas com sub-recurso
router.get('/solicitacoes/:requestId', pagamentosController.buscarPorSolicitacao);
router.get('/ajustes/solicitacoes/:requestId', pagamentosController.buscarAjustePorSolicitacao);
router.get('/:id/ajustes', pagamentosController.listarAjustes);
router.post('/:id/ajustes', pagamentosController.registrarAjuste);
router.all('/:id/ajustes', (req, res, next) => {
  if (!['PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.set('Allow', 'GET, POST').status(405).json({ status: 'fail', message: 'Ajustes são eventos preservados; alteração ou exclusão não é permitida.' });
});
router.all('/ajustes/:requestId', (req, res, next) => {
  if (!['PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.set('Allow', 'GET').status(405).json({ status: 'fail', message: 'Ajustes são eventos preservados; alteração ou exclusão não é permitida.' });
});
router.get('/aluno/:alunoId', pagamentosController.buscarPorAluno);

// CRUD principal
router.get('/', pagamentosController.listar);
router.get('/:id', pagamentosController.buscarPorId);
router.post('/', pagamentosController.registrar);
router.all('/:id', (req, res, next) => {
  if (!['PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.set('Allow', 'GET').status(405).json({ status: 'fail',
    message: 'Recebimentos financeiros são preservados; alteração ou exclusão direta não é permitida. Correções e estornos exigem um fluxo auditado próprio.' });
});

module.exports = router;
