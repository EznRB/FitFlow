/**
 * ============================================
 * FitFlow Caraguá — Rotas de Treinos
 * ============================================
 * 
 * --- Admin e instrutor (gestão limitada à autoria para instrutor) ---
 * GET    /api/treinos              — Listar todos os treinos
 * GET    /api/treinos/:id          — Buscar treino por ID
 * POST   /api/treinos              — Criar treino para aluno
 * PUT    /api/treinos/:id          — Atualizar treino
 * DELETE /api/treinos/:id          — Desativar treino (soft delete)
 * GET    /api/treinos/alunos       — Matrículas ativas, somente ID/nome
 * GET    /api/treinos/catalogo     — Catálogo somente para leitura/seleção
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
router.get('/meus', authorize('student'), treinosController.meusTreinos);
router.post('/carga', authorize('student'), treinosController.registrarCarga);
router.get('/historico', authorize('student'), treinosController.historicoCarga);

// Management reads are narrow; instructor ownership is checked in the service.
router.get('/alunos', authorize('admin', 'instructor'), treinosController.alunosElegiveis);
router.get('/catalogo', authorize('admin', 'instructor'), treinosController.catalogo);
router.get('/', authorize('admin', 'instructor'), treinosController.listar);
router.get('/:id', authorize('admin', 'instructor'), treinosController.buscarPorId);
router.post('/', authorize('admin', 'instructor'), treinosController.criar);
router.put('/:id', authorize('admin', 'instructor'), treinosController.atualizar);
router.delete('/:id', authorize('admin', 'instructor'), treinosController.desativar);

module.exports = router;
