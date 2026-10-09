/**
 * ============================================================================
 * FitFlow Caraguá — Módulo de Pagamentos do Frontend (TASK 07)
 * ============================================================================
 * Gerencia a interface financeira do sistema:
 * - Tabela de pagamentos com filtros (status, aluno)
 * - Modal de registro de novo pagamento
 * - Histórico por aluno
 * - Painel de inadimplentes
 * - Verificação manual de inadimplência
 */

// Persistimos só identificadores opacos, nunca os campos financeiros/observações.
// O snapshot privado é mantido em memória e removido ao sair da conta.
const ManualPaymentPending = {
  snapshots: new Map(),
  key: actor => `fitflow_manual_payment_v1:${actor}`,
  identity() {
    if (typeof Auth === 'undefined' || Auth.user?.role !== 'admin' || !Number.isSafeInteger(Auth.user.id)) throw new Error('Entre com uma conta de administrador.');
    return { actor: Auth.user.id, generation: Auth.generation };
  },
  current(identity) { return typeof Auth !== 'undefined' && Auth.user?.id === identity.actor && Auth.user.role === 'admin' && Auth.generation === identity.generation; },
  read(actor) {
    const raw = localStorage.getItem(this.key(actor));
    if (!raw) return null;
    let saved;
    try { saved = JSON.parse(raw); } catch { throw new Error('Não foi possível recuperar o envio anterior. Verifique os recebimentos antes de continuar.'); }
    if (!saved || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(saved.id)
      || !/^[a-f0-9]{64}$/.test(saved.fingerprint) || typeof saved.rejected !== 'boolean'
      || (saved.confirmed !== undefined && typeof saved.confirmed !== 'boolean')
      || Object.keys(saved).some(key => !['id', 'fingerprint', 'rejected', 'confirmed'].includes(key))) throw new Error('O envio anterior precisa ser revisado antes de registrar outro recebimento.');
    return saved;
  },
  write(actor, saved) { localStorage.setItem(this.key(actor), JSON.stringify({ id: saved.id, fingerprint: saved.fingerprint, rejected: !!saved.rejected, confirmed: !!saved.confirmed })); },
  clear(actor, id) {
    if (this.read(actor)?.id === id) localStorage.removeItem(this.key(actor));
    if (this.snapshots.get(actor)?.idempotencyKey === id) this.snapshots.delete(actor);
  },
  confirm(actor, id) {
    return this.withLock(actor, () => {
      const saved = this.read(actor);
      if (saved?.id === id) this.write(actor, { ...saved, rejected: false, confirmed: true });
      if (this.snapshots.get(actor)?.idempotencyKey === id) this.snapshots.delete(actor);
    });
  },
  withLock(actor, reserve) {
    if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') throw new Error('Este navegador não permite proteger envios entre abas. Use uma versão atual do Chrome, Edge, Firefox ou Safari. Nenhum registro foi enviado.');
    return navigator.locks.request(this.key(actor), { mode: 'exclusive' }, reserve);
  },
  async fingerprint(payload, actor) {
    if (typeof crypto === 'undefined' || !crypto.subtle || typeof crypto.randomUUID !== 'function') throw new Error('Use uma conexão HTTPS para registrar recebimentos com segurança.');
    const [whole, fraction = ''] = String(payload.amount).split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    const text = JSON.stringify(['manual-payment-v1', actor, payload.studentId, payload.planId ?? null,
      cents, payload.paymentMethod ?? null, payload.paymentDate ?? null, payload.notes ?? null]);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  },
};

if (typeof window.addEventListener === 'function') window.addEventListener('auth:logout', event => {
  ManualPaymentPending.snapshots.delete(event.detail?.userId);
  // UUID/fingerprint não autenticam e não contêm os campos pessoais do pedido.
  // Permanecem para reconciliação quando o mesmo responsável entrar novamente.
  PagamentosView._paymentSubmission = null;
  PagamentosView._lastConfirmedRequest = null;
  PagamentosView._paymentModalGeneration = (PagamentosView._paymentModalGeneration || 0) + 1;
});

