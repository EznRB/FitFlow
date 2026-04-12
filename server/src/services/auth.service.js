/**
 * ============================================================================
 * FitFlow Caraguá — Service de Autenticação (Task 03)
 * ============================================================================
 * Camada de "Lógica de Negócio". O Controller apenas recebe a requisição
 * e repassa para cá. Aqui fazemos as consultas ao banco (Prisma),
 * geramos hashes de senha (bcrypt) e tokens (jwt).
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');
const env = require('../config/env');
const AppError = require('../utils/AppError');

class AuthService {
  /**
   * Registra um novo usuário no sistema.
   * Criptografa a senha antes de salvar no banco de dados.
   * 
   * @param {Object} data - { name, email, password, role }
   * @returns {Object} Dados do usuário criado (sem a senha)
   */
  async register(data) {
    const { name, email, password, role } = data;

    // 1. Validação de senha (Segurança e Requisito):
    if (password.length < 6) {
      throw new AppError('A senha deve ter no mínimo 6 caracteres.', 400);
    }

    // 2. Verifica se o e-mail já existe no banco
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      throw new AppError('Este e-mail já está em uso.', 400); // Bad Request
    }

    // 2. Hash da Senha (Segurança):
    // Nunca salvamos senhas em texto puro. O bcrypt cria um "hash"
    // irreversível (salt de 10 rounds).
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Salva no banco de dados via Prisma
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        // Se a role não for enviada, o default do schema (student) assume.
        role: role || 'student', 
      },
    });

    // 4. Retorna os dados, removendo o hash da senha por segurança
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Autentica um usuário e gera um Token JWT.
   * 
   * @param {string} email 
   * @param {string} password 
   * @returns {Object} { user, token }
   */
  async login(email, password) {
    // 1. Busca o usuário pelo e-mail
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Usamos mensagens genéricas para não revelar se o erro foi no e-mail ou na senha.
      throw new AppError('Credenciais inválidas.', 401); // Unauthorized
    }

    if (!user.active) {
      throw new AppError('Conta desativada ou bloqueada.', 403); // Forbidden
    }

    // 2. Compara a senha fornecida com o hash do banco
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Credenciais inválidas.', 401);
    }

    // 3. Gerar JWT (JSON Web Token):
    // O payload leva os dados essenciais. É assinado com nosso "secret".
    // Esse token funciona como o "crachá" do usuário na aplicação.
    const payload = {
      id: user.id,
      nome: user.name, // O DB usa 'name', mas o frontend e middleware esperam 'nome'
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn || '1d', // Expira por default em 1 dia
    });

    // 4. Retorna os dados, removendo a senha
    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      user: {
        id: userWithoutPassword.id,
        nome: userWithoutPassword.name,
        email: userWithoutPassword.email,
        role: userWithoutPassword.role,
      },
      token,
    };
  }
}

module.exports = new AuthService();
