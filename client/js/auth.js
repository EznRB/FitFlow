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
  cookieLockKey: 'fitflow_auth_cookie_mutation_v1',
  sessionEpochKey: 'fitflow_auth_session_epoch_v1',
  sessionEpoch: null,
  memorySessionEpoch: null,
  getSessionEpoch() {
    return typeof localStorage.getItem === 'function' ? localStorage.getItem(this.sessionEpochKey) || null : this.memorySessionEpoch;
  },
  advanceSessionEpoch() {
    const epoch = `${Date.now()}:${Math.random()}`;
    localStorage.setItem(this.sessionEpochKey, epoch);
    this.memorySessionEpoch = epoch; this.sessionEpoch = epoch;
    return epoch;
  },
  withCookieLock(operation, options = {}) {
    if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') {
      throw new Error('Este navegador não permite coordenar sessões entre abas. Use uma versão atual do Chrome, Edge, Firefox ou Safari para entrar.');
    }
    return navigator.locks.request(this.cookieLockKey, { mode: options.mode || 'exclusive', ...(options.signal ? { signal: options.signal } : {}) }, operation);
  },
  logoutIntentEpoch(intent, fallback = this.getSessionEpoch()) {
    try {
      const value = JSON.parse(intent);
      if (value && typeof value.nonce === 'string' && (typeof value.epoch === 'string' || value.epoch === null)) return value.epoch;
    } catch { /* Intenções da versão anterior continuam recuperáveis. */ }
    return fallback;
  },
  clearLogoutIntent(intent) {
    if (this.getLogoutIntent() === intent) {
      localStorage.removeItem(this.logoutIntentKey); this.remoteLogoutPending = null;
    }
  },
  invalidateLocalSession() {
    if (!this.user) return;
    const userId = this.user.id;
    ++this.generation; this.user = null; this.expiredUserId = userId;
    // A outra aba controla o cookie. Não enviamos um logout da sessão antiga.
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'expired', userId, serverConfirmed: false, sessionChanged: true } }));
    if (typeof document !== 'undefined') {
      const node = document.getElementById('login-error');
      if (node) { node.textContent = 'A sessão foi alterada em outra aba. Entre novamente para continuar nesta tela.'; node.style.display = 'flex'; }
    }
  },
  async notifyLogout(detail) {
    const cleanups = [];
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: {
      ...detail, waitUntil: pending => cleanups.push(Promise.resolve(pending)),
    } }));
    // Listeners register synchronously; keep the cookie lock until their local
    // cleanup settles, so a login in another tab cannot create a queue too early.
    const outcomes = await Promise.allSettled(cleanups);
    if (outcomes.some(outcome => outcome.status === 'rejected')) console.warn('Não foi possível concluir a limpeza dos registros locais.');
  },
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
  async finishLogoutIntentLocked(intent, expectedEpoch) {
    // A confirmação e um novo login podem ter ocorrido enquanto esta aba aguardava.
    if (this.getLogoutIntent() !== intent) return;
    if (this.getSessionEpoch() !== expectedEpoch) {
      this.clearLogoutIntent(intent);
      return;
    }
    try { await API.post('/auth/logout'); }
    catch {
      if (this.getLogoutIntent() === intent) this.showLogoutNotice(true);
      throw new Error('Reconecte-se para confirmar a saída anterior antes de entrar novamente.');
    }
    this.advanceSessionEpoch();
    this.clearLogoutIntent(intent);
    this.showLogoutNotice(false);
  },
  async finishPendingLogout() {
    if (this.logoutPending) await this.logoutPending;
    if (this.logoutRetryPending) return this.logoutRetryPending;
    const intent = this.getLogoutIntent();
    if (!intent) return;
    const expectedEpoch = this.logoutIntentEpoch(intent);
    // Keep the persisted intent until the server has acknowledged clear-cookie.
    // This controls browser restoration; it does not revoke a JWT already copied.
    this.logoutRetryPending = Promise.resolve().then(() => this.withCookieLock(() => this.finishLogoutIntentLocked(intent, expectedEpoch)))
      .finally(() => { this.logoutRetryPending = null; });
    return this.logoutRetryPending;
  },

  /**
   * Tenta fazer login com email e senha.
   * @param {string} email 
   * @param {string} senha 
   * @returns {Promise<object>} Dados do usuário
   */
  async login(email, senha) {
    const generation = ++this.generation;
    localStorage.removeItem('fitflow_user'); this.user = null;
    // Aguarda a remoção do cookie anterior antes de emitir o cookie da nova conta.
    if (this.logoutPending) await this.logoutPending;
    if (this.logoutRetryPending) await this.logoutRetryPending;
    return this.withCookieLock(async () => {
      if (generation !== this.generation) throw new Error('A tentativa de login foi interrompida. Entre novamente.');
      const intent = this.getLogoutIntent();
      if (intent) await this.finishLogoutIntentLocked(intent, this.logoutIntentEpoch(intent));
      if (generation !== this.generation) throw new Error('A tentativa de login foi interrompida. Entre novamente.');
      // Marca a mutação antes do HTTP: logout solicitado durante login pertence
      // a esta versão e precisa aguardar o cookie da resposta, mesmo sem UI restaurada.
      this.advanceSessionEpoch();
      const response = await API.post('/auth/login', { email, password: senha });
      if (generation !== this.generation) throw new Error('A tentativa de login foi interrompida. Entre novamente.');
      this.user = response.data.user;
      this.expiredUserId = null;
      this.saveUserLocal(response.data.user);
      return response.data;
    });
  },

  /**
   * Faz logout e limpa dados locais.
   */
  logout({ reason = 'explicit' } = {}) {
    // O guard da fila pode ter vários chamadores; a saída inteira deve ocorrer uma vez.
    if (this.logoutPending) return this.logoutPending;
    if (this.logoutRetryPending) return this.logoutRetryPending;
    const expectedEpoch = this.sessionEpoch;
    const intent = JSON.stringify({ nonce: `${Date.now()}:${Math.random()}`, epoch: expectedEpoch });
    localStorage.setItem(this.logoutIntentKey, intent);
    this.remoteLogoutPending = intent;
    ++this.generation;
    const userId = this.user?.id ?? this.expiredUserId;
    this.user = null;
    this.expiredUserId = reason === 'expired' ? userId : null;
    localStorage.removeItem('fitflow_user');
    this.logoutPending = Promise.resolve().then(() => this.withCookieLock(async () => {
      const sessionChanged = this.getSessionEpoch() !== expectedEpoch;
      let serverConfirmed = false;
      try {
        await this.finishLogoutIntentLocked(intent, expectedEpoch);
        serverConfirmed = true;
      } catch (e) {
        // Mesmo que o servidor falhe, limpa dados locais.
        console.warn('Erro ao fazer logout no servidor:', e.message);
      }
      await this.notifyLogout({ reason: sessionChanged ? 'expired' : reason, userId, serverConfirmed, sessionChanged });
      if (!serverConfirmed) this.showLogoutNotice(true);
    })).catch(async error => {
      console.warn('Erro ao coordenar saída no servidor:', error.message);
      const sessionChanged = this.getSessionEpoch() !== expectedEpoch;
      await this.notifyLogout({ reason: sessionChanged ? 'expired' : reason, userId, serverConfirmed: false, sessionChanged });
      this.showLogoutNotice(true);
    }).finally(() => { this.logoutPending = null; });
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
      const readSession = async () => {
        this.sessionEpoch = this.getSessionEpoch();
        const epoch = this.sessionEpoch;
        const response = await API.get('/auth/me', { signal: controller.signal });
        if (epoch !== this.getSessionEpoch() || this.getLogoutIntent()) return null;
        return response;
      };
      // A espera pelo lock também é abortável em 15s; startup nunca fica preso
      // numa mutação sem resposta. Navegadores sem Locks ainda podem ler a sessão.
      const response = typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function'
        ? await this.withCookieLock(readSession, { mode: 'shared', signal: controller.signal }) : await readSession();
      if (generation !== this.generation) return false;
      if (controller.signal.aborted) throw new Error('Verificação de sessão interrompida.');
      if (!response) { this.user = null; return false; }
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
  if (Auth.sessionEpoch !== Auth.getSessionEpoch()) { Auth.invalidateLocalSession(); return; }
  // 401 de login errado ou de startup sem sessão não agenda outra mutação cookie.
  if (detail && detail.userId === null) return;
  Auth.logout({ reason: 'expired' });
});
window.addEventListener('storage', event => {
  if (event.key === Auth.sessionEpochKey && Auth.sessionEpoch !== Auth.getSessionEpoch()) Auth.invalidateLocalSession();
  if (event.key === Auth.logoutIntentKey && event.newValue && Auth.logoutIntentEpoch(event.newValue) === Auth.getSessionEpoch()) Auth.invalidateLocalSession();
});
window.addEventListener('online', () => {
  if (Auth.getLogoutIntent()) Auth.finishPendingLogout().catch(() => {});
});
