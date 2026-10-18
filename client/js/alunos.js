/**
 * ============================================================================
 * FitFlow Caraguá — Módulo de Alunos do Frontend
 * ============================================================================
 * Lida com chamadas à API e renderização dinâmica da tabela de alunos,
 * modais de formulário e exclusão (soft-delete).
 */

const AlunosView = {
  // Estado local para evitar requisições desnecessárias a todo momento
  dados: [],
  alunoAtualId: null,
  generation: 0,
  listSequence: 0,
  modalSequence: 0,
  activeForm: null,
  autocompleteInput: null,
  invalidar() {
    this.generation++; this.listSequence++; this.modalSequence++;
    this.dados = []; this.alunoAtualId = null; this.activeForm = null; this.autocompleteInput = null;
  },
  contexto() {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    return { generation: this.generation, table: document.getElementById('alunos-table-body'),
      userId: user?.id, role: user?.role, authGeneration: typeof Auth !== 'undefined' ? Auth.generation : null,
      epoch: typeof Auth !== 'undefined' && typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null };
  },
  atual(context) {
    return context && context.generation === this.generation && context.table && context.table.isConnected !== false
      && document.getElementById('alunos-table-body') === context.table
      && typeof Auth !== 'undefined' && Auth.user?.id === context.userId && context.role === 'admin' && Auth.user?.role === context.role
      && Auth.generation === context.authGeneration
      && (typeof Auth.getSessionEpoch !== 'function' || (Auth.sessionEpoch === context.epoch && Auth.getSessionEpoch() === context.epoch))
      && (typeof App === 'undefined' || App.currentPage === 'alunos');
  },
  formularioAtual(context) {
    return context && this.activeForm === context && context.sequence === this.modalSequence && this.atual(context)
      && context.form?.isConnected !== false && document.getElementById('form-aluno') === context.form
      && (typeof Modal.isOpen !== 'function' || Modal.isOpen());
  },
  vincularFormulario(id) {
    const context = { ...this.contexto(), sequence: ++this.modalSequence, id, form: document.getElementById('form-aluno'),
      button: document.querySelectorAll('#modal-footer .btn-primary')[0], pending: null };
    this.activeForm = context;
    if (context.form) context.form.onsubmit = event => { event.preventDefault(); return this.submeterFormulario(context); };
    return context;
  },

  /**
   * Ponto de entrada: Chamado pelo app.js ao abrir a tela "alunos".
   */
  async inicializar() {
    this.invalidar();
    const context = this.contexto();
    if (!this.atual(context)) return;
    this.configurarEventos(context);
    await this.carregarLista();
  },

  /**
   * Busca alunos via API e renderiza as linhas na tabela.
   */
  async carregarLista() {
    const context = this.contexto(), sequence = ++this.listSequence;
    if (!this.atual(context)) return;
    const tableBody = context.table;
    const search = document.getElementById('filtro-nome-aluno');
    const current = () => sequence === this.listSequence && this.atual(context);

    try {
      if (search) search.disabled = true;
      tableBody.innerHTML = `<tr><td colspan="5" role="status" style="text-align:center"><div class="spinner spinner-sm"></div> Carregando...</td></tr>`;
      
      const response = await API.get('/alunos');
      if (!current()) return;
      this.dados = response.data;

      this.renderTabela(this.dados);
      if (search && document.getElementById('filtro-nome-aluno') === search) search.disabled = false;
      this.iniciarAutocomplete(context);

    } catch (error) {
      if (!current()) return;
      this.dados = []; this.autocompleteData = [];
      tableBody.innerHTML = `<tr><td colspan="5"><section class="management-list-state" role="alert"><h3>Não foi possível carregar os alunos</h3><p>${FitFlowSecurity.escapeHtml(error.message || 'Confira a conexão e tente novamente.')}</p><button type="button" class="btn btn-secondary" data-alunos-retry>Tentar novamente</button></section></td></tr>`;
      tableBody.onclick = event => {
        if (!current()) return;
        const button = event.target?.closest?.('button[data-alunos-retry]');
        if (button && tableBody.contains(button)) return this.carregarLista();
      };
    }
  },

  renderTabela(dados) {
    const tableBody = document.getElementById('alunos-table-body');
    if (!tableBody) return;
    const context = this.contexto();
    tableBody.onclick = event => {
      if (!this.atual(context)) return;
      const button = event.target?.closest?.('button[data-aluno-action]');
      if (!button || !tableBody.contains(button) || !/^[1-9]\d*$/.test(button.dataset.alunoId || '')) return;
      const id = Number(button.dataset.alunoId);
      if (!Number.isSafeInteger(id)) return;
      if (button.dataset.alunoAction === 'edit') this.abrirModalEdicao(id);
      else if (button.dataset.alunoAction === 'deactivate') this.inativarAluno(id);
    };

    if (dados.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5"><div class="management-list-state" role="status"><h3>Nenhum aluno encontrado</h3><p>Confira a busca ou cadastre uma nova matrícula.</p></div></td></tr>`;
      return;
    }

    tableBody.innerHTML = dados.map(aluno => `
      <tr data-id="${Number(aluno.id)}" class="${aluno.status === 'inactive' ? 'aluno-inativo' : ''}">
        <td>
          <strong>${FitFlowSecurity.escapeHtml(aluno.user.name)}</strong><br>
          <small style="color:var(--text-muted)">${FitFlowSecurity.escapeHtml(aluno.user.email)}</small>
        </td>
        <td>${FitFlowSecurity.escapeHtml(aluno.cpf || '-')}</td>
        <td>${aluno.plan ? FitFlowSecurity.escapeHtml(aluno.plan.name) : '<span class="badge badge-warning">Sem Plano</span>'}</td>
        <td>
           <span class="badge ${aluno.status === 'active' ? 'badge-success' : 'badge-danger'}">
             ${aluno.status === 'active' ? 'Ativo' : aluno.status === 'blocked' ? 'Bloqueado' : 'Inativo'}
           </span>
        </td>
        <td>
          <button type="button" class="btn btn-icon btn-outline-primary" title="Editar" data-aluno-action="edit" data-aluno-id="${Number(aluno.id)}">
            <i data-lucide="edit-3"></i>
          </button>
          <button type="button" class="btn btn-icon btn-outline-danger" title="Inativar" data-aluno-action="deactivate" data-aluno-id="${Number(aluno.id)}">
            <i data-lucide="user-x"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Renderiza ícones injetados
    if (window.lucide) {
      lucide.createIcons({ nodes: [tableBody] });
    }
  },

  iniciarAutocomplete(context = this.contexto()) {
    const input = document.getElementById('filtro-nome-aluno');
    if (!input || !this.atual(context)) return;
    if (input === this.autocompleteInput) {
      this.autocompleteData.splice(0, this.autocompleteData.length, ...this.dados.map(a => ({ id: a.id, label: a.user ? a.user.name : `Aluno #${a.id}` })));
      return;
    }
    if (typeof Autocomplete !== 'undefined') {
      this.autocompleteInput = input;
      // The component retains its array; refresh its contents on list reloads.
      const autocompleteData = this.autocompleteData = this.dados.map(a => ({ id: a.id, label: a.user ? a.user.name : `Aluno #${a.id}` }));
      Autocomplete.init('filtro-nome-aluno', autocompleteData, (selected) => {
        if (!this.atual(context) || input.isConnected === false || document.getElementById('filtro-nome-aluno') !== input) return;
        if (selected) {
          const filtrado = this.dados.filter(a => a.id === selected.id);
          this.renderTabela(filtrado);
        } else {
          this.renderTabela(this.dados);
        }
      });
    }
  },

  /**
   * Prepara os ouvintes de clique para botões de Novo Cadastro e Salvar Modal.
   */
  configurarEventos(context = this.contexto()) {
    const btnNovo = document.getElementById('btn-novo-aluno');
    if (btnNovo) {
      btnNovo.onclick = () => { if (this.atual(context) && document.getElementById('btn-novo-aluno') === btnNovo) this.abrirModalCriacao(); };
    }
  },

  abrirModalCriacao() {
    if (!this.atual(this.contexto())) return;
    this.alunoAtualId = null; 

    const bodyHTML = `
      <form id="form-aluno" class="management-form">
        <p class="management-form-intro">Cadastre o aluno e associe um plano à matrícula. Campos com * são obrigatórios.</p>
        <fieldset class="management-form-section"><legend><span>01</span> Dados do aluno</legend><div class="management-fields">
        <div class="form-group management-wide">
          <label for="input-aluno-nome">Nome completo *</label>
          <input type="text" id="input-aluno-nome" autocomplete="name" required>
        </div>
        <div class="form-group">
          <label for="input-aluno-cpf">CPF</label>
          <input type="text" id="input-aluno-cpf" inputmode="numeric" placeholder="Apenas números">
        </div>
        <div class="form-group">
          <label for="input-aluno-telefone">Telefone</label>
          <input type="tel" id="input-aluno-telefone" autocomplete="tel">
        </div></div></fieldset>
        <fieldset class="management-form-section"><legend><span>02</span> Acesso ao FitFlow</legend><div class="management-fields">
        <div class="form-group">
          <label for="input-aluno-email">E-mail *</label>
          <input type="email" id="input-aluno-email" autocomplete="email" required>
        </div>
        <div class="form-group">
          <label for="input-aluno-senha">Senha inicial *</label>
          <input type="password" id="input-aluno-senha" autocomplete="new-password" minlength="8" maxlength="72" aria-describedby="aluno-password-help" required>
        </div></div><p id="aluno-password-help" class="management-help">Use pelo menos 8 caracteres, até 72 bytes UTF-8. O aluno poderá alterar a senha após entrar.</p></fieldset>
        <fieldset class="management-form-section"><legend><span>03</span> Matrícula</legend>
        <div class="form-group">
          <label for="input-aluno-plano">Plano associado *</label>
          <select id="input-aluno-plano" aria-describedby="aluno-planos-status" required disabled>
            <option value="">Carregando planos...</option>
          </select>
          <p id="aluno-planos-status" class="management-help" role="status" aria-live="polite">Consultando planos ativos. Os outros campos podem ser preenchidos enquanto isso.</p>
          <button id="aluno-planos-retry" class="btn btn-secondary" type="button" hidden>Consultar planos novamente</button>
        </div></fieldset>
      </form>
    `;

    let context;
    Modal.open('Nova matrícula', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { if (this.formularioAtual(context)) Modal.close(); } },
      { text: 'Criar matrícula', class: 'btn-primary', action: () => this.submeterFormulario(context) },
    ]);
    context = this.vincularFormulario(null);
    const select = context.form.querySelector('#input-aluno-plano');
    select.onchange = () => this.atualizarEstadoPlanos(context);
    context.form.querySelector('#aluno-planos-retry').onclick = () => this.carregarPlanosSelect(context);
    this.carregarPlanosSelect(context);
  },

  atualizarEstadoPlanos(context) {
    if (!this.formularioAtual(context) || context.id !== null) return;
    const select = context.form.querySelector('#input-aluno-plano'), ready = context.planState === 'ready';
    const selected = ready && context.planIds?.has(select.value);
    select.disabled = !ready;
    select.setAttribute('aria-busy', String(context.planState === 'loading'));
    context.form.querySelector('#aluno-planos-status').textContent = selected
      ? 'Plano ativo selecionado. Confira os demais campos antes de criar a matrícula.' : context.planMessage;
    const retry = context.form.querySelector('#aluno-planos-retry');
    retry.hidden = !['error', 'empty'].includes(context.planState);
    retry.disabled = context.planState === 'loading' || !!context.pending;
    if (context.button) context.button.disabled = !!context.pending || !selected;
  },

  async carregarPlanosSelect(context = this.activeForm) {
    if (!this.formularioAtual(context) || context.id !== null || context.pending) return;
    if (context.planLookup) return context.planLookup.promise;
    const select = context.form.querySelector('#input-aluno-plano');
    if (!select) return;
    const selected = context.planState === 'ready' && context.planIds?.has(select.value) ? select.value : '';
    const current = () => this.formularioAtual(context) && document.getElementById('input-aluno-plano') === select;
    context.planState = 'loading'; context.planIds = new Set();
    context.planMessage = 'Consultando planos ativos. Os outros campos podem ser preenchidos enquanto isso.';
    this.atualizarEstadoPlanos(context);
    const lookup = context.planLookup = {};
    lookup.promise = (async () => {
      try {
        const resp = await API.get('/planos?ativo=true', { timeoutMs: 15000 });
        if (!current()) return;
        const planos = resp?.data;
        if (!Array.isArray(planos) || planos.some(p => !p || !Number.isSafeInteger(p.id) || p.id < 1 || p.active !== true
          || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100
          || !['number', 'string'].includes(typeof p.price) || !/^\d+(?:\.\d{1,2})?$/.test(String(p.price))
          || !Number.isFinite(Number(p.price)) || Number(p.price) < 0.01 || Number(p.price) > 99999999.99)
          || new Set(planos.map(p => p.id)).size !== planos.length) {
          context.planMessage = 'Não foi possível confirmar os planos recebidos. Consulte novamente antes de criar a matrícula.';
          context.planState = 'error';
        } else {
          context.planIds = new Set(planos.map(p => String(p.id)));
          context.planState = planos.length ? 'ready' : 'empty';
          context.planMessage = planos.length ? 'Selecione um plano ativo para criar a matrícula.'
            : 'Nenhum plano ativo foi encontrado. Cadastre ou ative um plano na seção Planos e consulte novamente. Os campos preenchidos permanecem neste formulário.';
          select.innerHTML = '<option value="">Selecione um plano</option>' +
            planos.map(p => `<option value="${p.id}">${FitFlowSecurity.escapeHtml(p.name)} · ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.price))}</option>`).join('');
          select.value = context.planIds.has(selected) ? selected : '';
        }
      } catch {
        if (!current()) return;
        context.planState = 'error';
        context.planMessage = 'Não foi possível consultar os planos. Confira a conexão e tente novamente. Os campos preenchidos permanecem neste formulário.';
      } finally {
        if (context.planLookup === lookup) context.planLookup = null;
        if (current()) {
          if (context.planState === 'error' || context.planState === 'empty') { select.innerHTML = '<option value="">Nenhum plano disponível para seleção</option>'; select.value = ''; }
          this.atualizarEstadoPlanos(context);
        }
      }
    })();
    return lookup.promise;
  },

  /**
   * Preenche o modal de edição com os dados do aluno.
   */
  abrirModalEdicao(id) {
    if (!Number.isSafeInteger(id) || id < 1 || !this.atual(this.contexto())) return;
    const aluno = this.dados.find(a => a.id === id);
    if (!aluno) return;
    this.alunoAtualId = id;

    let dataNascimento = '';
    if (aluno.birthDate) {
      dataNascimento = aluno.birthDate.split('T')[0];
    }

    const bodyHTML = `
      <form id="form-aluno" class="management-form">
        <p class="management-form-intro">Atualize os dados cadastrais do aluno. Campos com * são obrigatórios.</p>
        <fieldset class="management-form-section"><legend><span>01</span> Identificação</legend><div class="management-fields">
        <div class="form-group management-wide">
          <label for="input-aluno-nome">Nome completo *</label>
          <input type="text" id="input-aluno-nome" autocomplete="name" value="${FitFlowSecurity.escapeHtml(aluno.user.name)}" required>
        </div>
        <div class="form-group">
          <label for="input-aluno-cpf">CPF</label>
          <input type="text" id="input-aluno-cpf" inputmode="numeric" value="${FitFlowSecurity.escapeHtml(aluno.cpf || '')}">
        </div>
        <div class="form-group">
          <label for="input-aluno-aniversario">Nascimento</label>
          <input type="date" id="input-aluno-aniversario" autocomplete="bday" value="${FitFlowSecurity.escapeHtml(dataNascimento)}">
        </div></div></fieldset>
        <fieldset class="management-form-section"><legend><span>02</span> Contato</legend><div class="management-fields">
        <div class="form-group">
          <label for="input-aluno-email">E-mail da conta</label>
          <input type="email" id="input-aluno-email" value="${FitFlowSecurity.escapeHtml(aluno.user.email)}" disabled>
        </div>
        <div class="form-group">
          <label for="input-aluno-telefone">Telefone</label>
          <input type="tel" id="input-aluno-telefone" autocomplete="tel" value="${FitFlowSecurity.escapeHtml(aluno.phone || '')}">
        </div></div></fieldset>
      </form>
    `;

    let context;
    Modal.open('Editar aluno', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { if (this.formularioAtual(context)) Modal.close(); } },
      { text: 'Salvar Alterações', class: 'btn-primary', action: () => this.submeterFormulario(context) },
    ]);
    context = this.vincularFormulario(id);
  },

  /**
   * Lida com Envios convertidos de função pura
   */
  async submeterFormulario(context = this.activeForm) {
    if (!this.formularioAtual(context)) return;
    if (context.pending) return context.pending;
    if (context.id === null && (context.planState !== 'ready' || !context.planIds?.has(context.form.querySelector('#input-aluno-plano')?.value))) {
      this.atualizarEstadoPlanos(context); return;
    }
    if (!context.form.reportValidity()) return;
    const value = id => context.form.querySelector(`#input-aluno-${id}`)?.value;
    const name = value('nome'), email = value('email');
    if (!name?.trim() || !email?.trim()) {
      Toast.error('Nome e email são obrigatórios.');
      return;
    }
    const payload = {
      name, email, cpf: value('cpf') ?? '', phone: value('telefone') ?? '',
      birthDate: value('aniversario'), planId: value('plano'),
    };
    if (context.id === null) {
      const password = value('senha');
      if (!password || password.length < 8 || new TextEncoder().encode(password).length > 72) {
        Toast.error('Informe uma senha própria com pelo menos 8 caracteres e até 72 bytes.');
        return;
      }
      payload.password = password;
    }
    const button = context.button, label = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Salvando...'; }
    // All callers for this form share one request. ID, values and DOM belong to
    // this capture; a later modal/account can never receive its completion.
    context.pending = (async () => {
      try {
        const response = context.id === null ? await API.post('/alunos', payload) : await API.put(`/alunos/${context.id}`, payload);
        if (this.formularioAtual(context)) {
          Toast.success(context.id === null ? 'Aluno matriculado com sucesso!' : 'Aluno atualizado com sucesso!');
          Modal.close(); this.activeForm = null;
          await this.carregarLista();
        }
        return response;
      } catch (error) {
        if (this.formularioAtual(context)) Toast.error(error.message || 'Erro ao processar instrução.');
      } finally {
        context.pending = null;
        if (this.formularioAtual(context) && button && button.isConnected !== false) {
          button.disabled = false; button.textContent = label;
          if (context.id === null) this.atualizarEstadoPlanos(context);
        }
      }
    })();
    return context.pending;
  },

  /**
   * Trata o Hard/Soft Delete disparando requisição na API.
   */
  async inativarAluno(id) {
    if (!Number.isSafeInteger(id) || id < 1) return;
    const context = this.contexto();
    if (!this.atual(context)) return;
    const sequence = ++this.modalSequence; this.activeForm = null;
    let node, pending = false;
    const current = () => sequence === this.modalSequence && this.atual(context);
    const ownsModal = () => current() && node?.isConnected !== false && document.getElementById('confirm-aluno-inativacao') === node;
    Modal.open('Inativar aluno', '<p id="confirm-aluno-inativacao">Deseja inativar este aluno? O histórico financeiro será mantido.</p>', [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { if (ownsModal()) Modal.close(); } },
      { text: 'Inativar aluno', class: 'btn-danger', action: async () => {
        if (!ownsModal() || pending) return;
        pending = true; Modal.close();
        try {
          await API.delete(`/alunos/${id}`);
          if (!current()) return;
          Toast.success('Aluno inativado. O histórico foi preservado.'); await this.carregarLista();
        } catch (error) { if (current()) Toast.error('Erro ao inativar: ' + error.message); }
      } },
    ]);
    node = document.getElementById('confirm-aluno-inativacao');
  }
};
if (typeof window.addEventListener === 'function') {
  window.addEventListener('auth:logout', () => AlunosView.invalidar());
  window.addEventListener('navigate', event => { if (event.detail?.page !== 'alunos') AlunosView.invalidar(); });
}
