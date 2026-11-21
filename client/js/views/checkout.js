/** Tela dedicada: dados de cartão são capturados exclusivamente pelo SDK oficial. */
const CheckoutView = {
  session: null,
  sdkPromise: null,
  destroy() {
    const session = this.session; this.session = null;
    if (!session) return;
    clearTimeout(session.timer);
    for (const controller of session.controllers) Promise.resolve(controller.unmount()).catch(() => {});
    session.controllers.clear();
  },
  current(session) { return this.session === session && session.container.isConnected
    && document.getElementById(session.container.id) === session.container && Auth.user?.id === session.userId
    && Auth.user?.role === 'student' && Auth.generation === session.generation
    && Auth.sessionEpoch === session.epoch && (typeof Auth.getSessionEpoch !== 'function' || Auth.getSessionEpoch() === session.epoch)
    && App.currentPage === 'aluno-checkout'; },
  feedback(session, text) { if (this.current(session)) document.getElementById('checkout-feedback').textContent = text; },
  async render(container) {
    this.destroy();
    const session = this.session = { container, userId: Auth.user?.id, generation: Auth.generation, epoch: Auth.sessionEpoch,
      controllers: new Set(), polls: 0, preparing: false, submitting: null };
    if (!this.current(session)) return;
    container.innerHTML = `<section class="ff-checkout" data-mp-bricks-page="payment"><div class="ff-checkout-heading"><div><p class="science-eyebrow">Sua mensalidade</p><h2>Pagar plano</h2><p>Escolha seu plano e pague com cartão ou Pix aqui no FitFlow.</p></div><button type="button" class="btn btn-secondary" id="checkout-back">Voltar à mensalidade</button></div><p class="ff-checkout-test">Ambiente de teste · use somente dados de teste. Uma pendência não renova seu plano.</p><div class="ff-checkout-grid"><section class="ff-checkout-card"><h3>Resumo da compra</h3><label for="checkout-plan">Plano</label><select class="form-control" id="checkout-plan" disabled></select><p id="checkout-summary"></p><button type="button" class="btn btn-primary" id="checkout-begin" disabled>Continuar para pagamento</button><a id="checkout-legacy" class="btn btn-secondary" hidden>Continuar compra anterior</a></section><section class="ff-checkout-card"><h3>Pagamento seguro</h3><p id="checkout-feedback" role="status" aria-live="polite">Carregando opções de pagamento…</p><div id="paymentBrick_container"></div><div id="statusScreenBrick_container"></div><button type="button" class="btn btn-secondary" id="checkout-refresh" hidden>Consultar situação</button><button type="button" class="btn btn-primary" id="checkout-retry" hidden>Tentar novamente</button><p>Processado pelo Mercado Pago. O FitFlow confirma o pagamento antes de renovar a vigência.</p></section></div></section>`;
    document.getElementById('checkout-back').addEventListener('click', () => { if (this.current(session)) App.navigateTo('aluno-mensalidade'); });
    document.getElementById('checkout-begin').addEventListener('click', () => this.begin());
    document.getElementById('checkout-refresh').addEventListener('click', () => this.refresh(session));
    document.getElementById('checkout-retry').addEventListener('click', () => { if (this.current(session)) { session.attemptKey = null; this.mountPayment(session).catch(() => this.feedback(session, 'Não foi possível abrir o formulário. Volte e tente novamente.')); } });
    try {
      const response = await API.get('/checkout/config', { cache: 'no-store', timeoutMs: 15000 });
      if (!this.current(session)) return;
      const runtimeConfig = response.data;
      session.config = { ...runtimeConfig, MP_PUBLIC_KEY: runtimeConfig?.publicKey };
      if (!session.config?.enabled || session.config.sandbox !== true || !session.config.publicKey) throw new Error('Pagamento interno indisponível. Consulte a administração da academia.');
      const plans = await API.get('/checkout/plans', { timeoutMs: 15000 });
      if (!this.current(session)) return;
      session.plans = (Array.isArray(plans.data) ? plans.data : []).filter(p => Number.isSafeInteger(Number(p.id)) && Number(p.id) > 0 && Number(p.price) > 0 && Number.isFinite(Number(p.price)));
      if (!session.plans.length) throw new Error('Nenhum plano disponível para pagamento.');
      const select = document.getElementById('checkout-plan');
      select.innerHTML = session.plans.map(p => `<option value="${Number(p.id)}">${FitFlowSecurity.escapeHtml(p.name)} — ${Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>`).join('');
      select.disabled = false; document.getElementById('checkout-begin').disabled = false;
      this.feedback(session, 'Selecione o plano e continue para escolher cartão ou Pix.');
    } catch (error) { this.feedback(session, error.message || 'Pagamento indisponível. Tente novamente mais tarde.'); }
  },
  async begin() {
    const session = this.session;
    if (!session || !this.current(session) || session.preparing || session.purchase) return;
    const planId = Number(document.getElementById('checkout-plan').value);
    if (!session.plans?.some(p => Number(p.id) === planId)) return;
    session.preparing = true; document.getElementById('checkout-begin').disabled = true;
    document.getElementById('checkout-plan').disabled = true;
    this.feedback(session, 'Preparando sua compra…');
    try {
      const response = await API.post('/checkout/purchases', { planId }, { timeoutMs: 15000 });
      if (!this.current(session)) return;
      session.purchase = response.data;
      document.getElementById('checkout-plan').disabled = true;
      document.getElementById('checkout-begin').hidden = true;
      document.getElementById('checkout-summary').textContent = `${session.purchase.planName} · ${session.purchase.durationDays} dias · Total: ${Number(session.purchase.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
      if (session.purchase.flow !== 'brick') {
        this.feedback(session, 'Você tem uma compra anterior pendente. Consulte ou conclua essa compra antes de iniciar outra cobrança.');
        const link = document.getElementById('checkout-legacy');
        const value = session.purchase.legacyUrl;
        try { const url = new URL(value); if (url.protocol === 'https:' && ['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com'].includes(url.hostname) && !url.username && !url.password && !url.port) { link.href = url.href; link.hidden = false; } } catch {}
        document.getElementById('checkout-refresh').hidden = false;
      } else if (session.purchase.paymentId || ['processing', 'uncertain'].includes(session.purchase.attemptState)) await this.result(session);
      else await this.mountPayment(session);
    } catch (error) { this.feedback(session, error.message || 'Não foi possível preparar o pagamento. Tente novamente.'); }
    finally { if (this.current(session)) { session.preparing = false; if (!session.purchase) { document.getElementById('checkout-begin').disabled = false; document.getElementById('checkout-plan').disabled = false; } } }
  },
  async loadSdk() {
    if (window.MercadoPago) return;
    if (!this.sdkPromise) this.sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://sdk.mercadopago.com/js/v2'; script.async = true;
      const timer = setTimeout(() => { script.remove(); this.sdkPromise = null; reject(new Error('O formulário não carregou. Verifique a conexão e se o navegador bloqueou o Mercado Pago.')); }, 15000);
      script.onload = () => { clearTimeout(timer); if (window.MercadoPago) resolve(); else { this.sdkPromise = null; reject(new Error('Formulário de pagamento indisponível.')); } };
      script.onerror = () => { clearTimeout(timer); script.remove(); this.sdkPromise = null; reject(new Error('O navegador não conseguiu carregar o Mercado Pago. Verifique a conexão ou bloqueadores.')); };
      document.head.appendChild(script);
    });
    return this.sdkPromise;
  },
  async builder(session) {
    await this.loadSdk();
    if (!this.current(session)) throw new Error('A sessão de pagamento foi alterada.');
    session.builder ||= new window.MercadoPago(session.config.MP_PUBLIC_KEY, { locale: 'pt-BR' }).bricks();
    return session.builder;
  },
  async clearControllers(session) {
    for (const controller of session.controllers) { session.controllers.delete(controller); try { await controller.unmount(); } catch {} }
    session.statusPaymentId = null;
  },
  async mountPayment(session) {
    if (!this.current(session) || session.mounting) return;
    session.mounting = true;
    document.getElementById('checkout-retry').hidden = true;
    try {
      await this.clearControllers(session); const builder = await this.builder(session);
      if (!this.current(session)) return;
      document.getElementById('checkout-retry').hidden = true;
      this.feedback(session, 'Carregando formulário seguro…');
      const controller = await builder.create('payment', 'paymentBrick_container', {
        initialization: { amount: Number(session.purchase.amount), payer: { email: session.config.buyerEmail } },
        customization: { paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: ['pix'], maxInstallments: 1 } },
        callbacks: { onReady: () => this.feedback(session, 'Escolha cartão ou Pix para pagar.'),
          onError: () => this.feedback(session, 'Não foi possível carregar o formulário. Verifique sua conexão ou bloqueadores e tente novamente.'),
          onSubmit: ({ selectedPaymentMethod, formData }) => this.submit(session, { selectedPaymentMethod, formData }) }
      });
      if (!this.current(session)) { await controller.unmount(); return; }
      session.controllers.add(controller);
    } catch (error) {
      if (this.current(session)) document.getElementById('checkout-retry').hidden = false;
      throw error;
    } finally { session.mounting = false; }
  },
  async submit(session, data) {
    if (!this.current(session)) throw new Error('A sessão de pagamento foi alterada.');
    if (session.submitting) return session.submitting;
    session.attemptKey ||= crypto.randomUUID();
    this.feedback(session, 'Processando pagamento. Aguarde a confirmação…');
    session.submitting = (async () => {
      try {
        const response = await API.post(`/checkout/intents/${encodeURIComponent(session.purchase.id)}/payments`, { attemptKey: session.attemptKey, brick: data }, { timeoutMs: 15000 });
        if (!this.current(session)) return;
        session.purchase = response.data;
        await this.result(session);
      } catch (error) {
        if (this.current(session)) { this.feedback(session, 'Não foi possível confirmar o resultado. Consulte a situação antes de tentar outro pagamento.'); document.getElementById('checkout-refresh').hidden = false; }
        throw error;
      } finally { session.submitting = null; }
    })();
    return session.submitting;
  },
  async result(session) {
    if (!this.current(session)) return;
    const purchase = session.purchase;
    document.getElementById('checkout-refresh').hidden = false;
    const rejected = ['rejected', 'cancelled'].includes(purchase.attemptState);
    this.feedback(session, purchase.settled ? 'Pagamento confirmado. Seu plano foi renovado pelo servidor.' : purchase.requiresReview ? 'Pagamento requer conferência da administração.' : rejected ? 'Pagamento não aprovado. Confira os dados ou tente outro cartão.' : purchase.paymentId ? 'Pagamento pendente. A vigência será renovada após a confirmação.' : 'O resultado ainda não foi confirmado. Consulte a situação; nenhuma nova cobrança será enviada.');
    document.getElementById('checkout-retry').hidden = !rejected;
    if (purchase.paymentId && session.statusPaymentId !== purchase.paymentId) {
      await this.clearControllers(session); const builder = await this.builder(session);
      if (!this.current(session)) return;
      const controller = await builder.create('statusScreen', 'statusScreenBrick_container', { initialization: { paymentId: String(purchase.paymentId) }, callbacks: { onReady: () => {}, onError: () => this.feedback(session, 'Não foi possível mostrar o resultado do Mercado Pago. Use Consultar situação para verificar sua compra.') } });
      if (!this.current(session)) { await controller.unmount(); return; }
      session.controllers.add(controller); session.statusPaymentId = purchase.paymentId;
    }
    clearTimeout(session.timer);
    if (!purchase.settled && !purchase.requiresReview && !rejected && session.polls < 10) session.timer = setTimeout(() => { session.polls++; this.refresh(session); }, 5000);
  },
  async refresh(session) {
    if (!this.current(session) || !session.purchase || session.checking) return;
    session.checking = true;
    try {
      const response = await API.get(`/checkout/purchases/${encodeURIComponent(session.purchase.id)}`, { timeoutMs: 15000 });
      if (!this.current(session)) return;
      session.purchase = response.data; await this.result(session);
    } catch { this.feedback(session, 'Não foi possível consultar agora. Aguarde e use Consultar situação novamente.'); }
    finally { session.checking = false; }
  }
};
window.addEventListener('auth:logout', () => CheckoutView.destroy());
