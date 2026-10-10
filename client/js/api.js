/**
 * ============================================
 * FitFlow Caraguá — API Client
 * ============================================
 * Abstração de chamadas HTTP para a API.
 * Centraliza headers, tratamento de erros e base URL.
 */

const API = {
  baseURL: '/api',

  /**
   * Realiza uma requisição HTTP para a API.
   * @param {string} endpoint - Rota da API (ex: '/auth/login')
   * @param {object} options - Opções do fetch (method, body, etc)
   * @returns {Promise<object>} Resposta parseada
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    // Uma resposta antiga não pode encerrar uma sessão que entrou depois.
    const requestIdentity = typeof Auth === 'undefined' ? null : {
      userId: Auth.user?.id ?? null, generation: Auth.generation,
      sessionEpoch: typeof Auth.getSessionEpoch === 'function' ? Auth.getSessionEpoch() : null,
    };

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Envia cookies (JWT httpOnly)
      ...options,
    };

    // Se o body for objeto, converte para JSON
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      // O cookie pode mudar em outra aba antes de seu storage event chegar aqui.
      // Não enviar uma nova operação usando uma identidade já desatualizada.
      if (requestIdentity && requestIdentity.userId !== null &&
          typeof Auth.getSessionEpoch === 'function' && Auth.sessionEpoch !== Auth.getSessionEpoch()) {
        const obsolete = new Error('A sessão mudou em outra aba. Entre novamente para continuar.');
        obsolete.status = 409; obsolete.obsolete = true;
        throw obsolete;
      }
      if (config.signal?.aborted) throw new Error('A solicitação foi cancelada.');
      const response = await fetch(url, config);
      if (config.signal?.aborted) throw new Error('A solicitação foi cancelada.');
      // Gateways podem devolver HTML. O status HTTP permanece a fonte do erro.
      const text = await response.text();
      if (config.signal?.aborted) throw new Error('A solicitação foi cancelada.');
      // Leituras de uma sessão anterior não podem reabrir um modal privado.
      // Escritas conservam a resposta real: podem já ter sido confirmadas no banco.
      if ((config.method || 'GET') === 'GET' && requestIdentity &&
          (requestIdentity.userId !== (Auth.user?.id ?? null) || requestIdentity.generation !== Auth.generation ||
           requestIdentity.sessionEpoch !== (typeof Auth.getSessionEpoch === 'function' ? Auth.getSessionEpoch() : null))) {
        const obsolete = new Error('A sessão mudou. Esta consulta foi descartada; atualize a tela para continuar.');
        obsolete.status = 409; obsolete.obsolete = true;
        throw obsolete;
      }
      let data = null;
      if (text) {
        try { data = JSON.parse(text); } catch { /* Mensagem segura abaixo. */ }
      }

      if (!response.ok) {
        // Um 401 sinaliza perda de autenticação ao módulo Auth.
        if (response.status === 401) {
          // Dispara evento para o auth.js tratar
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: requestIdentity }));
        }
        
        const error = new Error(data?.message || `O servidor não conseguiu atender a solicitação (HTTP ${response.status}). Tente novamente.`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      // 204 não tem corpo; JSON malformado em sucesso é falha de protocolo.
      if (text && data === null) {
        const error = new Error('O servidor retornou uma resposta inválida. Tente novamente.');
        error.status = 502;
        throw error;
      }

      return data;
    } catch (error) {
      // Erro de rede (servidor offline)
      if (!error.status) {
        error.message = 'Sem conexão com o servidor. Verifique sua internet.';
        error.status = 0;
      }
      throw error;
    }
  },

  // --- Métodos HTTP de conveniência ---

  get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', signal: options.signal });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};
