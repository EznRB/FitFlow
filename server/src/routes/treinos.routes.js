/**
 * ============================================
 * FitFlow Caraguá — Rotas de Treinos
 * ============================================
 * 
 * --- Admin (gerenciar treinos) ---
 * GET    /api/treinos              — Listar todos os treinos
 * GET    /api/treinos/:id          — Buscar treino por ID
 * POST   /api/treinos              — Criar treino para aluno
 * PUT    /api/treinos/:id          — Atualizar treino
 * DELETE /api/treinos/:id          — Desativar treino (soft delete)
 * 
 * --- Aluno (visualizar e registrar carga) ---
 * GET    /api/treinos/meus         — Meus treinos (aluno logado)
 * POST   /api/treinos/carga        — Registrar carga executada
 * GET    /api/treinos/historico     — Histórico de cargas
 */

const express = require('express');
const router = express.Router();
const treinosController = require('../controllers/treinos.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação
router.use(authenticate);

// --- Rotas do Aluno (devem vir ANTES das rotas com :id) ---
router.get('/meus', authorize('aluno'), treinosController.meusTreinos);
router.post('/carga', authorize('aluno'), treinosController.registrarCarga);
router.get('/historico', authorize('aluno'), treinosController.historicoCarga);

// --- Rotas do Admin ---
router.get('/', authorize('admin'), treinosController.listar);
router.get('/:id', authorize('admin'), treinosController.buscarPorId);
router.post('/', authorize('admin'), treinosController.criar);
router.put('/:id', authorize('admin'), treinosController.atualizar);
router.delete('/:id', authorize('admin'), treinosController.desativar);

module.exports = router;
