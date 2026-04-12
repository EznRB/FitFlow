/**
 * ============================================
 * FitFlow Caraguá — Módulo de Autenticação
 * ============================================
 * Gerencia login, logout e estado de autenticação.
 * Comunica com o app.js via eventos customizados.
 */

const Auth = {
  /** Dados do usuário logado (preenchido após login) */
  user: null,

  /**
   * Tenta fazer login com email e senha.
   * @param {string} email 
   * @param {string} senha 
   * @returns {Promise<object>} Dados do usuário
   */
  async login(email, senha) {
    const response = await API.post('/auth/login', { email, password: senha });
    this.user = response.data.user;
    this.saveUserLocal(response.data.user);
    return response.data;
  },

  /**
   * Faz logout e limpa dados locais.
   */
  async logout() {
    try {
      await API.post('/auth/logout');
    } catch (e) {
      // Mesmo que o servidor falhe, limpa dados locais
      console.warn('Erro ao fazer logout no servidor:', e.message);
    }
    this.user = null;
    localStorage.removeItem('fitflow_user');
    window.dispatchEvent(new CustomEvent('auth:logout'));
  },

  /**
   * Verifica se o usuário está autenticado.
   * Tenta usar dados locais, depois valida com o servidor.
   * @returns {Promise<boolean>}
   */
  async checkAuth() {
    // 1. Verifica dados locais
    const savedUser = this.getLocalUser();
    if (!savedUser) return false;

    // 2. Valida com o servidor (GET /api/auth/me)
    try {
      const response = await API.get('/auth/me');
      this.user = response.data.user;
      this.saveUserLocal(response.data.user);
      return true;
    } catch (error) {
      // Token inválido ou expirado
      this.user = null;
      localStorage.removeItem('fitflow_user');
      return false;
    }
  },

  /**
   * Salva dados do usuário no localStorage (apenas para restaurar sessão).
   * ⚠️ O token JWT fica em cookie httpOnly — NÃO é armazenado aqui.
   */
  saveUserLocal(user) {
    localStorage.setItem('fitflow_user', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }));
  },

  /**
   * Recupera dados do usuário do localStorage.
   */
  getLocalUser() {
    try {
      const data = localStorage.getItem('fitflow_user');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  /**
   * Verifica se o usuário tem uma role específica.
   * @param {string} role - 'admin' ou 'aluno'
   */
  hasRole(role) {
    return this.user && this.user.role === role;
  },

  /**
   * Verifica se é admin.
   */
  isAdmin() {
    return this.hasRole('admin');
  },
};

// Escuta evento de 401 (token expirado)
window.addEventListener('auth:unauthorized', () => {
  Auth.logout();
});
