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
  previousFocus: null,
  background: [],

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
      if (e.key === 'Tab' && this.isOpen()) {
        const focusable = [...this.overlay.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
          .filter(node => !node.disabled && !node.hidden && node.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
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
    if (!this.isOpen()) {
      this.previousFocus = document.activeElement;
      this.background = [...document.body.children].filter(node => node !== this.overlay && !node.contains(this.overlay))
        .map(node => ({ node, inert: node.inert }));
      this.background.forEach(({ node }) => { node.inert = true; });
    }

    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = bodyHTML;

    // Gera os botões no footer
    this.footerEl.innerHTML = '';
    buttons.forEach((btn) => {
      const button = document.createElement('button');
      button.type = 'button';
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
    const firstInput = this.bodyEl.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    (firstInput || this.closeBtn).focus();
  },

  /**
   * Fecha o modal.
   */
  close() {
    if (!this.overlay) return;
    this.overlay.style.display = 'none';
    document.body.style.overflow = '';
    this.titleEl.textContent = '';
    this.bodyEl.innerHTML = '';
    this.footerEl.innerHTML = '';
    this.background.forEach(({ node, inert }) => { node.inert = inert; });
    this.background = [];
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
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
