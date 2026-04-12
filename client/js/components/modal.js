/**
 * ============================================
 * FitFlow Caraguá — Modal Component
 * ============================================
 * Sistema de modal genérico reutilizável.
 * 
 * Uso:
 *   Modal.open('Título', '<p>Conteúdo HTML</p>', [
 *     { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
 *     { text: 'Confirmar', class: 'btn-primary', action: () => handleConfirm() },
 *   ]);
 */

const Modal = {
  overlay: null,
  titleEl: null,
  bodyEl: null,
  footerEl: null,
  closeBtn: null,

  init() {
    this.overlay = document.getElementById('modal-overlay');
    this.titleEl = document.getElementById('modal-title');
    this.bodyEl = document.getElementById('modal-body');
    this.footerEl = document.getElementById('modal-footer');
    this.closeBtn = document.getElementById('btn-modal-close');

    // Fechar modal ao clicar no X
    this.closeBtn.addEventListener('click', () => this.close());

    // Fechar modal ao clicar no overlay
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  },

  /**
   * Abre o modal com conteúdo dinâmico.
   * @param {string} title - Título do modal
   * @param {string} bodyHTML - Conteúdo HTML do body
   * @param {Array} buttons - Array de botões [{text, class, action}]
   */
  open(title, bodyHTML, buttons = []) {
    if (!this.overlay) this.init();

    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = bodyHTML;

    // Gera os botões no footer
    this.footerEl.innerHTML = '';
    buttons.forEach((btn) => {
      const button = document.createElement('button');
      button.className = `btn ${btn.class || 'btn-secondary'}`;
      button.textContent = btn.text;
      if (btn.action) button.addEventListener('click', btn.action);
      this.footerEl.appendChild(button);
    });

    // Renderiza ícones Lucide dentro do modal
    if (window.lucide) lucide.createIcons({ nodes: [this.bodyEl] });

    this.overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Foca no primeiro input se existir
    setTimeout(() => {
      const firstInput = this.bodyEl.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  },

  /**
   * Fecha o modal.
   */
  close() {
    if (!this.overlay) return;
    this.overlay.style.display = 'none';
    document.body.style.overflow = '';
    this.bodyEl.innerHTML = '';
    this.footerEl.innerHTML = '';
  },

  /**
   * Verifica se o modal está aberto.
   */
  isOpen() {
    return this.overlay && this.overlay.style.display === 'flex';
  },

  /**
   * Abre um modal de confirmação.
   * @param {string} message - Mensagem de confirmação
   * @param {Function} onConfirm - Callback ao confirmar
   * @param {string} confirmText - Texto do botão (padrão: 'Confirmar')
   */
  confirm(message, onConfirm, confirmText = 'Confirmar') {
    this.open('Confirmação', `<p>${message}</p>`, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => this.close() },
      {
        text: confirmText,
        class: 'btn-danger',
        action: () => {
          this.close();
          if (onConfirm) onConfirm();
        },
      },
    ]);
  },
};
