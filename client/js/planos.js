/** Planos com preço total e vigência em dias; cobrança depende do fluxo de pagamento. */
const PlanosView = {
  dados: [], planoAtualId: null,
  generation: 0, listSequence: 0, modalSequence: 0, activeForm: null, cacheContext: null,
  invalidar() {
    this.generation++; this.listSequence++; this.modalSequence++;
    this.dados = []; this.planoAtualId = null; this.activeForm = null; this.cacheContext = null;
  },
  contexto() {
    const user = typeof Auth === 'undefined' ? null : Auth.user;
    return { generation: this.generation, grid: document.getElementById('planos-grid'),
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
  formularioAtual(context) {
    return context && this.activeForm === context && context.sequence === this.modalSequence && this.atual(context.scope)
      && context.form && context.form.isConnected !== false && document.getElementById('form-plano') === context.form
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
    await this.carregarLista(); if (this.atual(context)) this.configurarEventos(context);
  },
  async carregarLista() {
    const context = this.contexto(), sequence = ++this.listSequence;
    if (!this.atual(context)) return;
    const grid = context.grid;
    grid.innerHTML = '<p role="status">Carregando planos…</p>';
    try {
      const response = await API.get('/planos');
      if (!this.atual(context) || sequence !== this.listSequence) return;
      this.dados = Array.isArray(response.data) ? response.data : []; this.cacheContext = context;
      const sorted = [...this.dados].sort((a, b) => Number(b.active) - Number(a.active) || Number(a.durationDays) - Number(b.durationDays));
      grid.innerHTML = sorted.length ? sorted.map(plan => this.renderCard(plan)).join('') : '<p>Nenhum plano cadastrado.</p>';
      grid.onclick = event => {
        if (!this.atual(context) || sequence !== this.listSequence) return;
        const button = event.target.closest?.('button[data-plan-action]'); if (!button || !grid.contains(button)) return;
        const id = Number(button.dataset.id); if (!this.idValido(id)) return;
        if (button.dataset.planAction === 'edit') this.abrirModalEdicao(id);
        if (button.dataset.planAction === 'deactivate') this.inativarPlano(id);
      };
      if (window.lucide) window.lucide.createIcons({ nodes: [grid] });
    } catch (error) {
      if (!this.atual(context) || sequence !== this.listSequence) return;
      this.dados = []; this.cacheContext = null; grid.textContent = error.message || 'Não foi possível carregar planos.'; Toast.error('Erro ao carregar planos.');
    }
  },
  renderCard(plan) {
    if (!this.idValido(plan.id)) return '';
    const value = this.valor(plan.price), duration = this.duracao(plan.durationDays);
    const equivalent = this.equivalente(plan.price, plan.durationDays);
    return `<article class="card workspace-plan" style="display:flex;flex-direction:column;gap:1rem;min-width:0;overflow-wrap:anywhere">
      <div><span class="badge ${plan.active ? 'badge-success' : 'badge-secondary'}">${plan.active ? 'Ativo' : 'Inativo'}</span>
        <h3>${this.escapar(plan.name)}</h3></div>
      <p class="workspace-plan-price">${value === null ? 'Valor inválido' : this.moeda(value)}</p>
      <p>Valor total · vigência de ${duration === null ? 'dias não informados' : `${duration} dias`}.</p>
      <p style="font-size:var(--font-size-xs);color:var(--text-muted)">${equivalent === null ? 'Equivalência indisponível' : `${this.moeda(equivalent)} por 30 dias, como comparação aritmética.`}</p>
      <p style="flex:1">${this.escapar(plan.description || 'Sem descrição.')}</p>
      <div style="display:flex;flex-wrap:wrap;gap:.5rem">
        <button class="btn btn-secondary" type="button" data-plan-action="edit" data-id="${plan.id}">Editar plano</button>
        ${plan.active ? `<button class="btn btn-ghost" type="button" data-plan-action="deactivate" data-id="${plan.id}">Inativar plano</button>` : ''}
      </div></article>`;
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
    Modal.open(title, `<form id="form-plano" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:1rem">
      <div class="form-group" style="grid-column:1/-1"><label for="input-plano-nome">Nome do plano</label><input type="text" id="input-plano-nome" maxlength="100" value="${this.escapar(plan.name)}" required></div>
      <div class="form-group"><label for="input-plano-periodo">Vigência</label><select id="input-plano-periodo">${options}</select></div>
      <div class="form-group" id="grupo-duracao-custom" ${custom ? '' : 'hidden'}><label for="input-plano-duracao-custom">Duração personalizada (dias)</label>
        <input type="number" id="input-plano-duracao-custom" min="1" max="3650" step="1" value="${custom ? this.escapar(plan.durationDays) : ''}"></div>
      <div class="form-group"><label for="input-plano-valor">Valor total da vigência (R$)</label><input type="number" id="input-plano-valor" min="0.01" max="99999999.99" step="0.01" value="${this.escapar(plan.price)}" required></div>
      <div class="form-group"><label for="display-mensal">Equivalente aritmético por 30 dias</label><output id="display-mensal" aria-live="polite">—</output></div>
      <div class="form-group" style="grid-column:1/-1"><label for="input-plano-descricao">Descrição e condições</label><textarea id="input-plano-descricao" maxlength="10000" rows="3">${this.escapar(plan.description)}</textarea></div>
      <p style="grid-column:1/-1;color:var(--text-muted);font-size:var(--font-size-xs)">O cadastro define valor e vigência. O pagamento é registrado ou iniciado no fluxo financeiro; o plano não agenda cobranças automáticas.</p>
      </form>`, [{ text: 'Cancelar', class: 'btn-secondary', action: () => {
        if (!this.formularioAtual(context)) return;
        Modal.close(); this.activeForm = null; this.modalSequence++;
      } }, { text: submitText, class: 'btn-primary', action: () => this.submeterFormulario(context) }]);
    context = { scope, sequence, id, form: document.getElementById('form-plano'),
      button: document.querySelector?.('#modal-footer .btn-primary'), fields: {}, pending: null };
    for (const field of ['input-plano-nome', 'input-plano-periodo', 'input-plano-duracao-custom', 'grupo-duracao-custom',
      'input-plano-valor', 'display-mensal', 'input-plano-descricao']) context.fields[field] = document.getElementById(field);
    this.activeForm = context;
    if (context.form) context.form.onsubmit = event => { event.preventDefault(); return this.submeterFormulario(context); };
    this._configurarFormInteracao(context); this._atualizarMensal(context);
  },
  _configurarFormInteracao(context) {
    const select = context.fields['input-plano-periodo'];
    if (select) select.onchange = () => {
      if (!this.formularioAtual(context)) return;
      context.fields['grupo-duracao-custom'].hidden = select.value !== 'custom'; this._atualizarMensal(context);
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
    if (context.pending) return context.pending;
    const name = context.fields['input-plano-nome'].value.trim();
    const price = this.valor(context.fields['input-plano-valor'].value), durationDays = this._getDuracaoAtual(context);
    if (!name || name.length > 100 || price === null || durationDays === null) { Toast.warning('Informe nome, valor com até duas casas decimais e vigência inteira de 1 a 3650 dias.'); return; }
    if (context.form.reportValidity && !context.form.reportValidity()) return;
    const payload = { name, price, durationDays, description: context.fields['input-plano-descricao'].value.trim() };
    const { id, button } = context, label = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
    context.pending = (async () => {
      try {
        const response = id ? await API.put(`/planos/${id}`, payload) : await API.post('/planos', payload);
        // O envio já ocorreu: o resultado real é conservado mesmo se a tela foi substituída.
        if (this.formularioAtual(context)) {
          Toast.success('Plano salvo.'); Modal.close(); this.activeForm = null; await this.carregarLista();
        }
        return response;
      } catch (error) { if (this.formularioAtual(context)) Toast.error(error.message || 'Erro ao salvar plano.'); }
      finally {
        context.pending = null;
        if (this.formularioAtual(context) && button && button.isConnected !== false) { button.disabled = false; button.textContent = label; }
      }
    })();
    return context.pending;
  },
  inativarPlano(id) {
    if (!this.idValido(id) || !this.cacheAtual()) return;
    const plan = this.dados.find(item => item.id === id); if (!plan) return;
    const scope = this.contexto(); if (!this.atual(scope)) return;
    const sequence = ++this.modalSequence; this.activeForm = null;
    let anchor, pending;
    const current = () => sequence === this.modalSequence && this.atual(scope);
    const ownsModal = () => current() && anchor && anchor.isConnected !== false
      && document.getElementById('confirm-plano-inativacao') === anchor && (typeof Modal.isOpen !== 'function' || Modal.isOpen());
    Modal.open('Inativar plano', `<p id="confirm-plano-inativacao">Inativar <strong>${this.escapar(plan.name)}</strong>? O plano não poderá ser escolhido para novas matrículas; pagamentos e vínculos históricos serão preservados.</p>`, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { if (ownsModal()) { Modal.close(); this.modalSequence++; } } },
      { text: 'Inativar plano', class: 'btn-primary', action: () => {
        if (pending) return pending;
        if (!ownsModal()) return;
        Modal.close();
        pending = (async () => {
          try {
            const response = await API.delete(`/planos/${id}`);
            if (current()) { Toast.success('Plano inativado.'); await this.carregarLista(); }
            return response;
          } catch (error) { if (current()) Toast.error(error.message || 'Erro ao inativar plano.'); }
        })();
        return pending;
      } },
    ]);
    anchor = document.getElementById('confirm-plano-inativacao');
  },
};

if (typeof window.addEventListener === 'function') {
  window.addEventListener('auth:logout', () => PlanosView.invalidar());
  window.addEventListener('app:navigate', event => { if (event.detail?.page !== 'planos') PlanosView.invalidar(); });
}
