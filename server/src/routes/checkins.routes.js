/**
 * ============================================
 * FitFlow Caraguá — Rotas de Check-ins
 * ============================================
 * GET    /api/checkins              — Listar check-ins (admin)
 * GET    /api/checkins/aluno/:id    — Check-ins de um aluno
 * POST   /api/checkins              — Registrar check-in do dia
 * 
 * ⚠️ Não existe rota DELETE — regra de negócio.
 * ⚠️ Check-in é único por aluno/dia — constraint no banco.
 */

const express = require('express');
const router = express.Router();
const checkinsController = require('../controllers/checkins.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação
router.use(authenticate);

// Registrar check-in (aluno ou admin)
router.post('/', checkinsController.registrar);

// Rotas admin
router.get('/', authorize('admin'), checkinsController.listar);
router.get('/aluno/:alunoId', authorize('admin'), checkinsController.buscarPorAluno);

module.exports = router;
