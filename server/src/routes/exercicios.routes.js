/**
 * ============================================
 * FitFlow Caraguá — Rotas de Exercícios
 * ============================================
 * CRUD do catálogo geral de exercícios da academia.
 * Somente admin pode gerenciar o catálogo.
 * 
 * GET    /api/exercicios         — Listar todos
 * GET    /api/exercicios/grupos  — Listar grupos musculares
 * GET    /api/exercicios/:id     — Buscar por ID
 * POST   /api/exercicios         — Criar exercício
 * PUT    /api/exercicios/:id     — Atualizar exercício
 * DELETE /api/exercicios/:id     — Desativar exercício (soft delete)
 */

const express = require('express');
const router = express.Router();
const exerciciosController = require('../controllers/exercicios.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Todas as rotas exigem autenticação + role admin
router.use(authenticate, authorize('admin'));

// Rota de grupos musculares (ANTES de /:id para evitar conflito)
router.get('/grupos', exerciciosController.listarGrupos);

router.get('/', exerciciosController.listar);
router.get('/:id', exerciciosController.buscarPorId);
router.post('/', exerciciosController.criar);
router.put('/:id', exerciciosController.atualizar);
router.delete('/:id', exerciciosController.desativar);

module.exports = router;
