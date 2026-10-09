/** Planos com preço total e vigência em dias; cobrança depende do fluxo de pagamento. */
const PlanosView = {
  dados: [], planoAtualId: null, saving: false,
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
  async inicializar() { this.planoAtualId = null; await this.carregarLista(); this.configurarEventos(); },
  async carregarLista() {
    const grid = document.getElementById('planos-grid'); if (!grid) return;
    grid.innerHTML = '<p role="status">Carregando planos…</p>';
    try {
      this.dados = (await API.get('/planos')).data || [];
      const sorted = [...this.dados].sort((a, b) => Number(b.active) - Number(a.active) || Number(a.durationDays) - Number(b.durationDays));
      grid.innerHTML = sorted.length ? sorted.map(plan => this.renderCard(plan)).join('') : '<p>Nenhum plano cadastrado.</p>';
      grid.onclick = event => {
        const button = event.target.closest('button[data-plan-action]'); if (!button || !grid.contains(button)) return;
        const id = Number(button.dataset.id); if (!this.idValido(id)) return;
        if (button.dataset.planAction === 'edit') this.abrirModalEdicao(id);
        if (button.dataset.planAction === 'deactivate') this.inativarPlano(id);
      };
      if (window.lucide) window.lucide.createIcons({ nodes: [grid] });
    } catch (error) { this.dados = []; grid.textContent = error.message || 'Não foi possível carregar planos.'; Toast.error('Erro ao carregar planos.'); }
  },
  renderCard(plan) {
    if (!this.idValido(plan.id)) return '';
    const value = this.valor(plan.price), duration = this.duracao(plan.durationDays);
    const equivalent = this.equivalente(plan.price, plan.durationDays);
    return `<article class="card" style="display:flex;flex-direction:column;gap:1rem;min-width:0;overflow-wrap:anywhere">
      <div><span class="badge ${plan.active ? 'badge-success' : 'badge-secondary'}">${plan.active ? 'Ativo' : 'Inativo'}</span>
        <h3>${this.escapar(plan.name)}</h3></div>
      <p style="font-size:var(--font-size-xl);font-weight:700;color:var(--primary-400)">${value === null ? 'Valor inválido' : this.moeda(value)}</p>
      <p>Valor total · vigência de ${duration === null ? 'dias não informados' : `${duration} dias`}.</p>
      <p style="font-size:var(--font-size-xs);color:var(--text-muted)">${equivalent === null ? 'Equivalência indisponível' : `${this.moeda(equivalent)} por 30 dias, como comparação aritmética.`}</p>
      <p style="flex:1">${this.escapar(plan.description || 'Sem descrição.')}</p>
      <div style="display:flex;flex-wrap:wrap;gap:.5rem">
        <button class="btn btn-secondary" type="button" data-plan-action="edit" data-id="${plan.id}">Editar plano</button>
        ${plan.active ? `<button class="btn btn-ghost" type="button" data-plan-action="deactivate" data-id="${plan.id}">Inativar plano</button>` : ''}
      </div></article>`;
  },
  configurarEventos() { const button = document.getElementById('btn-novo-plano'); if (button) button.onclick = () => this.abrirModalCriacao(); },
  abrirModalCriacao() { this.planoAtualId = null; this._abrirModal('Criar plano', {}, 'Salvar plano'); },
  abrirModalEdicao(id) {
    const plan = this.dados.find(item => item.id === id); if (!plan) return;
    this.planoAtualId = id; this._abrirModal('Editar plano', plan, 'Atualizar plano');
  },
  _abrirModal(title, plan, submitText) {
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
      </form>`, [{ text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: submitText, class: 'btn-primary', action: () => this.submeterFormulario() }]);
    this._configurarFormInteracao(); this._atualizarMensal();
  },
  _configurarFormInteracao() {
    const select = document.getElementById('input-plano-periodo');
    if (select) select.onchange = () => { document.getElementById('grupo-duracao-custom').hidden = select.value !== 'custom'; this._atualizarMensal(); };
    ['input-plano-valor', 'input-plano-duracao-custom'].forEach(id => { const input = document.getElementById(id); if (input) input.oninput = () => this._atualizarMensal(); });
  },
  _getDuracaoAtual() {
    const select = document.getElementById('input-plano-periodo'); if (!select) return null;
    return this.duracao(select.value === 'custom' ? document.getElementById('input-plano-duracao-custom')?.value : select.value);
  },
  _atualizarMensal() {
    const output = document.getElementById('display-mensal'); if (!output) return;
    const equivalent = this.equivalente(document.getElementById('input-plano-valor')?.value, this._getDuracaoAtual());
    output.textContent = equivalent === null ? 'Informe valor e vigência válidos.' : `${this.moeda(equivalent)} por 30 dias`;
  },
  async submeterFormulario() {
    if (this.saving) return;
    const form = document.getElementById('form-plano');
    const name = document.getElementById('input-plano-nome').value.trim();
    const price = this.valor(document.getElementById('input-plano-valor').value), durationDays = this._getDuracaoAtual();
    if (!name || name.length > 100 || price === null || durationDays === null) { Toast.warning('Informe nome, valor com até duas casas decimais e vigência inteira de 1 a 3650 dias.'); return; }
    const payload = { name, price, durationDays, description: document.getElementById('input-plano-descricao').value.trim() };
    const id = this.planoAtualId, button = document.querySelector('#modal-footer .btn-primary');
    this.saving = true; if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
    try {
      if (id) await API.put(`/planos/${id}`, payload); else await API.post('/planos', payload);
      Toast.success('Plano salvo.'); if (document.getElementById('form-plano') === form) Modal.close(); await this.carregarLista();
    } catch (error) { Toast.error(error.message || 'Erro ao salvar plano.'); }
    finally { this.saving = false; if (button) { button.disabled = false; button.textContent = id ? 'Atualizar plano' : 'Salvar plano'; } }
  },
  inativarPlano(id) {
    const plan = this.dados.find(item => item.id === id); if (!plan) return;
    Modal.confirm(`Inativar <strong>${this.escapar(plan.name)}</strong>? O plano não poderá ser escolhido para novas matrículas; pagamentos e vínculos históricos serão preservados.`, async () => {
      try { await API.delete(`/planos/${id}`); Toast.success('Plano inativado.'); await this.carregarLista(); }
      catch (error) { Toast.error(error.message || 'Erro ao inativar plano.'); }
    }, 'Inativar plano');
  },
};
