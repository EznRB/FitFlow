/** Entrada do checkout interno e conciliação de retornos legados. */
const MercadoPagoCheckout = {
  attempts: new Map(),
  availabilitySequence: 0,
  openSequence: 0,
  opening: null,
  dialog: null,
  pending: null,
  capture(container = null, current = null) {
    const userId = Auth.user?.id, generation = Auth.generation, epoch = Auth.sessionEpoch;
    const page = typeof App === 'undefined' ? null : App.currentPage;
    return { userId, current: () => Boolean(userId && Auth.user?.id === userId && Auth.user?.role === 'student'
      && Auth.generation === generation && Auth.sessionEpoch === epoch
      && (typeof Auth.getSessionEpoch !== 'function' || Auth.getSessionEpoch() === epoch)
      && (typeof App === 'undefined' || App.currentPage === page)
      && (!container || container.isConnected && document.getElementById(container.id) === container)
      && (!current || current())) };
  },
  availability(data) {
    if (data?.sandbox !== true || typeof data.enabled !== 'boolean') return 'unknown';
    return data.enabled ? 'available' : 'configuration';
  },
  async decorateMembership(container, current) {
    const scope = this.capture(container, current), sequence = ++this.availabilitySequence;
    const slot = container.querySelector('[data-checkout-status]'), button = container.querySelector('[data-action="checkout"]');
    if (!slot || !button || !scope.current()) return;
    const owns = () => scope.current() && sequence === this.availabilitySequence
      && container.querySelector('[data-checkout-status]') === slot && container.querySelector('[data-action="checkout"]') === button;
    const display = state => {
      if (!owns()) return;
      const states = {
        loading: ['Consultando disponibilidade do checkout…', 'Consultando checkout…'],
        available: ['Sandbox disponível · Pix e cartão dentro do FitFlow. Nenhuma cobrança ou renovação foi confirmada.', 'Abrir checkout de teste'],
        configuration: ['Aguardando configuração · O pagamento online ainda não está disponível. Consulte a administração da academia. Nenhuma cobrança ou renovação foi confirmada.', 'Ver orientação de pagamento'],
        unknown: ['Disponibilidade não confirmada · Não foi possível confirmar o checkout de teste. Sua mensalidade e os registros financeiros continuam disponíveis.', 'Tentar consultar checkout']
      };
      slot.textContent = states[state][0]; slot.dataset.state = state;
      button.textContent = states[state][1]; button.disabled = state === 'loading';
    };
    display('loading');
    try { const response = await API.get('/checkout/config', { timeoutMs: 15000 }); display(this.availability(response.data)); }
    catch { display('unknown'); }
  },
  validUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && ['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com'].includes(url.hostname) && !url.username && !url.password && !url.port; } catch { return false; }
  },
  async abrir() {
    const scope = this.capture(document.getElementById('aluno-mensalidade-container'));
    if (!scope.current() || typeof App === 'undefined' || App.currentPage !== 'aluno-mensalidade') return;
    if (typeof CheckoutView === 'undefined') { Toast.error('Pagamento indisponível. Atualize a página e tente novamente.'); return; }
    App.navigateTo('aluno-checkout');
  },
  async verificarRetorno() {
    const id = new URLSearchParams(window.location.search).get('checkout_intent');
    if (!id || !Auth.user?.id) return;
    const scope = this.capture(document.getElementById('page-content'));
    if (!scope.current()) return;
    const userId = scope.userId, attempts = new Map(this.attempts), href = window.location.href;
    try {
      const response = await API.get(`/checkout/intents/${encodeURIComponent(id)}`, { timeoutMs: 15000 });
      if (!scope.current() || window.location.href !== href) return;
      if (response.data.state === 'paid' && response.data.settled) {
        const key = `${userId}:${response.data.planId}`;
        if (attempts.has(key) && this.attempts.get(key) === attempts.get(key)) this.attempts.delete(key);
        Toast.success('Pagamento sandbox conciliado pelo servidor.');
      }
      else if (response.data.requiresReview) Toast.warning('Pagamento de teste requer conferência administrativa.');
      else Toast.info('Pagamento de teste pendente. Nenhuma renovação foi confirmada.');
      const url = new URL(window.location.href); url.searchParams.delete('checkout_intent');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (error) { if (scope.current() && window.location.href === href) Toast.error(error.message || 'Não foi possível conciliar o pagamento de teste.'); }
  }
};
if (typeof AlunoMensalidadeView !== 'undefined') AlunoMensalidadeView.abrirCheckout = () => MercadoPagoCheckout.abrir();
// DATE financeiros não representam instante UTC; evita exibir o dia anterior em SP.
if (typeof PagamentosView !== 'undefined') PagamentosView.formatarData = value => {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
};
window.addEventListener('auth:logout', event => {
  MercadoPagoCheckout.openSequence++; MercadoPagoCheckout.availabilitySequence++; MercadoPagoCheckout.dialog = null;
  if (event.detail?.reason !== 'expired' && event.detail?.userId) {
    const prefix = `${event.detail.userId}:`;
    for (const key of MercadoPagoCheckout.attempts.keys()) if (key.startsWith(prefix)) MercadoPagoCheckout.attempts.delete(key);
  }
});
window.addEventListener('navigate', () => { MercadoPagoCheckout.openSequence++; MercadoPagoCheckout.availabilitySequence++; MercadoPagoCheckout.dialog = null; });
