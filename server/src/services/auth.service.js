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
const { validateAccount, validatePassword } = require('../utils/accountValidation');
const { credentialVersion } = require('../utils/credentialVersion');

class AuthService {
  constructor({ db = prisma } = {}) { this.db = db; }
  /**
   * Registra um novo usuário no sistema.
   * Criptografa a senha antes de salvar no banco de dados.
   * 
   * @param {Object} data - { name, email, password, role }
   * @returns {Object} Dados do usuário criado (sem a senha)
   */
  async register(data, actor = null) {
    const { name, email, password } = validateAccount(data);
    const role = data.role === undefined ? 'student' : data.role;
    if (!['admin', 'instructor', 'student'].includes(role)) throw new AppError('Perfil de usuário inválido.', 400);
    if (role !== 'student' && actor?.role !== 'admin') throw new AppError('Somente administrador pode criar perfis privilegiados.', 403);

    // 2. Verifica se o e-mail já existe no banco
    const userExists = await this.db.user.findUnique({ where: { email } });
    if (userExists) {
      throw new AppError('Este e-mail já está em uso.', 400); // Bad Request
    }

    // 2. Hash da Senha (Segurança):
    // Nunca salvamos senhas em texto puro. O bcrypt cria um "hash"
    // irreversível (salt de 10 rounds).
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Salva no banco de dados via Prisma
    const user = await this.db.user.create({
      data: {
        name,
        email,
        passwordHash,
        // Se a role não for enviada, o default do schema (student) assume.
        role,
      },
    });

    // 4. Retorna os dados, removendo o hash da senha por segurança
    const { passwordHash: _, credentialVersion: __, ...userWithoutPassword } = user;
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
    if (typeof email !== 'string' || email.length > 150 || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) {
      throw new AppError('Credenciais inválidas.', 401);
    }
    // 1. Busca o usuário pelo e-mail
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
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
      name: user.name, // O DB usa 'name'
      email: user.email,
      role: user.role,
      credentialVersion: credentialVersion(user.credentialVersion, { stored: true }),
    };

    const token = jwt.sign(payload, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn || '1d', // Expira por default em 1 dia
    });

    // 4. Retorna os dados, removendo a senha
    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      user: {
        id: userWithoutPassword.id,
        name: userWithoutPassword.name,
        email: userWithoutPassword.email,
        role: userWithoutPassword.role,
      },
      token,
    };
  }

  async changePassword(actorId, data, expectedVersion) {
    const fields = ['expectedActorId', 'currentPassword', 'newPassword'];
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !fields.includes(key)) ||
        !Number.isSafeInteger(data.expectedActorId) || data.expectedActorId < 1 || data.expectedActorId > 2147483647) {
      throw new AppError('Dados de alteração de senha inválidos.', 400);
    }
    if (!Number.isSafeInteger(actorId) || actorId < 1 || actorId > 2147483647 || data.expectedActorId !== actorId) {
      throw new AppError('A sessão mudou. Confira a conta antes de alterar a senha.', 403);
    }
    if (typeof data.currentPassword !== 'string' || !data.currentPassword || Buffer.byteLength(data.currentPassword, 'utf8') > 72) {
      throw new AppError('Informe sua senha atual válida.', 400);
    }
    validatePassword(data.newPassword);
    let user;
    try { user = await this.db.user.findUnique({ where: { id: actorId } }); }
    catch { throw new AppError('Serviço de autenticação temporariamente indisponível.', 503); }
    if (!user || !user.active) throw new AppError('Sessão inválida. Entre novamente.', 401);
    const version = credentialVersion(user.credentialVersion, { stored: true });
    if (!Number.isInteger(expectedVersion) || expectedVersion !== version || version === 2147483647) {
      throw new AppError('A credencial mudou. Entre novamente antes de alterar a senha.', 409);
    }
    if (!await bcrypt.compare(data.currentPassword, user.passwordHash)) throw new AppError('A senha atual não confere.', 400);
    if (await bcrypt.compare(data.newPassword, user.passwordHash)) throw new AppError('Escolha uma senha diferente da atual.', 400);
    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    let updated;
    try { updated = await this.db.user.updateMany({ where: { id: actorId, active: true, passwordHash: user.passwordHash, credentialVersion: version },
      data: { passwordHash, credentialVersion: { increment: 1 } } }); }
    catch { throw new AppError('Não foi possível confirmar a alteração da credencial. Entre novamente para conferir.', 503); }
    if (updated.count !== 1) throw new AppError('A credencial mudou durante o envio. Entre novamente.', 409);
    return { changed: true, requiresLogin: true, userId: actorId };
  }
}

module.exports = new AuthService();
module.exports.createAuthService = options => new AuthService(options);
