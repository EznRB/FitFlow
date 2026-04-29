/**
 * ============================================================================
 * FitFlow Caraguá — Rotas da Área do Aluno (TASK 10)
 * ============================================================================
 * Endpoints exclusivos para alunos autenticados.
 * Nenhuma rota administrativa é exposta aqui.
 *
 * GET /api/aluno/painel           — Dashboard consolidado
 * GET /api/aluno/mensalidade      — Situação financeira
 * GET /api/aluno/checkins         — Histórico de check-ins
 * GET /api/aluno/historico-carga  — Histórico de cargas
 *
 * Segurança:
 * ⚠️ Todas as rotas exigem autenticação (JWT) + role 'student'.
 * ⚠️ Um aluno NÃO consegue acessar dados de outro aluno.
 */

const express = require('express');
const router = express.Router();
const alunoPainelController = require('../controllers/aluno-painel.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Middleware global: autenticação + autorização por role
router.use(authenticate, authorize('student'));

// Endpoints da área do aluno
router.get('/painel', alunoPainelController.painel);
router.get('/mensalidade', alunoPainelController.mensalidade);
router.get('/checkins', alunoPainelController.checkins);
router.get('/historico-carga', alunoPainelController.historicoCarga);

module.exports = router;
