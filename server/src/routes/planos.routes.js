/**
 * ============================================
 * FitFlow Caraguá — Rotas de Planos
 * ============================================
 * GET    /api/planos         — Listar todos
 * GET    /api/planos/:id     — Buscar por ID
 * POST   /api/planos         — Criar plano
 * PUT    /api/planos/:id     — Atualizar plano
 * DELETE /api/planos/:id     — Desativar plano
 */

const express = require('express');
const router = express.Router();
const planosController = require('../controllers/planos.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação + role admin
router.use(authenticate, authorize('admin'));

router.get('/', planosController.listar);
router.get('/:id', planosController.buscarPorId);
router.post('/', planosController.criar);
router.put('/:id', planosController.atualizar);
router.delete('/:id', planosController.desativar);

module.exports = router;
