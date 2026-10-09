(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.FitFlowPWA = api; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => api.init()); else api.init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function createLogoutGuard({ read, flush = async () => {}, choose, isCurrent = () => true, onError = () => {} }) {
    return async function beforeLogout(userId) {
      if (!Number.isSafeInteger(userId) || userId < 1) return true;
      try {
        const state = await read(userId);
        if (!isCurrent(userId)) return false;
        if (state && (state.userId !== userId || !Array.isArray(state.operations))) throw new Error('Não foi possível conferir a fila desta conta.');
        if (!state?.operations.length) return true;
        const choice = await choose({ pending: state.operations.length, pendingSets: state.operations.filter(op => op.type === 'set').length });
        if (!isCurrent(userId)) return false;
        if (choice === 'discard') return true;
        if (choice !== 'sync') return false;
        await flush(userId);
        if (!isCurrent(userId)) return false;
        const after = await read(userId);
        if (!after || after.userId !== userId || after.operations.length) {
          onError('Ainda há envios pendentes. Volte à sessão para revisar a sincronização ou escolha sair e apagar os envios.'); return false;
        }
        return true;
      } catch (error) { onError(error.message || 'Não foi possível conferir a fila. Tente novamente antes de sair.'); return false; }
    };
  }
  const api = { createLogoutGuard, initialized: false, deferredPrompt: null, registration: null, statusNode: null, logoutRunning: null,
    notice(message) { if (api.statusNode) api.statusNode.textContent = message; },
    dialog(title, paragraphs, actions) {
      return new Promise(resolve => {
        const dialog = document.createElement('dialog'); dialog.className = 'pwa-dialog';
        const heading = document.createElement('h2'); heading.id = 'pwa-dialog-title'; heading.textContent = title;
        dialog.setAttribute('aria-labelledby', heading.id); dialog.append(heading);
        paragraphs.forEach(text => { const p = document.createElement('p'); p.textContent = text; dialog.append(p); });
        const buttons = document.createElement('div'); buttons.className = 'pwa-dialog-actions';
        let settled = false;
        function finish(value) { if (settled) return; settled = true; dialog.close(); dialog.remove(); resolve(value); }
        actions.forEach(action => {
          const button = document.createElement('button'); button.type = 'button'; button.className = `pwa-button ${action.className || ''}`; button.textContent = action.label;
          button.onclick = () => finish(action.value); buttons.append(button);
        });
        dialog.append(buttons); document.body.append(dialog);
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish('stay'); });
        dialog.showModal(); buttons.querySelector('button')?.focus();
      });
    },
    async beforeLogout(userId) {
      if (api.logoutRunning) return api.logoutRunning;
      api.logoutRunning = createLogoutGuard({
        read: id => {
          if (typeof FitFlowTrainingStore === 'undefined' || !globalThis.indexedDB) return Promise.resolve(null);
          return FitFlowTrainingStore.createIndexedDbStorage().read(id);
        },
        isCurrent: id => typeof Auth !== 'undefined' && Auth.user?.id === id,
        flush: async () => {
          if (typeof SessoesView === 'undefined') throw new Error('Abra Sessões e séries para sincronizar seus registros antes de sair.');
          const store = await SessoesView.ensureStore(); await store.flush();
        },
        choose: ({ pending, pendingSets }) => api.dialog('Há registros de treino pendentes', [
          `${pendingSets} série(s) e ${pending} envio(s) ainda estão salvos somente neste dispositivo.`,
          'Sair apaga a fila local desta conta. Registros já confirmados no servidor permanecem no seu histórico.',
        ], [ { label: 'Continuar no aplicativo', value: 'stay' }, { label: 'Sincronizar e sair', value: 'sync', className: 'pwa-button-primary' },
          { label: `Sair e apagar ${pending} envio(s)`, value: 'discard', className: 'pwa-button-danger' } ]),
        onError: message => { api.notice(message); if (typeof Toast !== 'undefined') Toast.error(message); },
      })(userId).finally(() => { api.logoutRunning = null; });
      return api.logoutRunning;
    },
    async install() {
      if (api.deferredPrompt) {
        const prompt = api.deferredPrompt; api.deferredPrompt = null;
        await prompt.prompt(); await prompt.userChoice; api.updateInstall();
      } else {
        await api.dialog('Adicionar FitFlow à tela inicial', [
          'No Android, abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.',
          'No iPhone ou iPad, abra Compartilhar e escolha Adicionar à Tela de Início. A opção depende do navegador e da versão do sistema.',
          'A instalação precisa de uma conexão segura (HTTPS).',
        ], [ { label: 'Entendi', value: 'stay', className: 'pwa-button-primary' } ]);
      }
    },
    updateInstall() {
      const button = document.querySelector('[data-pwa-install]'); if (!button) return;
      button.hidden = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
      button.textContent = api.deferredPrompt ? 'Instalar FitFlow' : 'Adicionar à tela inicial';
    },
    async init() {
      if (api.initialized) return; api.initialized = true;
      const panel = document.createElement('aside'); panel.className = 'pwa-controls'; panel.setAttribute('aria-label', 'Aplicativo e conexão');
      const button = document.createElement('button'); button.className = 'pwa-button'; button.type = 'button'; button.dataset.pwaInstall = ''; button.onclick = () => api.install().catch(error => api.notice(error.message));
      api.statusNode = document.createElement('p'); api.statusNode.className = 'pwa-status'; api.statusNode.setAttribute('role', 'status'); api.statusNode.setAttribute('aria-live', 'polite');
      panel.append(button, api.statusNode);
      const host = document.querySelector('.sidebar-footer') || document.querySelector('.pwa-offline-card'); if (host) host.append(panel);
      api.updateInstall();
      window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); api.deferredPrompt = event; api.updateInstall(); });
      window.addEventListener('appinstalled', () => { api.deferredPrompt = null; api.updateInstall(); api.notice('FitFlow instalado.'); });
      window.addEventListener('offline', () => api.notice('Sem conexão. Séries salvas no dispositivo aguardam sincronização.'));
      window.addEventListener('online', () => api.notice('Conexão disponível. A sessão será validada pelo servidor.'));
      if (!navigator.onLine) api.notice('Sem conexão. Reconecte-se para validar sua sessão.');
      if (!window.isSecureContext || !('serviceWorker' in navigator)) { api.notice('A instalação offline requer HTTPS e um navegador compatível.'); return; }
      try {
        api.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        const reportWaiting = () => { if (api.registration.waiting) api.notice('Atualização disponível. Feche e reabra o aplicativo depois de salvar suas séries.'); };
        reportWaiting();
        api.registration.addEventListener('updatefound', () => {
          const worker = api.registration.installing;
          worker?.addEventListener('statechange', () => { if (worker.state === 'installed') reportWaiting(); });
        });
      } catch { api.notice('Não foi possível preparar a abertura offline. Seus registros de treino continuam na fila local.'); }
    },
  };
  return api;
});
