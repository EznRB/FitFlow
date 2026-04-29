/**
 * ============================================================================
 * FitFlow Caraguá — Controller de Autenticação (Task 03)
 * ============================================================================
 * Lida com entrada (req) e saída (res) das rotas de autenticação.
 * Aqui não temos "regras de negócio pesadas", apenas delegamos para
 * o AuthService e empacotamos o resultado de forma segura (Cookies).
 */

const { sendSuccess } = require('../utils/helpers');
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');
const env = require('../config/env');

const authController = {
  /**
   * POST /api/auth/register
   * Cria um novo usuário no banco de dados.
   */
  async register(req, res, next) {
    try {
      const { name, email, password, role } = req.body;

      // Validação básica de entrada
      if (!name || !email || !password) {
        throw new AppError('Nome, e-mail e senha são obrigatórios.', 400);
      }

      // Repassa para a camada de serviço
      const user = await authService.register({ name, email, password, role });

      sendSuccess(res, 201, 'Usuário registrado com sucesso', { user });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/auth/login
   * Valida credenciais e injeta o JWT em um Cookie HttpOnly.
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('E-mail e senha são obrigatórios.', 400);
      }

      // authService.login lança erro se credenciais forem inválidas
      const { user, token } = await authService.login(email, password);

      // Configuração do Cookie Seguro (HttpOnly)
      // HttpOnly = Impede que JavaScript no navegador (Ex: ataques XSS) roube o token
      const cookieOptions = {
        httpOnly: true,
        secure: env.nodeEnv === 'production', // Em prod, exige HTTPS
        sameSite: 'lax', // Proteção contra CSRF
        path: '/', // Garante que o cookie seja acessível em todas as rotas
        maxAge: 24 * 60 * 60 * 1000, // 1 dia em milissegundos
      };

      // Injeta o cookie na resposta do servidor
      res.cookie('access_token', token, cookieOptions);

      // Nunca enviamos a senha ou o token exposto no JSON (como boa prática pra esse fluxo)
      sendSuccess(res, 200, 'Login realizado com sucesso', { user });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/auth/logout
   * Remove o cookie do navegador do usuário.
   */
  async logout(req, res, next) {
    try {
      // Limpamos o cookie definindo um nome igual e tempo de vida expirado
      res.clearCookie('access_token', {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite: 'lax',
        path: '/',
      });

      sendSuccess(res, 200, 'Logout realizado com sucesso', null);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/auth/me
   * Retorna os dados do usuário atualmente logado.
   * Só funciona porque a rota é protegida pelo middleware `authenticate`.
   */
  async getMe(req, res, next) {
    try {
      // req.user foi injetado pelo middleware de autenticação (JWT)
      if (!req.user) {
        throw new AppError('Não autorizado. Faça login novamente.', 401);
      }

      sendSuccess(res, 200, 'Dados do usuário', { user: req.user });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/auth/refresh
   * Placeholder para lógica de refresh token futura.
   */
  async refreshToken(req, res, next) {
    try {
      sendSuccess(res, 200, 'Funcionalidade não implementada nesta fase.', null);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;
