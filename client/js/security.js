/** Escapa dados em conteúdo HTML e atributos entre aspas. */
const FitFlowSecurity = Object.freeze({
  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }
});
