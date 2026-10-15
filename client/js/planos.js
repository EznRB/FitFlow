/** Planos com preço total e vigência em dias; cobrança depende do fluxo de pagamento. */
const PlanosView = {
  dados: [], planoAtualId: null,
  generation: 0, listSequence: 0, modalSequence: 0, activeForm: null, cacheContext: null,
  uncertainReview: null, reviewSession: 0,
  invalidar() {
    this.generation++; this.listSequence++; this.modalSequence++;
    this.dados = []; this.planoAtualId = null; this.activeForm = null; this.cacheContext = null;
  },
  contexto() {
    const user = typeof Auth === 'undefined' ? null : Auth.user;
    return { generation: this.generation, reviewSession: this.reviewSession, grid: document.getElementById('planos-grid'),
      userId: user?.id, role: user?.role, authGeneration: typeof Auth === 'undefined' ? null : Auth.generation,
      epoch: typeof Auth !== 'undefined' && typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null };
  },
  atual(context) {
    return context && context.generation === this.generation && context.grid && context.grid.isConnected !== false
      && document.getElementById('planos-grid') === context.grid
      && (typeof App === 'undefined' || App.currentPage === 'planos')
      && (typeof Auth === 'undefined' || (Auth.user?.id === context.userId && context.role === 'admin' && Auth.user?.role === context.role
        && Auth.generation === context.authGeneration
        && (typeof Auth.getSessionEpoch !== 'function' || (Auth.sessionEpoch === context.epoch && Auth.getSessionEpoch() === context.epoch))));
  },
  cacheAtual() { return typeof Auth === 'undefined' || this.atual(this.cacheContext); },
  mesmaSessao(scope) {
    return scope && scope.reviewSession === this.reviewSession && (typeof Auth === 'undefined' || (Auth.user?.id === scope.userId && scope.role === 'admin'
      && Auth.user?.role === scope.role && Auth.generation === scope.authGeneration
      && (typeof Auth.getSessionEpoch !== 'function' || (Auth.sessionEpoch === scope.epoch && Auth.getSessionEpoch() === scope.epoch))));
  },
  revisaoPendente() {
    if (this.uncertainReview && !this.mesmaSessao(this.uncertainReview.scope)) this.uncertainReview = null;
    return this.uncertainReview;
  },
  formularioAtual(context) {
    return context && this.activeForm === context && context.sequence === this.modalSequence && this.atual(context.scope)
      && context.form && context.form.isConnected !== false && document.getElementById('form-plano') === context.form
      && Modal.revision === context.revision
      && context.footer && context.footer.isConnected !== false && document.getElementById('modal-footer') === context.footer
      && Object.entries(context.fields).every(([id, node]) => node && node.isConnected !== false && document.getElementById(id) === node)
      && (!context.button || (context.button.isConnected !== false && document.querySelector?.('#modal-footer .btn-primary') === context.button))
      && context.feedback && context.feedback.isConnected !== false && document.getElementById('plan-save-feedback') === context.feedback
      && context.check && context.check.isConnected !== false && document.getElementById('plan-check-saved') === context.check
      && context.review && context.review.isConnected !== false && document.getElementById('plan-review-list') === context.review
      && (typeof Modal.isOpen !== 'function' || Modal.isOpen());
  },
  DURATION_PRESETS: [{ value: 30, label: 'Mensal (30 dias)' }, { value: 90, label: 'Trimestral (90 dias)' },
    { value: 180, label: 'Semestral (180 dias)' }, { value: 365, label: 'Anual (365 dias)' }, { value: 'custom', label: 'Personalizado' }],
  escapar(value) { return FitFlowSecurity.escapeHtml(value); },
  idValido(value) { return Number.isSafeInteger(value) && value > 0 && value <= 2147483647; },
  valor(value) {
    if (!['number', 'string'].includes(typeof value) || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) return null;
    const n = Number(value); return Number.isFinite(n) && n >= 0.01 && n <= 99999999.99 ? n : null;
  },
  duracao(value) {
    if (!['number', 'string'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value))) return null;
    const n = Number(value); return Number.isSafeInteger(n) && n <= 3650 ? n : null;
  },
  moeda(value) { return Number.isFinite(value) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : 'Não informado'; },
  equivalente(price, days) {
    const value = this.valor(price), duration = this.duracao(days);
    return value === null || duration === null ? null : value * 30 / duration;
  },
  async inicializar() {
    this.invalidar(); const context = this.contexto(); if (!this.atual(context)) return;
    this.configurarEventos(context);
    await this.carregarLista();
  },
  async carregarLista() {
    const context = this.contexto(), sequence = ++this.listSequence;
    if (!this.atual(context)) return;
    const grid = context.grid;
    if (grid.style) grid.style.gridTemplateColumns = '';
    grid.innerHTML = '<p role="status">Carregando planos…</p>';
    try {
      const response = await API.get('/planos', { timeoutMs: 15000 });
      if (!this.atual(context) || sequence !== this.listSequence) return;
      if (!Array.isArray(response?.data)) throw new Error('A resposta de planos está incompleta. Consulte novamente para confirmar a lista.');
      this.dados = response.data; this.cacheContext = context;
      const sorted = [...this.dados].sort((a, b) => Number(b.active) - Number(a.active) || Number(a.durationDays) - Number(b.durationDays));
      grid.innerHTML = sorted.length ? sorted.map(plan => this.renderCard(plan)).join('') : '<section class="management-list-state" role="status"><h3>Nenhum plano cadastrado</h3><p>Defina valor e vigência em Novo Plano para criar a primeira opção da academia.</p></section>';
      grid.onclick = event => {
        if (!this.atual(context) || sequence !== this.listSequence) return;
        const button = event.target.closest?.('button[data-plan-action]'); if (!button || !grid.contains(button)) return;
        const id = Number(button.dataset.id); if (!this.idValido(id)) return;
        if (button.dataset.planAction === 'detail') this.abrirDetalhe(id);
        if (button.dataset.planAction === 'edit') this.abrirModalEdicao(id);
        if (button.dataset.planAction === 'deactivate') this.inativarPlano(id);
      };
      if (window.lucide) window.lucide.createIcons({ nodes: [grid] });
      return { confirmed: true, data: response.data };
    } catch (error) {
      if (!this.atual(context) || sequence !== this.listSequence) return;
      this.dados = []; this.cacheContext = null;
      grid.innerHTML = `<section class="management-list-state" role="alert"><h3>Não foi possível carregar os planos</h3><p>${this.escapar(error.message || 'Confira a conexão e tente novamente.')}</p><button type="button" class="btn btn-secondary" data-plan-retry>Tentar novamente</button></section>`;
      grid.onclick = event => {
        if (!this.atual(context) || sequence !== this.listSequence) return;
        const button = event.target?.closest?.('button[data-plan-retry]');
        if (button && grid.contains(button)) return this.carregarLista();
      };
      return { confirmed: false };
    }
  },
  renderCard(plan) {
    if (!this.idValido(plan.id)) return '';
    const value = this.valor(plan.price), duration = this.duracao(plan.durationDays);
    const equivalent = this.equivalente(plan.price, plan.durationDays);
    return `<article class="card workspace-plan" data-plan-active="${Boolean(plan.active)}">
      <header class="workspace-plan-heading"><span class="badge ${plan.active ? 'badge-success' : 'badge-secondary'}">${plan.active ? 'Ativo' : 'Inativo'}</span>
        <h3>${this.escapar(plan.name)}</h3></header>
      <div class="workspace-plan-offer"><span class="workspace-plan-label">Valor total da vigência</span>
        <p class="workspace-plan-price">${value === null ? 'Valor inválido' : this.moeda(value)}</p>
        <p class="workspace-plan-duration">${duration === null ? 'Vigência não informada' : `${duration} dias de vigência`}</p></div>
      <p class="workspace-plan-equivalent">${equivalent === null ? 'Equivalência indisponível' : `${this.moeda(equivalent)} por 30 dias, como comparação aritmética.`}</p>
      <p class="workspace-plan-description">${this.escapar(plan.description || 'Sem descrição.')}</p>
      ${!plan.active ? '<p class="workspace-plan-inactive">Disponível para consulta do histórico; não é opção para novas matrículas.</p>' : ''}
      <div class="workspace-plan-actions">
        <button class="btn btn-primary" type="button" data-plan-action="detail" data-id="${plan.id}">Ver detalhes</button>
        <button class="btn btn-secondary" type="button" data-plan-action="edit" data-id="${plan.id}">Editar plano</button>
        ${plan.active ? `<button class="btn btn-ghost" type="button" data-plan-action="deactivate" data-id="${plan.id}">Inativar plano</button>` : ''}
      </div></article>`;
  },
  abrirDetalhe(id) {
    if (!this.idValido(id) || !this.cacheAtual()) return;
    const plan = this.dados.find(item => item.id === id); if (!plan) return;
    const context = this.contexto(); if (!this.atual(context)) return;
    const grid = context.grid;
    if (grid.style) grid.style.gridTemplateColumns = '1fr';
    grid.innerHTML = this.renderDetalhe(plan);
    grid.onclick = event => {
      if (!this.atual(context)) return;
      const button = event.target.closest?.('button[data-plan-detail]');
      if (!button || !grid.contains(button)) return;
      if (button.dataset.planDetail === 'back') this.carregarLista();
      if (button.dataset.planDetail === 'edit') this.abrirModalEdicao(id);
    };
    grid.querySelector?.('[data-plan-detail-title]')?.focus();
  },
  renderDetalhe(plan) {
    const value = this.valor(plan.price), duration = this.duracao(plan.durationDays);
    const equivalent = this.equivalente(plan.price, plan.durationDays);
    return `<section class="card workspace-plan-detail" aria-label="Detalhes do plano">
      <button class="btn btn-ghost" type="button" data-plan-detail="back">Voltar para planos</button>
      <p class="workspace-plan-label">PLANOS / DETALHE</p>
      <h2 tabindex="-1" data-plan-detail-title>${this.escapar(plan.name)}</h2>
      <p><span class="badge ${plan.active ? 'badge-success' : 'badge-secondary'}">${plan.active ? 'Ativo' : 'Inativo'}</span></p>
      <dl class="workspace-plan-facts">
        <div class="workspace-plan-total"><dt>Valor total da vigência</dt><dd>${value === null ? 'Valor inválido' : this.moeda(value)}</dd></div>
        <div><dt>Vigência</dt><dd>${duration === null ? 'Não informada' : `${duration} dias`}</dd></div>
        <div><dt>Equivalência aritmética por 30 dias</dt><dd>${equivalent === null ? 'Indisponível' : this.moeda(equivalent)}</dd></div>
        <div class="workspace-plan-conditions"><dt>Descrição e condições</dt><dd>${this.escapar(plan.description || 'Sem descrição.')}</dd></div>
      </dl>
      <p>A equivalência serve para comparar planos. Não configura cobrança mensal automática.</p>
      ${!plan.active ? '<p>Plano inativo: disponível para consulta do histórico, sem novas matrículas.</p>' : ''}
      <button class="btn btn-primary" type="button" data-plan-detail="edit">Editar plano</button>
    </section>`;
  },
  configurarEventos(context = this.contexto()) {
    const button = document.getElementById('btn-novo-plano');
    if (button && this.atual(context)) button.onclick = () => { if (this.atual(context)) this.abrirModalCriacao(); };
  },
  abrirModalCriacao() { if (!this.atual(this.contexto())) return; this.planoAtualId = null; this._abrirModal('Criar plano', {}, 'Salvar plano'); },
  abrirModalEdicao(id) {
    if (!this.idValido(id) || !this.cacheAtual()) return;
    const plan = this.dados.find(item => item.id === id); if (!plan) return;
    this.planoAtualId = id; this._abrirModal('Editar plano', plan, 'Atualizar plano');
  },
  _abrirModal(title, plan, submitText) {
    const scope = this.contexto(); if (!this.atual(scope)) return;
    const sequence = ++this.modalSequence, id = this.planoAtualId; this.activeForm = null;
    let context;
    const custom = Boolean(plan.durationDays) && !this.DURATION_PRESETS.some(preset => preset.value === plan.durationDays);
    const options = this.DURATION_PRESETS.map(preset => `<option value="${preset.value}" ${custom ? preset.value === 'custom' ? 'selected' : '' : preset.value === plan.durationDays ? 'selected' : ''}>${preset.label}</option>`).join('');
    Modal.open(title, `<form id="form-plano" class="management-form" aria-describedby="plan-save-context plan-save-feedback">
      <p class="management-form-intro">Defina a vigência e o valor total. A equivalência por 30 dias serve para comparar os planos.</p>
      <fieldset class="management-form-section"><legend><span>01</span> Nome e vigência</legend><div class="management-fields">
      <div class="form-group management-wide"><label for="input-plano-nome">Nome do plano</label><input type="text" id="input-plano-nome" maxlength="100" value="${this.escapar(plan.name)}" aria-describedby="plan-name-error" required><small id="plan-name-error" class="plan-field-error"></small></div>
      <div class="form-group"><label for="input-plano-periodo">Vigência</label><select id="input-plano-periodo" aria-describedby="plan-duration-error">${options}</select><small id="plan-duration-error" class="plan-field-error"></small></div>
      <div class="form-group" id="grupo-duracao-custom" ${custom ? '' : 'hidden'}><label for="input-plano-duracao-custom">Duração personalizada (dias)</label>
        <input type="number" id="input-plano-duracao-custom" min="1" max="3650" step="1" value="${custom ? this.escapar(plan.durationDays) : ''}" ${custom ? 'required' : 'disabled'} aria-describedby="plan-duration-error"></div></div></fieldset>
      <fieldset class="management-form-section"><legend><span>02</span> Valor e condições</legend><div class="management-fields">
      <div class="form-group"><label for="input-plano-valor">Valor total da vigência (R$)</label><input type="number" id="input-plano-valor" min="0.01" max="99999999.99" step="0.01" value="${this.escapar(plan.price)}" aria-describedby="plan-price-error" required><small id="plan-price-error" class="plan-field-error"></small></div>
      <div class="form-group"><label for="display-mensal">Equivalente aritmético por 30 dias</label><output class="management-comparison" id="display-mensal" aria-live="polite">—</output></div>
      <div class="form-group management-wide"><label for="input-plano-descricao">Descrição e condições</label><textarea id="input-plano-descricao" maxlength="10000" rows="3">${this.escapar(plan.description)}</textarea></div></div></fieldset>
      ${this._confirmacaoFormulario('O cadastro define valor e vigência. O pagamento é registrado ou iniciado no fluxo financeiro; o plano não agenda cobranças automáticas.')}
      <button type="submit" hidden>${submitText}</button>
      </form>`, [{ text: 'Cancelar', class: 'btn-secondary', action: () => {
        if (!this.formularioAtual(context)) return;
        Modal.close(); this.activeForm = null; this.modalSequence++;
      } }, { text: submitText, class: 'btn-primary', action: () => this.submeterFormulario(context) }]);
    context = this._capturarFormulario(scope, sequence, id, submitText);
    for (const field of ['input-plano-nome', 'input-plano-periodo', 'input-plano-duracao-custom', 'grupo-duracao-custom',
      'input-plano-valor', 'display-mensal', 'input-plano-descricao']) context.fields[field] = document.getElementById(field);
    this._vincularFormulario(context, () => this.submeterFormulario(context));
    this._configurarFormInteracao(context); this._atualizarMensal(context);
  },
  _confirmacaoFormulario(message) {
    return `<section id="plan-review-list" class="plan-review-list" aria-label="Lista consultada para revisão" tabindex="-1" hidden></section>
      <div id="plan-save-confirmation"><p id="plan-save-context">${message}</p>
      <p id="plan-save-feedback" role="status" aria-live="polite" aria-atomic="true"></p>
      <button type="button" id="plan-check-saved" class="btn btn-secondary" hidden>Conferir planos</button></div>`;
  },
  _capturarFormulario(scope, sequence, id, label) {
    return { scope, sequence, id, label, revision: Modal.revision, form: document.getElementById('form-plano'),
      footer: document.getElementById('modal-footer'), button: document.querySelector?.('#modal-footer .btn-primary'),
      feedback: document.getElementById('plan-save-feedback'), check: document.getElementById('plan-check-saved'),
      review: document.getElementById('plan-review-list'),
      fields: {}, pending: null, checking: false, requiresCheck: false, reviewToken: null, reviewedToken: null };
  },
  _vincularFormulario(context, submit) {
    this.activeForm = context;
    const confirmation = document.getElementById('plan-save-confirmation');
    // Leva a confirmação às ações fixas sem reconstruir os campos digitados.
    if (confirmation && context.footer?.prepend) context.footer.prepend(confirmation);
    context.button?.setAttribute?.('aria-describedby', 'plan-save-context plan-save-feedback');
    if (context.form) context.form.onsubmit = event => { event.preventDefault(); return submit(); };
    if (context.check) context.check.onclick = () => this._conferirFormulario(context);
    this._sincronizarRevisao(context); this._estadoFormulario(context, false);
  },
  _sincronizarRevisao(context) {
    const review = this.revisaoPendente();
    if (review && context.reviewToken !== review) {
      context.requiresCheck = true; context.reviewToken = review; context.reviewedToken = null;
      context.review.hidden = true;
      context.feedback.textContent = 'Há um envio anterior com resultado não confirmado nesta sessão. Ele pode já ter sido salvo. Consulte e revise os planos antes de fazer outro envio.';
    }
  },
  async _conferirFormulario(context) {
    if (!this.formularioAtual(context) || context.pending || context.checking || !context.requiresCheck) return;
    this._sincronizarRevisao(context);
    if (context.reviewedToken && context.reviewedToken === context.reviewToken) {
      if (this.uncertainReview === context.reviewToken) this.uncertainReview = null;
      context.requiresCheck = false; context.reviewedToken = null; context.reviewToken = null;
      context.feedback.textContent = 'Revisão confirmada por você. O rascunho foi mantido. Uma consulta não prova que o envio anterior falhou; confira os valores e evite criar o mesmo plano novamente.';
      this._estadoFormulario(context, false); return;
    }
    const token = context.reviewToken;
    context.checking = true; context.feedback.textContent = 'Consultando a lista de planos. O rascunho será mantido.';
    this._estadoFormulario(context, false);
    try {
      const result = await this.carregarLista();
      if (!this.formularioAtual(context)) return;
      this._sincronizarRevisao(context);
      if (!result?.confirmed || context.reviewToken !== token) {
        context.feedback.textContent = 'A consulta não foi confirmada ou há um novo resultado incerto. Seus campos foram mantidos; consulte novamente antes de continuar.'; return;
      }
      context.review.innerHTML = `<h3>Planos recebidos nesta consulta</h3><p>Confira nome, valor e vigência antes de outro envio. Esta lista não prova que uma operação anterior falhou ou terminou.</p>${result.data.length
        ? `<ul>${result.data.map(plan => `<li><strong>${this.escapar(plan.name)}</strong><span>${this.moeda(this.valor(plan.price))} · ${this.duracao(plan.durationDays) ?? 'Não informado'} dias · ${plan.active ? 'Ativo' : 'Inativo'}</span></li>`).join('')}</ul>`
        : '<p>Nenhum plano foi retornado nesta consulta.</p>'}`;
      context.review.hidden = false; context.reviewedToken = token;
      context.feedback.textContent = 'Lista recebida. Revise os planos exibidos no formulário. A consulta não prova que o envio anterior falhou; ele ainda pode ser concluído. O rascunho permanece sem alterações.';
      context.review.focus?.();
    } finally {
      context.checking = false; this._estadoFormulario(context, false);
    }
  },
  _estadoFormulario(context, busy) {
    if (!this.formularioAtual(context)) return;
    context.form.setAttribute?.('aria-busy', String(busy));
    if (context.button) { context.button.disabled = busy || context.checking || context.requiresCheck;
      context.button.textContent = busy ? (context.mode === 'deactivate' ? 'Inativando…' : 'Salvando…') : context.label; }
    context.check.hidden = !context.requiresCheck;
    context.check.disabled = busy || context.checking;
    context.check.textContent = context.checking ? 'Consultando…' : context.reviewedToken && context.reviewedToken === context.reviewToken
      ? 'Revisei a lista; continuar' : 'Conferir planos';
  },
  _falhaFormulario(context, error) {
    const uncertain = Boolean(error.timeout || !error.status || error.status >= 500);
    // O aviso pertence à sessão: fechar o modal ou navegar não torna um envio incerto seguro para repetição.
    if (uncertain && this.mesmaSessao(context.scope)) this.uncertainReview = { scope: context.scope };
    if (!this.formularioAtual(context)) return;
    context.requiresCheck = uncertain;
    if (uncertain) { context.reviewToken = this.uncertainReview; context.reviewedToken = null; context.review.hidden = true; }
    context.feedback.textContent = context.requiresCheck
      ? 'Resultado não confirmado. A operação pode já ter sido salva. Confira a lista de planos antes de iniciar outro envio. Seus dados foram mantidos.'
      : error.message || 'A operação foi recusada. Confira os dados antes de tentar novamente.';
  },
  _rascunhoFormulario(context) {
    return JSON.stringify(['input-plano-nome', 'input-plano-periodo', 'input-plano-duracao-custom', 'input-plano-valor', 'input-plano-descricao']
      .map(id => context.fields[id].value));
  },
  _validarFormulario(context, name, price, durationDays) {
    const rules = [
      ['input-plano-nome', 'plan-name-error', !name || name.length > 100, 'Informe um nome com até 100 caracteres.'],
      ['input-plano-valor', 'plan-price-error', price === null, 'Use um valor entre R$ 0,01 e R$ 99.999.999,99, com até duas casas decimais.'],
      [context.fields['input-plano-periodo'].value === 'custom' ? 'input-plano-duracao-custom' : 'input-plano-periodo', 'plan-duration-error', durationDays === null, 'Informe uma vigência inteira entre 1 e 3650 dias.']
    ];
    let invalid = false, firstInvalid;
    context.fields['input-plano-periodo'].setAttribute?.('aria-invalid', 'false');
    context.fields['input-plano-duracao-custom'].setAttribute?.('aria-invalid', 'false');
    for (const [fieldId, errorId, fails, message] of rules) {
      context.fields[fieldId].setAttribute?.('aria-invalid', String(fails));
      const error = document.getElementById(errorId); if (error) error.textContent = fails ? message : '';
      if (fails && !firstInvalid) firstInvalid = context.fields[fieldId];
      invalid ||= fails;
    }
    if (invalid) { context.feedback.textContent = 'Confira nome, valor e vigência nos campos indicados.'; firstInvalid?.focus?.(); return false; }
    return !context.form.reportValidity || context.form.reportValidity();
  },
  _configurarFormInteracao(context) {
    const select = context.fields['input-plano-periodo'];
    if (select) select.onchange = () => {
      if (!this.formularioAtual(context)) return;
      context.fields['grupo-duracao-custom'].hidden = select.value !== 'custom';
      context.fields['input-plano-duracao-custom'].disabled = select.value !== 'custom';
      context.fields['input-plano-duracao-custom'].required = select.value === 'custom';
      this._atualizarMensal(context);
    };
    ['input-plano-valor', 'input-plano-duracao-custom'].forEach(id => {
      const input = context.fields[id]; if (input) input.oninput = () => this._atualizarMensal(context);
    });
  },
  _getDuracaoAtual(context) {
    const select = context ? context.fields['input-plano-periodo'] : document.getElementById('input-plano-periodo'); if (!select) return null;
    const custom = context ? context.fields['input-plano-duracao-custom'] : document.getElementById('input-plano-duracao-custom');
    return this.duracao(select.value === 'custom' ? custom?.value : select.value);
  },
  _atualizarMensal(context) {
    if (context ? !this.formularioAtual(context) : !this.atual(this.contexto())) return;
    const output = context ? context.fields['display-mensal'] : document.getElementById('display-mensal'); if (!output) return;
    const price = context ? context.fields['input-plano-valor'] : document.getElementById('input-plano-valor');
    const equivalent = this.equivalente(price?.value, this._getDuracaoAtual(context));
    output.textContent = equivalent === null ? 'Informe valor e vigência válidos.' : `${this.moeda(equivalent)} por 30 dias`;
  },
  async submeterFormulario(context = this.activeForm) {
    if (!this.formularioAtual(context)) return;
    if (context.pending) return context.pending.promise;
    this._sincronizarRevisao(context); this._estadoFormulario(context, false);
    if (context.requiresCheck) return;
    const name = context.fields['input-plano-nome'].value.trim();
    const price = this.valor(context.fields['input-plano-valor'].value), durationDays = this._getDuracaoAtual(context);
    if (!this._validarFormulario(context, name, price, durationDays)) return;
    const payload = { name, price, durationDays, description: context.fields['input-plano-descricao'].value.trim() };
    const { id } = context, draft = this._rascunhoFormulario(context), pending = context.pending = {};
    context.feedback.textContent = id ? 'Salvando as alterações deste plano…' : 'Salvando o novo plano…';
    this._estadoFormulario(context, true);
    pending.promise = (async () => {
      try {
        const response = id ? await API.put(`/planos/${id}`, payload, { timeoutMs: 15000 }) : await API.post('/planos', payload, { timeoutMs: 15000 });
        // O envio já ocorreu: o resultado real é conservado mesmo se a tela foi substituída.
        if (this.formularioAtual(context)) {
          if (this._rascunhoFormulario(context) !== draft) {
            context.requiresCheck = true; context.reviewToken = {}; context.reviewedToken = null;
            context.feedback.textContent = 'O plano enviado foi salvo. O rascunho alterado durante o envio foi mantido e ainda não foi salvo. Confira os planos antes de continuar.';
            return response;
          }
          Toast.success('Plano salvo.'); Modal.close(); this.activeForm = null; await this.carregarLista();
        }
        return response;
      } catch (error) { this._falhaFormulario(context, error); }
      finally {
        if (context.pending === pending) context.pending = null;
        this._estadoFormulario(context, false);
      }
    })();
    return pending.promise;
  },
  inativarPlano(id) {
    if (!this.idValido(id) || !this.cacheAtual()) return;
    const plan = this.dados.find(item => item.id === id); if (!plan) return;
    const scope = this.contexto(); if (!this.atual(scope)) return;
    const sequence = ++this.modalSequence; this.activeForm = null;
    let context;
    Modal.open('Inativar plano', `<form id="form-plano" aria-describedby="plan-save-context plan-save-feedback"><p id="confirm-plano-inativacao">Inativar <strong>${this.escapar(plan.name)}</strong>?</p>
      <p class="management-form-intro">O plano não poderá ser escolhido para novas matrículas; pagamentos e vínculos históricos serão preservados.</p>
      ${this._confirmacaoFormulario('Confirme a mudança de disponibilidade. O histórico do plano será conservado.')}<button type="submit" hidden>Inativar plano</button></form>`, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { if (this.formularioAtual(context)) { Modal.close(); this.activeForm = null; this.modalSequence++; } } },
      { text: 'Inativar plano', class: 'btn-primary', action: () => this.submeterInativacao(context) },
    ]);
    context = this._capturarFormulario(scope, sequence, id, 'Inativar plano'); context.mode = 'deactivate';
    context.fields['confirm-plano-inativacao'] = document.getElementById('confirm-plano-inativacao');
    this._vincularFormulario(context, () => this.submeterInativacao(context));
  },
  async submeterInativacao(context) {
    if (!this.formularioAtual(context)) return;
    if (context.pending) return context.pending.promise;
    this._sincronizarRevisao(context); this._estadoFormulario(context, false);
    if (context.requiresCheck) return;
    const pending = context.pending = {};
    context.feedback.textContent = 'Inativando o plano…'; this._estadoFormulario(context, true);
    pending.promise = (async () => {
      try {
        const response = await API.delete(`/planos/${context.id}`, { timeoutMs: 15000 });
        if (this.formularioAtual(context)) { Toast.success('Plano inativado.'); Modal.close(); this.activeForm = null; await this.carregarLista(); }
        return response;
      } catch (error) { this._falhaFormulario(context, error); }
      finally { if (context.pending === pending) context.pending = null; this._estadoFormulario(context, false); }
    })();
    return pending.promise;
  },
};

if (typeof window.addEventListener === 'function') {
  window.addEventListener('auth:logout', () => { PlanosView.reviewSession++; PlanosView.uncertainReview = null; PlanosView.invalidar(); });
  window.addEventListener('app:navigate', event => { if (event.detail?.page !== 'planos') PlanosView.invalidar(); });
}
