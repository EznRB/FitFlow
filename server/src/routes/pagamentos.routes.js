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
 * PUT    /api/pagamentos/:id                 — Atualizar pagamento
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
router.get('/aluno/:alunoId', pagamentosController.buscarPorAluno);

// CRUD principal
router.get('/', pagamentosController.listar);
router.get('/:id', pagamentosController.buscarPorId);
router.post('/', pagamentosController.registrar);
router.put('/:id', pagamentosController.atualizar);

module.exports = router;
