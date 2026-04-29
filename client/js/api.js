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
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Se token expirou, tenta refresh ou redireciona
        if (response.status === 401 || response.status === 403) {
          // Dispara evento para o auth.js tratar
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        
        const error = new Error(data.message || 'Erro na requisição');
        error.status = response.status;
        error.data = data;
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

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
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
