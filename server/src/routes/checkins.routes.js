/**
 * ============================================================================
 * FitFlow Caraguá — Rotas de Check-ins (TASK 08)
 * ============================================================================
 * Endpoints de presença diária com controle de acesso por role.
 * 
 * POST   /api/checkins                 → Registrar check-in (aluno ou admin)
 * GET    /api/checkins                 → Listar check-ins (admin)
 * GET    /api/checkins/hoje            → Resumo do dia (admin)
 * GET    /api/checkins/frequencia      → Ranking de frequência (admin)
 * GET    /api/checkins/aluno/:alunoId  → Histórico de um aluno (admin)
 * PUT    /api/checkins/:id/cancelar    → Cancelar check-in (admin)
 * 
 * ⚠️ Não existe rota DELETE — regra de negócio.
 * ⚠️ Check-in é único por aluno/dia — constraint no banco + validação no service.
 */

const express = require('express');
const router = express.Router();
const checkinsController = require('../controllers/checkins.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação
router.use(authenticate);

// Registrar check-in (aluno faz self-checkin, admin registra para qualquer aluno)
router.post('/', checkinsController.registrar);

// Rotas exclusivas de admin
router.get('/', authorize('admin'), checkinsController.listar);
router.get('/hoje', authorize('admin'), checkinsController.resumoHoje);
router.get('/frequencia', authorize('admin'), checkinsController.frequencia);
router.get('/aluno/:alunoId', authorize('admin'), checkinsController.buscarPorAluno);

// Cancelamento administrativo (PUT, não DELETE — preserva histórico)
router.put('/:id/cancelar', authorize('admin'), checkinsController.cancelar);

module.exports = router;
