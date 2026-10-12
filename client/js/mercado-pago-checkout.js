/** Checkout hospedado: nenhum número de cartão, CVV ou token privado entra no FitFlow. */
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
        available: ['Sandbox disponível · Pix e cartão no checkout de teste. Nenhuma cobrança ou renovação foi confirmada.', 'Abrir checkout de teste'],
        configuration: ['Aguardando configuração · O pagamento online ainda não está disponível. Consulte a administração da academia. Nenhuma cobrança ou renovação foi confirmada.', 'Ver orientação de pagamento'],
        unknown: ['Disponibilidade não confirmada · Não foi possível confirmar o checkout de teste. Sua mensalidade e os registros financeiros continuam disponíveis.', 'Tentar consultar checkout']
      };
      slot.textContent = states[state][0]; slot.dataset.state = state;
      button.textContent = states[state][1]; button.disabled = state === 'loading';
    };
    display('loading');
    try { const response = await API.get('/checkout/status', { timeoutMs: 15000 }); display(this.availability(response.data)); }
    catch { display('unknown'); }
  },
  validUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && ['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com'].includes(url.hostname) && !url.username && !url.password && !url.port; } catch { return false; }
  },
  async abrir() {
    const container = document.getElementById('aluno-mensalidade-container');
    const scope = this.capture(container);
    if (!scope.current() || (typeof App !== 'undefined' && App.currentPage !== 'aluno-mensalidade')) return;
    if (this.opening?.current() || this.dialog?.current()) return;
    const sequence = ++this.openSequence, revision = Modal.revision;
    const current = () => scope.current() && sequence === this.openSequence && Modal.revision === revision;
    const opening = this.opening = { current };
    this.dialog = null;
    try {
      const status = await API.get('/checkout/status', { timeoutMs: 15000 });
      if (!current()) return;
      const availability = this.availability(status.data);
      if (availability === 'configuration') {
        const dialog = { current: () => scope.current() && this.dialog === dialog && sequence === this.openSequence && Modal.revision === dialog.revision && Modal.isOpen() };
        Modal.open('Pagamento de teste', '<p>O pagamento online está indisponível neste ambiente de teste. Consulte a administração da academia. Nenhuma cobrança ou renovação foi confirmada.</p>', [{ text: 'Fechar', class: 'btn-secondary', action: () => { if (dialog.current()) Modal.close(); } }]);
        dialog.revision = Modal.revision; this.dialog = dialog;
        return;
      }
      if (availability !== 'available') throw new Error('Disponibilidade não confirmada. Não foi possível confirmar o ambiente de teste.');
      const response = await API.get('/checkout/plans', { timeoutMs: 15000 });
      if (!current()) return;
      const plans = (Array.isArray(response.data) ? response.data : []).filter(plan => plan.active !== false && Number.isSafeInteger(Number(plan.id)) && Number(plan.id) > 0 && Number.isFinite(Number(plan.price)) && Number(plan.price) > 0);
      if (!plans.length) throw new Error('Nenhum plano disponível para o checkout de teste. Consulte a administração.');
      const options = plans.map(plan => `<option value="${Number(plan.id)}">${FitFlowSecurity.escapeHtml(plan.name)} — ${Number(plan.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>`).join('');
      const dialog = { scope, sequence, plans: new Set(plans.map(plan => Number(plan.id))), select: null, current: () => scope.current()
        && this.dialog === dialog && sequence === this.openSequence && Modal.revision === dialog.revision
        && Modal.isOpen() && document.getElementById('mp-checkout-plan') === dialog.select && dialog.select?.isConnected };
      Modal.open('Checkout sandbox — Mercado Pago', `<div class="form-group"><label for="mp-checkout-plan">Plano</label><select id="mp-checkout-plan">${options}</select></div><p class="science-note">Ambiente de teste. Pix e cartão são escolhidos no Mercado Pago usando uma conta e cartões de teste. O retorno à página não confirma pagamento; a vigência depende da conciliação no servidor.</p><p id="mp-checkout-feedback" role="status" aria-live="polite"></p>`, [
        { text: 'Fechar', class: 'btn-secondary', action: () => { if (dialog.current()) Modal.close(); } },
        { text: 'Abrir checkout de teste', class: 'btn-primary', action: () => this.iniciar(dialog) }
      ]);
      dialog.select = document.getElementById('mp-checkout-plan'); dialog.revision = Modal.revision; this.dialog = dialog;
    } catch (error) { if (current()) Toast.error(error.message || 'Checkout indisponível.'); }
    finally { if (this.opening === opening) this.opening = null; }
  },
  async iniciar(dialog = this.dialog) {
    if (!dialog?.scope || !dialog.plans || !dialog.current() || this.pending?.dialog === dialog) return;
    const userId = dialog.scope.userId;
    const planId = Number(dialog.select.value);
    if (!dialog.plans.has(planId)) { Toast.error('Selecione um plano disponível neste checkout.'); return; }
    const key = `${userId}:${planId}`;
    if (!this.attempts.has(key)) this.attempts.set(key, crypto.randomUUID());
    const idempotencyKey = this.attempts.get(key), pending = this.pending = { dialog };
    const feedback = document.getElementById('mp-checkout-feedback');
    if (feedback) feedback.textContent = 'Preparando o checkout de teste…';
    dialog.select.disabled = true;
    try {
      const response = await API.post('/checkout/intents', { planId, idempotencyKey }, { timeoutMs: 15000 });
      if (!dialog.current()) return;
      if (response.data.state === 'paid' && response.data.settled) {
        if (this.attempts.get(key) === idempotencyKey) this.attempts.delete(key);
        Toast.success('Este pagamento de teste já foi conciliado. Uma nova compra exige outra confirmação.');
        return;
      }
      if (!this.validUrl(response.data.checkoutUrl)) throw new Error('URL de checkout inválida.');
      window.location.assign(response.data.checkoutUrl);
    } catch (error) { if (dialog.current()) Toast.error(error.message || 'Confirmação pendente.'); }
    finally {
      if (this.pending === pending) this.pending = null;
      if (dialog.current()) { dialog.select.disabled = false; if (feedback && document.getElementById('mp-checkout-feedback') === feedback) feedback.textContent = ''; }
    }
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
