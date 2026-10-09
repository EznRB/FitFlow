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
  logoutPending: null,
  expiredUserId: null,
  generation: 0,
  sessionCheckError: null,
  remoteLogoutPending: null,
  logoutRetryPending: null,
  logoutIntentKey: 'fitflow_logout_pending',
  getLogoutIntent() {
    const stored = typeof localStorage.getItem === 'function' ? localStorage.getItem(this.logoutIntentKey) : this.remoteLogoutPending;
    return stored || null;
  },
  showLogoutNotice(pending) {
    const message = pending ? 'Saída no servidor ainda não confirmada. Reconecte-se para encerrar o cookie desta sessão. O acesso automático permanece bloqueado neste navegador.' : 'Saída confirmada pelo servidor. Entre novamente para continuar.';
    if (typeof document !== 'undefined') {
      const node = document.getElementById('login-error');
      if (node) { node.textContent = message; node.style.display = 'flex'; }
    }
    if (pending && typeof Toast !== 'undefined') Toast.warning(message);
  },
  async finishPendingLogout() {
    if (this.logoutPending) await this.logoutPending;
    if (this.logoutRetryPending) return this.logoutRetryPending;
    const intent = this.getLogoutIntent();
    if (!intent) return;
    // Keep the persisted intent until the server has acknowledged clear-cookie.
    // This controls browser restoration; it does not revoke a JWT already copied.
    this.logoutRetryPending = (async () => {
      try { await API.post('/auth/logout'); }
      catch {
        this.showLogoutNotice(true);
        throw new Error('Reconecte-se para confirmar a saída anterior antes de entrar novamente.');
      }
      if (this.getLogoutIntent() === intent) {
        localStorage.removeItem(this.logoutIntentKey); this.remoteLogoutPending = null;
      }
      this.showLogoutNotice(false);
    })().finally(() => { this.logoutRetryPending = null; });
    return this.logoutRetryPending;
  },

  /**
   * Tenta fazer login com email e senha.
   * @param {string} email 
   * @param {string} senha 
   * @returns {Promise<object>} Dados do usuário
   */
  async login(email, senha) {
    // Aguarda a remoção do cookie anterior antes de emitir o cookie da nova conta.
    if (this.logoutPending) await this.logoutPending;
    await this.finishPendingLogout();
    const generation = ++this.generation;
    // Limpa qualquer rastro de sessão anterior antes de tentar novo login
    localStorage.removeItem('fitflow_user');
    this.user = null;
    
    const response = await API.post('/auth/login', { email, password: senha });
    if (generation !== this.generation) throw new Error('A tentativa de login foi interrompida. Entre novamente.');
    this.user = response.data.user;
    this.expiredUserId = null;
    this.saveUserLocal(response.data.user);
    return response.data;
  },

  /**
   * Faz logout e limpa dados locais.
   */
  logout({ reason = 'explicit' } = {}) {
    // O guard da fila pode ter vários chamadores; a saída inteira deve ocorrer uma vez.
    if (this.logoutPending) return this.logoutPending;
    if (this.logoutRetryPending) return this.logoutRetryPending;
    const intent = `${Date.now()}:${Math.random()}`;
    localStorage.setItem(this.logoutIntentKey, intent);
    this.remoteLogoutPending = intent;
    ++this.generation;
    const userId = this.user?.id ?? this.expiredUserId;
    this.user = null;
    this.expiredUserId = reason === 'expired' ? userId : null;
    localStorage.removeItem('fitflow_user');
    this.logoutPending = (async () => {
      let serverConfirmed = false;
      try {
        await API.post('/auth/logout');
        serverConfirmed = true;
        if (this.getLogoutIntent() === intent) {
          localStorage.removeItem(this.logoutIntentKey); this.remoteLogoutPending = null;
        }
      } catch (e) {
        // Mesmo que o servidor falhe, limpa dados locais.
        console.warn('Erro ao fazer logout no servidor:', e.message);
      }
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason, userId, serverConfirmed } }));
      if (!serverConfirmed) this.showLogoutNotice(true);
    })().finally(() => { this.logoutPending = null; });
    return this.logoutPending;
  },

  /**
   * Verifica se o usuário está autenticado.
   * Valida o cookie com o servidor e atualiza o cache de exibição.
   * @returns {Promise<boolean>}
   */
  async checkAuth() {
    const generation = ++this.generation;
    this.sessionCheckError = null;
    if (this.getLogoutIntent()) {
      this.user = null; localStorage.removeItem('fitflow_user');
      this.showLogoutNotice(true);
      // A limpeza mantém sua intenção persistida e continua em background.
      // Login ainda aguarda essa mesma operação antes de emitir outro cookie.
      this.finishPendingLogout().catch(() => {});
      return false;
    }
    // O cookie da sessão é a autoridade, inclusive quando não há cache local.
    // Só esta leitura tem timeout; abortar uma escrita não confirma seu resultado.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await API.get('/auth/me', { signal: controller.signal });
      if (generation !== this.generation) return false;
      if (controller.signal.aborted) throw new Error('Verificação de sessão interrompida.');
      this.user = response.data.user;
      this.saveUserLocal(response.data.user);
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      // Token inválido ou expirado
      this.user = null;
      localStorage.removeItem('fitflow_user');
      if (controller.signal.aborted || !error.status || [502, 503].includes(error.status)) {
        this.sessionCheckError = 'Não foi possível verificar sua sessão. Confira a conexão e tente entrar novamente.';
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Salva um cache de exibição no localStorage, sem autoridade de autenticação.
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
   * @param {string} role - 'admin', 'instructor' ou 'student'
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
window.addEventListener('auth:unauthorized', event => {
  const detail = event?.detail;
  if (detail && (detail.userId !== (Auth.user?.id ?? null) || detail.generation !== Auth.generation)) return;
  Auth.logout({ reason: 'expired' });
});
window.addEventListener('online', () => {
  if (Auth.getLogoutIntent()) Auth.finishPendingLogout().catch(() => {});
});
