/** Checkout hospedado: nenhum número de cartão, CVV ou token privado entra no FitFlow. */
const MercadoPagoCheckout = {
  attempts: new Map(),
  busy: false,
  validUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && ['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com'].includes(url.hostname) && !url.username && !url.password && !url.port; } catch { return false; }
  },
  async abrir() {
    try {
      const status = await API.get('/checkout/status');
      if (!status.data.enabled) {
        Modal.open('Pagamento de teste', '<p>O checkout sandbox aguarda configuração das contas de teste do Mercado Pago e do webhook. Nenhuma cobrança ou renovação foi confirmada.</p>', [{ text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() }]);
        return;
      }
      const response = await API.get('/checkout/plans');
      const plans = (response.data || []).filter(plan => plan.active !== false);
      const options = plans.map(plan => `<option value="${Number(plan.id)}">${FitFlowSecurity.escapeHtml(plan.name)} — R$ ${Number(plan.price).toFixed(2)}</option>`).join('');
      Modal.open('Checkout sandbox — Mercado Pago', `<div class="form-group"><label>Plano</label><select id="mp-checkout-plan">${options}</select></div><p class="science-note">Ambiente de teste. Pix e cartão são escolhidos no Mercado Pago usando uma conta e cartões de teste. O retorno à página não confirma pagamento; a vigência depende da conciliação no servidor.</p>`, [
        { text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() },
        { text: 'Abrir checkout de teste', class: 'btn-primary', action: () => this.iniciar() }
      ]);
    } catch (error) { Toast.error(error.message || 'Checkout indisponível.'); }
  },
  async iniciar() {
    if (this.busy || !Auth.user?.id) return;
    const userId = Auth.user.id;
    const planId = Number(document.getElementById('mp-checkout-plan')?.value);
    if (!Number.isInteger(planId) || planId < 1) { Toast.error('Selecione um plano.'); return; }
    const key = `${userId}:${planId}`;
    if (!this.attempts.has(key)) this.attempts.set(key, crypto.randomUUID());
    this.busy = true;
    try {
      const response = await API.post('/checkout/intents', { planId, idempotencyKey: this.attempts.get(key) });
      if (Auth.user?.id !== userId) return;
      if (response.data.state === 'paid' && response.data.settled) {
        this.attempts.delete(key);
        Toast.success('Este pagamento de teste já foi conciliado. Uma nova compra exige outra confirmação.');
        return;
      }
      if (!this.validUrl(response.data.checkoutUrl)) throw new Error('URL de checkout inválida.');
      window.location.assign(response.data.checkoutUrl);
    } catch (error) { Toast.error(error.message || 'Confirmação pendente.'); }
    finally { this.busy = false; }
  },
  async verificarRetorno() {
    const id = new URLSearchParams(window.location.search).get('checkout_intent');
    if (!id || !Auth.user?.id) return;
    const userId = Auth.user.id;
    try {
      const response = await API.get(`/checkout/intents/${encodeURIComponent(id)}`);
      if (Auth.user?.id !== userId) return;
      if (response.data.state === 'paid' && response.data.settled) {
        this.attempts.delete(`${userId}:${response.data.planId}`);
        Toast.success('Pagamento sandbox conciliado pelo servidor.');
      }
      else if (response.data.requiresReview) Toast.warning('Pagamento de teste requer conferência administrativa.');
      else Toast.info('Pagamento de teste pendente. Nenhuma renovação foi confirmada.');
      const url = new URL(window.location.href); url.searchParams.delete('checkout_intent');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (error) { Toast.error(error.message || 'Não foi possível conciliar o pagamento de teste.'); }
  }
};
if (typeof AlunoMensalidadeView !== 'undefined') AlunoMensalidadeView.abrirCheckout = () => MercadoPagoCheckout.abrir();
// DATE financeiros não representam instante UTC; evita exibir o dia anterior em SP.
if (typeof PagamentosView !== 'undefined') PagamentosView.formatarData = value => {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
};
window.addEventListener('auth:logout', event => { if (event.detail?.reason !== 'expired') MercadoPagoCheckout.attempts.clear(); });
