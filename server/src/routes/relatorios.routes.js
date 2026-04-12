/**
 * ============================================
 * FitFlow Caraguá — Rotas de Relatórios
 * ============================================
 * GET /api/relatorios/dashboard       — KPIs do dashboard
 * GET /api/relatorios/financeiro      — Relatório financeiro
 * GET /api/relatorios/frequencia      — Relatório de frequência
 */

const express = require('express');
const router = express.Router();
const relatoriosController = require('../controllers/relatorios.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação + role admin
router.use(authenticate, authorize('admin'));

router.get('/dashboard', relatoriosController.dashboard);
router.get('/financeiro', relatoriosController.financeiro);
router.get('/frequencia', relatoriosController.frequencia);

module.exports = router;
