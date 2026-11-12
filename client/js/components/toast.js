/**
 * ============================================
 * FitFlow Caraguá — Toast Notifications
 * ============================================
 * Sistema de notificações efêmeras (toast).
 * 
 * Uso:
 *   Toast.success('Aluno cadastrado com sucesso!');
 *   Toast.error('Erro ao salvar dados.');
 *   Toast.warning('Mensalidade vencida!');
 *   Toast.info('Novo treino disponível.');
 */

const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
  },

  /**
   * Exibe um toast.
   * @param {string} message - Mensagem do toast
   * @param {'success'|'error'|'warning'|'info'} type - Tipo visual
   * @param {number} duration - Duração em ms (padrão: 4000)
   */
  show(message, type = 'info', duration = 4000) {
    if (!this.container) this.init();

    const icons = {
      success: 'check-circle',
      error: 'x-circle',
      warning: 'alert-triangle',
      info: 'info',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
      <i data-lucide="${icons[type]}"></i>
      <span class="toast-message"></span>
      <button class="toast-close" aria-label="Fechar notificação">
        <i data-lucide="x" style="width:16px;height:16px;"></i>
      </button>
    `;
    toast.querySelector('.toast-message').textContent = message;

    // Renderiza ícones Lucide no toast
    const overlay = document.getElementById('modal-overlay');
    const dialog = overlay?.style.display === 'flex' ? overlay.querySelector('[role="dialog"]') : null;
    let container = this.container;
    if (dialog) {
      container = dialog.querySelector('[data-modal-toast-container]');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('data-modal-toast-container', '');
        dialog.appendChild(container);
      }
    }
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });

    // Botão de fechar
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.dismiss(toast);
    });

    // Auto-dismiss
    setTimeout(() => {
      this.dismiss(toast);
    }, duration);
  },

  dismiss(toast) {
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => {
      toast.remove();
    }, 300);
  },

  success(message, duration) { this.show(message, 'success', duration); },
  error(message, duration)   { this.show(message, 'error', duration); },
  warning(message, duration) { this.show(message, 'warning', duration); },
  info(message, duration)    { this.show(message, 'info', duration); },
};
