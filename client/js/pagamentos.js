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
        const nomeAluno = p.student?.user?.name || '—';
        const nomePlano = p.plan?.name || 'Sem plano';
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
                <button class="btn-icon" title="Ver detalhes" onclick="PagamentosView.verDetalhes(${p.id})">
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
  abrirModalRegistro() {
    // Gera opções de alunos
    const opcoesAlunos = this.alunos.map(a => {
      const nome = a.user ? a.user.name : `Aluno #${a.id}`;
      const planoAtual = a.plan ? ` (${a.plan.name})` : '';
      return `<option value="${a.id}">${nome}${planoAtual}</option>`;
    }).join('');

    // Gera opções de planos
    const opcoesPlanos = this.planos.map(p => {
      return `<option value="${p.id}">${p.name} — R$ ${parseFloat(p.price).toFixed(2).replace('.', ',')}</option>`;
    }).join('');

    // Data de hoje para o campo de data
    const hoje = new Date().toISOString().split('T')[0];

    const bodyHTML = `
      <form id="form-pagamento" class="form-grid">
        <div class="form-group" style="grid-column: span 2;">
          <label>Aluno *</label>
          <select id="input-pgto-aluno" required>
            <option value="">Selecione o aluno</option>
            ${opcoesAlunos}
          </select>
        </div>
        <div class="form-group">
          <label>Plano</label>
          <select id="input-pgto-plano">
            <option value="">Usar plano atual do aluno</option>
            ${opcoesPlanos}
          </select>
        </div>
        <div class="form-group">
          <label>Valor (R$) *</label>
          <input type="number" step="0.01" min="0.01" id="input-pgto-valor" placeholder="Ex: 89.90" required>
        </div>
        <div class="form-group">
          <label>Data do Pagamento</label>
          <input type="date" id="input-pgto-data" value="${hoje}">
        </div>
        <div class="form-group">
          <label>Método de Pagamento</label>
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
          <label>Observações</label>
          <textarea id="input-pgto-notas" rows="2" placeholder="Anotações sobre este pagamento..."></textarea>
        </div>
      </form>

      <div style="background:var(--bg-elevated); border-radius:var(--radius-md); padding:0.75rem 1rem; margin-top:0.5rem;">
        <p style="font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="info" style="width:16px; height:16px; flex-shrink:0;"></i>
          O vencimento será calculado automaticamente com base na duração do plano selecionado.
        </p>
      </div>
    `;

    Modal.open('Registrar Pagamento', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Confirmar Pagamento', class: 'btn-success', action: () => this.submeterPagamento() },
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
  },

  /**
   * Submete o formulário de registro de pagamento.
   */
  async submeterPagamento() {
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
    if (!amount || parseFloat(amount) <= 0) {
      Toast.error('Informe um valor de pagamento válido.');
      return;
    }

    const payload = {
      studentId: parseInt(studentId),
      amount: parseFloat(amount),
    };
    if (planId) payload.planId = parseInt(planId);
    if (paymentDate) payload.paymentDate = paymentDate;
    if (paymentMethod) payload.paymentMethod = paymentMethod;
    if (notes) payload.notes = notes;

    try {
      // Feedback visual no botão
      const btns = document.querySelectorAll('#modal-footer .btn-success');
      if (btns.length > 0) {
        btns[0].disabled = true;
        btns[0].innerHTML = 'Processando...';
      }

      await API.post('/pagamentos', payload);
      Toast.success('Pagamento registrado com sucesso! Vencimento do aluno atualizado.');
      Modal.close();
      this.carregarLista();
    } catch (error) {
      Toast.error(error.message || 'Erro ao registrar pagamento.');
    } finally {
      const btns = document.querySelectorAll('#modal-footer .btn-success');
      if (btns.length > 0) {
        btns[0].disabled = false;
        btns[0].innerHTML = 'Confirmar Pagamento';
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

      const nomeAluno = p.student?.user?.name || '—';
      const nomePlano = p.plan?.name || 'Sem plano';
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
            <p style="margin-top:0.25rem; color:var(--text-secondary)">${p.notes}</p>
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
              const nome = aluno.user?.name || '—';
              const email = aluno.user?.email || '';
              const planoNome = aluno.plan?.name || 'Sem plano';
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
                    <button class="btn btn-sm btn-success" onclick="PagamentosView.registrarPagamentoRapido(${aluno.id})">
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
    setTimeout(() => {
      this.abrirModalRegistro();
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
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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
    return map[status] || `<span class="badge badge-neutral">${status}</span>`;
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
    return map[metodo] || metodo || '—';
  },
};
