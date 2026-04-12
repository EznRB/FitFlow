/**
 * ============================================
 * FitFlow Caraguá — Rotas de Alunos
 * ============================================
 * GET    /api/alunos         — Listar todos
 * GET    /api/alunos/:id     — Buscar por ID
 * POST   /api/alunos         — Cadastrar novo
 * PUT    /api/alunos/:id     — Atualizar
 * DELETE /api/alunos/:id     — Desativar (soft delete)
 */

const express = require('express');
const router = express.Router();
const alunosController = require('../controllers/alunos.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação + role admin
router.use(authenticate, authorize('admin'));

router.get('/', alunosController.listar);
router.get('/:id', alunosController.buscarPorId);
router.post('/', alunosController.criar);
router.put('/:id', alunosController.atualizar);
router.delete('/:id', alunosController.desativar);

module.exports = router;
