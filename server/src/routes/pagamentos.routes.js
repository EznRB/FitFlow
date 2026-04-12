/**
 * ============================================
 * FitFlow Caraguá — Rotas de Pagamentos
 * ============================================
 * GET    /api/pagamentos              — Listar todos
 * GET    /api/pagamentos/:id          — Buscar por ID
 * GET    /api/pagamentos/aluno/:id    — Pagamentos de um aluno
 * POST   /api/pagamentos              — Registrar pagamento
 * PUT    /api/pagamentos/:id          — Atualizar pagamento
 */

const express = require('express');
const router = express.Router();
const pagamentosController = require('../controllers/pagamentos.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação + role admin
router.use(authenticate, authorize('admin'));

router.get('/', pagamentosController.listar);
router.get('/:id', pagamentosController.buscarPorId);
router.get('/aluno/:alunoId', pagamentosController.buscarPorAluno);
router.post('/', pagamentosController.registrar);
router.put('/:id', pagamentosController.atualizar);

module.exports = router;