const PagamentosView = {
  dados: [],
  alunos: [],
  planos: [],
  filtroAtual: { status: '', studentId: '' },

  /**
   * Ponto de entrada: carrega dados e configura eventos.
   */
  async inicializar() {
    await Promise.all([
      this.carregarLista(),
      this.carregarAlunos(),
      this.carregarPlanos(),
    ]);
    this.configurarEventos();
  },

  /**
   * Busca a lista de alunos para os selects do formulário e filtros.
   */
  async carregarAlunos() {
    try {
      const resp = await API.get('/alunos');
      this.alunos = resp.data || [];
      this.popularFiltroAluno();
    } catch (e) {
      console.warn('PagamentosView: erro ao carregar alunos', e.message);
    }
  },

  /**
   * Busca a lista de planos ativos para o select do formulário.
   */
  async carregarPlanos() {
    try {
      const resp = await API.get('/planos');
      this.planos = (resp.data || []).filter(p => p.active);
    } catch (e) {
      console.warn('PagamentosView: erro ao carregar planos', e.message);
    }
  },

  /**
   * Inicializa o Autocomplete para filtro de aluno na tabela.
   */
  popularFiltroAluno() {
    if (typeof Autocomplete !== 'undefined') {
      const autocompleteData = this.alunos.map(a => ({
        id: a.id,
        label: a.user ? a.user.name : `Aluno #${a.id}`
      }));
      Autocomplete.init('filtro-aluno-pagamento', autocompleteData, (selected) => {
        this.filtroAtual.studentId = selected ? selected.id : '';
        this.carregarLista();
      });
    }
  },

  /**
   * Carrega a lista principal de pagamentos com os filtros atuais.
   */
  async carregarLista() {
    const tbody = document.getElementById('pagamentos-table-body');
    if (!tbody) return;
    tbody.onclick = event => {
      const button = event.target?.closest?.('button[data-payment-details]');
      if (!button || !tbody.contains(button) || !/^[1-9]\d*$/.test(button.dataset.paymentDetails || '')) return;
      const id = Number(button.dataset.paymentDetails);
      if (Number.isSafeInteger(id)) this.verDetalhes(id);
    };

    try {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">
        <div class="spinner spinner-sm" style="margin:0 auto;"></div>
        <p style="margin-top:0.5rem; color:var(--text-muted)">Carregando pagamentos...</p>
      </td></tr>`;

      // Monta query string com filtros
      let queryParts = [];
      if (this.filtroAtual.status) queryParts.push(`status=${this.filtroAtual.status}`);
      if (this.filtroAtual.studentId) queryParts.push(`studentId=${this.filtroAtual.studentId}`);
      const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const resp = await API.get(`/pagamentos${query}`);
      this.dados = resp.data || [];

      if (this.dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted)">
          Nenhum pagamento encontrado.
        </td></tr>`;
        return;
      }

      tbody.innerHTML = this.dados.map(p => {
        const nomeAluno = FitFlowSecurity.escapeHtml(p.student?.user?.name || '—');
        const nomePlano = FitFlowSecurity.escapeHtml(p.plan?.name || 'Sem plano');
        const valor = `R$ ${parseFloat(p.amount).toFixed(2).replace('.', ',')}`;
        const dataPgto = this.formatarData(p.paymentDate);
        const dataVenc = this.formatarData(p.dueDate);
        const statusBadge = this.renderBadgeStatus(p.status);
        const metodo = this.formatarMetodo(p.paymentMethod);

        return `
          <tr>
            <td>
              <div style="font-weight:600">${nomeAluno}</div>
              <div style="font-size:0.75rem; color:var(--text-muted)">${nomePlano}</div>
            </td>
            <td style="font-weight:600; color:var(--primary-400)">${valor}</td>
            <td>${metodo}</td>
            <td>${dataPgto}</td>
            <td>${dataVenc}</td>
            <td>${statusBadge}</td>
            <td>
              <div class="table-actions">
                <button type="button" class="btn-icon" title="Ver detalhes" data-payment-details="${Number(p.id)}">
                  <i data-lucide="eye"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Recria ícones Lucide
      if (window.lucide) lucide.createIcons({ nodes: [tbody] });

    } catch (error) {
      Toast.error('Erro ao carregar pagamentos: ' + error.message);
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--error); text-align:center; padding:2rem;">
        Erro ao carregar dados financeiros.
      </td></tr>`;
    }
  },

  /**
   * Configura os eventos de clique nos botões da página.
   */
  configurarEventos() {
    const btnNovo = document.getElementById('btn-novo-pagamento');
    if (btnNovo) btnNovo.onclick = () => this.abrirModalRegistro();

    const btnInadimplentes = document.getElementById('btn-ver-inadimplentes');
    if (btnInadimplentes) btnInadimplentes.onclick = () => this.abrirModalInadimplentes();

    // Filtro de status
    const filtroStatus = document.getElementById('filtro-status-pagamento');
    if (filtroStatus) {
      filtroStatus.onchange = () => {
        this.filtroAtual.status = filtroStatus.value;
        this.carregarLista();
      };
    }

    // Filtro de aluno tratado pelo Autocomplete
  },

  /**
   * Abre o modal para registrar um novo pagamento.
   */
  async abrirModalRegistro() {
    let identity;
    let pending;
    try {
      identity = ManualPaymentPending.identity();
      pending = ManualPaymentPending.read(identity.actor);
      if (pending && this._lastConfirmedRequest?.actor === identity.actor && this._lastConfirmedRequest.id === pending.id) {
        // Só uma nova abertura deliberada após confirmação desta conta inicia
        // outra intenção. O recibo opaco continua disponível para abas atrasadas.
        await ManualPaymentPending.withLock(identity.actor, () => {
          if (ManualPaymentPending.current(identity)) ManualPaymentPending.clear(identity.actor, pending.id);
        });
        if (!ManualPaymentPending.current(identity)) return;
        pending = ManualPaymentPending.read(identity.actor);
        this._lastConfirmedRequest = null;
      }
    } catch (error) { Toast.error(error.message); return; }
    this._paymentModalGeneration = (this._paymentModalGeneration || 0) + 1;
    // Gera opções de alunos
    const opcoesAlunos = this.alunos.map(a => {
      const nome = FitFlowSecurity.escapeHtml(a.user ? a.user.name : `Aluno #${a.id}`);
      const planoAtual = a.plan ? ` (${FitFlowSecurity.escapeHtml(a.plan.name)})` : '';
      return `<option value="${Number(a.id)}">${nome}${planoAtual}</option>`;
    }).join('');

    // Gera opções de planos
    const opcoesPlanos = this.planos.map(p => {
      return `<option value="${Number(p.id)}">${FitFlowSecurity.escapeHtml(p.name)} — R$ ${parseFloat(p.price).toFixed(2).replace('.', ',')}</option>`;
    }).join('');

    // Data de hoje para o campo de data
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const civil = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const hoje = `${civil.year}-${civil.month}-${civil.day}`;

    const bodyHTML = `
      ${pending ? '<p role="status">Há um envio anterior sem confirmação. Verifique se ele foi registrado ou preencha os mesmos dados para tentar novamente.</p>' : ''}
      <form id="form-pagamento" class="form-grid">
        <div class="form-group" style="grid-column: span 2;">
          <label for="input-pgto-aluno">Aluno *</label>
          <select id="input-pgto-aluno" required>
            <option value="">Selecione o aluno</option>
            ${opcoesAlunos}
          </select>
        </div>
        <div class="form-group">
          <label for="input-pgto-plano">Plano</label>
          <select id="input-pgto-plano">
            <option value="">Usar plano atual do aluno</option>
            ${opcoesPlanos}
          </select>
        </div>
        <div class="form-group">
          <label for="input-pgto-valor">Valor (R$) *</label>
          <input type="number" step="0.01" min="0.01" id="input-pgto-valor" placeholder="Ex: 89.90" required>
        </div>
        <div class="form-group">
          <label for="input-pgto-data">Data do Pagamento</label>
          <input type="date" id="input-pgto-data" value="${hoje}">
        </div>
        <div class="form-group">
          <label for="input-pgto-metodo">Método de Pagamento</label>
          <select id="input-pgto-metodo">
            <option value="">Selecione</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="cartao_credito">Cartão de Crédito</option>
            <option value="cartao_debito">Cartão de Débito</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
          </select>
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label for="input-pgto-notas">Observações</label>
          <textarea id="input-pgto-notas" rows="2" placeholder="Anotações sobre este pagamento..."></textarea>
        </div>
      </form>

      <div style="background:var(--bg-elevated); border-radius:var(--radius-md); padding:0.75rem 1rem; margin-top:0.5rem;">
        <p style="font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="info" style="width:16px; height:16px; flex-shrink:0;"></i>
          Registre somente um pagamento já recebido. Este lançamento manual não cobra nem verifica Pix ou cartão. O vencimento será calculado pelo plano.
        </p>
      </div>
    `;

    Modal.open('Registrar pagamento recebido', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { this._paymentModalGeneration++; Modal.close(); } },
      ...(pending ? [{ text: 'Verificar envio anterior', class: 'btn-secondary', action: () => this.verificarEnvioAnterior() }] : []),
      { text: 'Registrar recebimento', class: 'btn-success', action: () => this.submeterPagamento() },
    ]);

    // Ao selecionar aluno, preenche o valor com o preço do plano atual
    setTimeout(() => {
      const selectAluno = document.getElementById('input-pgto-aluno');
      if (selectAluno) {
        selectAluno.onchange = () => {
          const alunoSelecionado = this.alunos.find(a => a.id === parseInt(selectAluno.value));
          if (alunoSelecionado?.plan?.price) {
            const valorInput = document.getElementById('input-pgto-valor');
            if (valorInput && !valorInput.value) {
              valorInput.value = parseFloat(alunoSelecionado.plan.price).toFixed(2);
            }
          }
        };
      }

      // Recria ícones dentro do modal
      if (window.lucide) {
        const modalBody = document.getElementById('modal-body');
        if (modalBody) lucide.createIcons({ nodes: [modalBody] });
      }
    }, 100);
    const remembered = ManualPaymentPending.snapshots.get(identity.actor);
    if (pending && remembered?.idempotencyKey === pending.id) {
      const fields = { studentId: 'aluno', planId: 'plano', amount: 'valor', paymentDate: 'data', paymentMethod: 'metodo', notes: 'notas' };
      for (const [field, suffix] of Object.entries(fields)) {
        const input = document.getElementById(`input-pgto-${suffix}`);
        if (input) input.value = remembered[field] ?? '';
      }
    }
  },

  async verificarEnvioAnterior() {
    let identity;
    const generation = this._paymentModalGeneration, form = document.getElementById('form-pagamento');
    const current = () => identity && ManualPaymentPending.current(identity) && generation === this._paymentModalGeneration
      && document.getElementById('form-pagamento') === form;
    try {
      identity = ManualPaymentPending.identity();
      const pending = ManualPaymentPending.read(identity.actor);
      if (!pending) return;
      const response = await API.get(`/pagamentos/solicitacoes/${pending.id}`);
      if (!current()) return;
      if (!Number.isSafeInteger(response?.data?.id)) throw new Error('Resposta de confirmação inválida. Tente verificar novamente.');
      await ManualPaymentPending.confirm(identity.actor, pending.id);
      if (!current()) return;
      this._lastConfirmedRequest = { actor: identity.actor, id: pending.id };
      Toast.success('Envio anterior já registrado. Abra outro registro somente se houver um novo recebimento.');
      Modal.close(); this.carregarLista();
    } catch (error) {
      if (current()) Toast.error(error.status === 404
        ? 'O envio ainda não foi localizado. Preencha os mesmos dados e tente novamente; nenhum pagamento será cobrado por este formulário.' : error.message);
    }
  },

  /**
   * Submete o formulário de registro de pagamento.
   */
  async submeterPagamento() {
    if (this._paymentSubmission) return;
    let identity;
    try { identity = ManualPaymentPending.identity(); } catch (error) { Toast.error(error.message); return; }
    const studentId = document.getElementById('input-pgto-aluno')?.value;
    const planId = document.getElementById('input-pgto-plano')?.value;
    const amount = document.getElementById('input-pgto-valor')?.value;
    const paymentDate = document.getElementById('input-pgto-data')?.value;
    const paymentMethod = document.getElementById('input-pgto-metodo')?.value;
    const notes = document.getElementById('input-pgto-notas')?.value;

    // Validações no frontend
    if (!studentId) {
      Toast.error('Selecione o aluno.');
      return;
    }
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount || '') || Number(amount) <= 0) {
      Toast.error('Informe um valor de pagamento válido.');
      return;
    }

    const payload = {
      studentId: parseInt(studentId),
      amount,
      expectedActorId: identity.actor,
    };
    if (planId) payload.planId = parseInt(planId);
    if (paymentDate) payload.paymentDate = paymentDate;
    if (paymentMethod) payload.paymentMethod = paymentMethod;
    if (notes) payload.notes = notes;

    const token = {}, generation = this._paymentModalGeneration;
    const form = document.getElementById('form-pagamento');
    const current = () => ManualPaymentPending.current(identity) && generation === this._paymentModalGeneration
      && document.getElementById('form-pagamento') === form;
    this._paymentSubmission = token;
    let pending;
    try {
      pending = ManualPaymentPending.read(identity.actor);
      if (pending) {
        try {
          const found = await API.get(`/pagamentos/solicitacoes/${pending.id}`);
          if (!current()) return;
          if (!Number.isSafeInteger(found?.data?.id)) throw new Error('Resposta de confirmação inválida.');
          await ManualPaymentPending.confirm(identity.actor, pending.id);
          if (!current()) return;
          this._lastConfirmedRequest = { actor: identity.actor, id: pending.id };
          Toast.success('Envio anterior já registrado. Abra outro registro somente se houver um novo recebimento.');
          Modal.close(); this.carregarLista(); return;
        } catch (error) { if (error.status !== 404) throw error; }
      }
      pending = await ManualPaymentPending.withLock(identity.actor, async () => {
        if (!current()) return null;
        // O lock é adquirido ANTES do digest: nenhuma aba pode confirmar/limpar
        // a intenção enquanto outra ainda calcula o mesmo envio já iniciado.
        const fingerprint = await ManualPaymentPending.fingerprint(payload, identity.actor);
        if (!current()) return null;
        const reserved = ManualPaymentPending.read(identity.actor);
        // Um lookup 404 pode ter saído antes da confirmação de outra aba.
        // Se ela já encerrou esta intenção, o envio antigo não cria outra UUID.
        if (pending && reserved?.id !== pending.id) throw new Error('O envio anterior mudou em outra aba. Verifique os recebimentos e abra novamente o formulário antes de continuar.');
        if (reserved && !reserved.rejected && reserved.fingerprint !== fingerprint) throw new Error('Os dados diferem do envio sem confirmação. Verifique o envio anterior ou preencha exatamente os mesmos dados.');
        const next = { id: reserved?.id || crypto.randomUUID(), fingerprint, rejected: false };
        ManualPaymentPending.write(identity.actor, next);
        return next;
      });
      if (!pending || !current()) return;
      payload.idempotencyKey = pending.id;
      ManualPaymentPending.snapshots.set(identity.actor, Object.freeze({ ...payload }));
      // Feedback visual no botão
      const btns = document.querySelectorAll('#modal-footer .btn-success');
      if (btns.length > 0) {
        btns[0].disabled = true;
        btns[0].innerHTML = 'Processando...';
      }

      const response = await API.post('/pagamentos', payload);
      if (!current()) return;
      if (!Number.isSafeInteger(response?.data?.id)) throw Object.assign(new Error('O servidor não confirmou o registro. Verifique o envio anterior antes de registrar outro.'), { status: 502 });
      await ManualPaymentPending.confirm(identity.actor, pending.id);
      if (!current()) return;
      this._lastConfirmedRequest = { actor: identity.actor, id: pending.id };
      Toast.success('Recebimento registrado.');
      Modal.close();
      this.carregarLista();
    } catch (error) {
      if (!current()) return;
      // 400 é rejeição explícita antes do commit; permite corrigir o formulário
      // usando a MESMA chave. Falhas incertas preservam fingerprint e snapshot.
      if (error.status === 400 && pending) {
        try { await ManualPaymentPending.withLock(identity.actor, () => {
          const saved = ManualPaymentPending.read(identity.actor);
          if (saved?.id === pending.id && saved.fingerprint === pending.fingerprint && !saved.confirmed)
            ManualPaymentPending.write(identity.actor, { ...saved, rejected: true });
        }); } catch { /* Preserva a chave já gravada. */ }
      }
      if (current()) Toast.error(error.message || 'Envio sem confirmação. Verifique o registro antes de iniciar outro.');
    } finally {
      if (this._paymentSubmission === token) this._paymentSubmission = null;
      if (!current()) return;
      const btns = document.querySelectorAll('#modal-footer .btn-success');
      if (btns.length > 0) {
        btns[0].disabled = false;
        btns[0].innerHTML = 'Registrar recebimento';
      }
    }
  },

  /**
   * Exibe detalhes de um pagamento em um modal.
   */
  async verDetalhes(id) {
    try {
      const resp = await API.get(`/pagamentos/${id}`);
      const p = resp.data;

      const nomeAluno = FitFlowSecurity.escapeHtml(p.student?.user?.name || '—');
      const nomePlano = FitFlowSecurity.escapeHtml(p.plan?.name || 'Sem plano');
      const valor = `R$ ${parseFloat(p.amount).toFixed(2).replace('.', ',')}`;
      const dataPgto = this.formatarData(p.paymentDate);
      const dataVenc = this.formatarData(p.dueDate);
      const metodo = this.formatarMetodo(p.paymentMethod);
      const statusBadge = this.renderBadgeStatus(p.status);

      const bodyHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Aluno</label>
            <p style="font-weight:600; margin-top:0.25rem;">${nomeAluno}</p>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Plano</label>
            <p style="font-weight:600; margin-top:0.25rem;">${nomePlano}</p>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Valor</label>
            <p style="font-weight:700; color:var(--primary-400); font-size:1.25rem; margin-top:0.25rem;">${valor}</p>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Método</label>
            <p style="margin-top:0.25rem;">${metodo}</p>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Data do Pagamento</label>
            <p style="margin-top:0.25rem;">${dataPgto}</p>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Vencimento</label>
            <p style="margin-top:0.25rem;">${dataVenc}</p>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Status</label>
            <div style="margin-top:0.25rem;">${statusBadge}</div>
          </div>
          ${p.notes ? `
          <div style="grid-column: span 2;">
            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Observações</label>
            <p style="margin-top:0.25rem; color:var(--text-secondary)">${FitFlowSecurity.escapeHtml(p.notes)}</p>
          </div>` : ''}
        </div>
      `;

      Modal.open('Detalhes do Pagamento', bodyHTML, [
        { text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() },
      ]);
    } catch (error) {
      Toast.error('Erro ao carregar detalhes: ' + error.message);
    }
  },

  /**
   * Abre o painel de inadimplentes em um modal dedicado.
   */
  async abrirModalInadimplentes() {
    try {
      // Primeiro dispara a verificação automática
      await API.post('/pagamentos/verificar-inadimplencia');

      // Depois busca a lista atualizada
      const resp = await API.get('/pagamentos/inadimplentes');
      const lista = resp.data || [];

      let bodyHTML;

      if (lista.length === 0) {
        bodyHTML = `
          <div class="empty-state" style="padding:2rem;">
            <i data-lucide="check-circle" style="width:48px; height:48px; color:var(--success); opacity:0.7"></i>
            <h3 style="margin-top:1rem;">Nenhum inadimplente!</h3>
            <p style="color:var(--text-muted)">Todos os alunos estão com os pagamentos em dia.</p>
          </div>
        `;
      } else {
        bodyHTML = `
          <p style="color:var(--text-muted); margin-bottom:1rem; font-size:0.85rem;">
            ${lista.length} aluno(s) com pendências financeiras identificados.
          </p>
          <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:400px; overflow-y:auto;">
            ${lista.map(aluno => {
              const nome = FitFlowSecurity.escapeHtml(aluno.user?.name || '—');
              const email = FitFlowSecurity.escapeHtml(aluno.user?.email || '');
              const planoNome = FitFlowSecurity.escapeHtml(aluno.plan?.name || 'Sem plano');
              const vencimento = aluno.planEndDate ? this.formatarData(aluno.planEndDate) : '—';
              const diasAtraso = aluno.planEndDate ? this.calcularDiasAtraso(aluno.planEndDate) : 0;
              const ultimoPgto = aluno.payments?.[0];
              const ultimoPgtoData = ultimoPgto ? this.formatarData(ultimoPgto.paymentDate) : 'Nunca';
              const statusBadge = aluno.status === 'blocked'
                ? '<span class="badge badge-error">Bloqueado</span>'
                : '<span class="badge badge-warning">Atrasado</span>';

              return `
                <div style="background:var(--bg-elevated); border-radius:var(--radius-md); padding:1rem; border-left:3px solid ${aluno.status === 'blocked' ? 'var(--error)' : 'var(--warning)'};">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <div>
                      <strong>${nome}</strong>
                      <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.5rem;">${email}</span>
                    </div>
                    ${statusBadge}
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; font-size:0.8rem; color:var(--text-secondary);">
                    <div>Plano: <strong>${planoNome}</strong></div>
                    <div>Venceu em: <strong style="color:var(--error)">${vencimento}</strong></div>
                    <div>Atraso: <strong style="color:var(--error)">${diasAtraso} dias</strong></div>
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem;">
                    Último pagamento: ${ultimoPgtoData}
                  </div>
                  <div style="margin-top:0.75rem;">
                    <button type="button" class="btn btn-sm btn-success" data-payment-student="${Number(aluno.id)}">
                      <i data-lucide="credit-card" style="width:14px; height:14px;"></i>
                      Registrar Pagamento
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      Modal.open('Alunos Inadimplentes', bodyHTML, [
        { text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() },
      ]);
      const actionsHost = document.getElementById('modal-body');
      if (actionsHost) actionsHost.onclick = event => {
        const button = event.target?.closest?.('button[data-payment-student]');
        if (!button || !actionsHost.contains(button) || !/^[1-9]\d*$/.test(button.dataset.paymentStudent || '')) return;
        const id = Number(button.dataset.paymentStudent);
        if (Number.isSafeInteger(id)) this.registrarPagamentoRapido(id);
      };

      // Recria ícones Lucide no modal
      setTimeout(() => {
        const modalBody = document.getElementById('modal-body');
        if (modalBody && window.lucide) lucide.createIcons({ nodes: [modalBody] });
      }, 50);

    } catch (error) {
      Toast.error('Erro ao verificar inadimplência: ' + error.message);
    }
  },

  /**
   * Atalho: abre modal de registro com aluno pré-selecionado (usado no painel de inadimplentes).
   */
  registrarPagamentoRapido(studentId) {
    Modal.close();
    setTimeout(async () => {
      await this.abrirModalRegistro();
      // Pré-seleciona o aluno após o modal abrir
      setTimeout(() => {
        const selectAluno = document.getElementById('input-pgto-aluno');
        if (selectAluno) {
          selectAluno.value = studentId;
          selectAluno.dispatchEvent(new Event('change'));
        }
      }, 150);
    }, 300);
  },

  // ============================================
  // HELPERS DE FORMATAÇÃO
  // ============================================

  /**
   * Formata uma data ISO para DD/MM/AAAA.
   */
  formatarData(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
  },

  /**
   * Calcula dias de atraso a partir de uma data de vencimento.
   */
  calcularDiasAtraso(dateStr) {
    const venc = new Date(dateStr);
    const agora = new Date();
    const diff = Math.floor((agora - venc) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  },

  /**
   * Renderiza badge de status do pagamento.
   */
  renderBadgeStatus(status) {
    const map = {
      paid: '<span class="badge badge-success">Pago</span>',
      pending: '<span class="badge badge-warning">Pendente</span>',
      overdue: '<span class="badge badge-error">Vencido</span>',
    };
    return Object.hasOwn(map, status) ? map[status] : `<span class="badge badge-neutral">${FitFlowSecurity.escapeHtml(status)}</span>`;
  },

  /**
   * Formata o método de pagamento para exibição amigável.
   */
  formatarMetodo(metodo) {
    const map = {
      dinheiro: '💵 Dinheiro',
      pix: '📱 PIX',
      cartao_credito: '💳 Crédito',
      cartao_debito: '💳 Débito',
      boleto: '📄 Boleto',
      transferencia: '🏦 Transferência',
    };
    return Object.hasOwn(map, metodo) ? map[metodo] : FitFlowSecurity.escapeHtml(metodo || '—');
  },
};
