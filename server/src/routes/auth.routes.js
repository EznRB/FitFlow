/**
 * ============================================
 * FitFlow Caraguá — Rotas de Autenticação
 * ============================================
 * POST /api/auth/login    — Login
 * POST /api/auth/register — Registro (admin only na produção)
 * POST /api/auth/logout   — Logout
 * POST /api/auth/refresh  — Renovar token
 * GET  /api/auth/me       — Dados do usuário logado
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Rotas públicas
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);

// Rotas protegidas
router.get('/me', authenticate, authController.getMe);

module.exports = router;
