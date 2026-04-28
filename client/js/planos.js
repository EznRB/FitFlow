/**
 * ============================================================================
 * FitFlow Caraguá — Módulo de Planos do Frontend
 * ============================================================================
 * Gerencia planos de assinatura com suporte a períodos:
 * Mensal, Trimestral, Semestral e Anual (com pagamento recorrente).
 * 
 * Funcionalidades:
 * - Cards visuais premium com valor mensal equivalente
 * - Presets de duração (Mensal, Trimestral, Semestral, Anual, Custom)
 * - CRUD completo (criar, editar, soft-delete)
 * - Badge de "Mais Popular" e "Melhor Custo-Benefício"
 * - Totalmente editável pelo administrador
 */

const PlanosView = {
  dados: [],
  planoAtualId: null,

  /**
   * Mapeamento de duração em dias para label de recorrência.
   * Usado para exibir o tipo de plano nos cards.
   */
  PERIODOS: {
    30:  { label: 'Mensal',     recorrencia: '/mês',     meses: 1  },
    90:  { label: 'Trimestral', recorrencia: '/trimestre', meses: 3  },
    180: { label: 'Semestral',  recorrencia: '/semestre', meses: 6  },
    365: { label: 'Anual',      recorrencia: '/ano',     meses: 12 },
  },

  /** Presets de duração para o select do formulário */
  DURATION_PRESETS: [
    { value: 30,  label: 'Mensal (30 dias)' },
    { value: 90,  label: 'Trimestral (90 dias)' },
    { value: 180, label: 'Semestral (180 dias)' },
    { value: 365, label: 'Anual (365 dias)' },
    { value: 'custom', label: 'Personalizado' },
  ],

  async inicializar() {
    await this.carregarLista();
    this.configurarEventos();
  },

  async carregarLista() {
    const gridContainer = document.getElementById('planos-grid');
    if (!gridContainer) return;

    try {
      gridContainer.innerHTML = `<div class="spinner spinner-sm"></div> <p>Carregando planos...</p>`;
      
      const response = await API.get('/planos');
      this.dados = response.data;

      if (this.dados.length === 0) {
        gridContainer.innerHTML = `<div class="empty-state">Nenhum plano cadastrado.</div>`;
        return;
      }

      // Ordena: ativos primeiro, depois por duração crescente
      const sorted = [...this.dados].sort((a, b) => {
        if (a.active !== b.active) return b.active - a.active;
        return a.durationDays - b.durationDays;
      });

      gridContainer.innerHTML = sorted.map(plano => this.renderCard(plano)).join('');

      if (window.lucide) {
        lucide.createIcons({ nodes: [gridContainer] });
      }

    } catch (error) {
      Toast.error('Erro ao buscar lista de planos: ' + error.message);
      gridContainer.innerHTML = `<p style="color:var(--danger)">Erro ao carregar dados.</p>`;
    }
  },

  /**
   * Renderiza um card premium para o plano.
   * Mostra: nome, preço total, preço mensal equivalente, recorrência,
   * badges especiais (popular/melhor custo) e benefícios do plano.
   */
  renderCard(plano) {
    const periodo = this.PERIODOS[plano.durationDays];
    const isInativo = !plano.active;
    const preco = parseFloat(plano.price);

    // Calcula valor mensal equivalente
    const meses = periodo ? periodo.meses : Math.max(1, Math.round(plano.durationDays / 30));
    const mensal = preco / meses;
    const labelPeriodo = periodo ? periodo.label : `${plano.durationDays} dias`;
    const labelRecorrencia = periodo ? periodo.recorrencia : `/${plano.durationDays}d`;

    // Badges especiais baseadas na duração
    let badgeEspecial = '';
    if (plano.active && plano.durationDays === 180) {
      badgeEspecial = `<div style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg, var(--primary), var(--primary-600)); color:white; padding:4px 16px; border-radius:20px; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; white-space:nowrap;">⭐ Mais Popular</div>`;
    } else if (plano.active && plano.durationDays >= 365) {
      badgeEspecial = `<div style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg, #10b981, #059669); color:white; padding:4px 16px; border-radius:20px; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; white-space:nowrap;">🏆 Melhor Custo-Benefício</div>`;
    }

    // Calcula desconto em relação ao mensal (se houver plano mensal como base)
    const planoMensal = this.dados.find(p => p.active && p.durationDays === 30);
    let descontoHTML = '';
    if (planoMensal && plano.durationDays > 30 && plano.active) {
      const precoMensalBase = parseFloat(planoMensal.price);
      const economiaPercent = Math.round(((precoMensalBase - mensal) / precoMensalBase) * 100);
      if (economiaPercent > 0) {
        descontoHTML = `<span style="background:rgba(16,185,129,0.15); color:var(--success); padding:2px 10px; border-radius:12px; font-size:0.75rem; font-weight:600;">↓ ${economiaPercent}% de economia</span>`;
      }
    }

    // Borda especial para planos populares
    const borderStyle = plano.durationDays === 180 && plano.active
      ? 'border: 2px solid var(--primary); box-shadow: 0 0 20px rgba(var(--primary-rgb, 255,140,50), 0.15);'
      : '';

    // Ícone de recorrência
    const recurrenceIcon = plano.durationDays <= 30 ? 'repeat' : plano.durationDays <= 90 ? 'calendar-range' : plano.durationDays <= 180 ? 'calendar-clock' : 'calendar-check';

    return `
      <div class="card ${isInativo ? 'plano-inativo' : ''}" style="display:flex; flex-direction:column; gap:1rem; position:relative; ${borderStyle} padding-top:1.75rem; transition: transform 0.2s, box-shadow 0.2s; ${plano.active ? 'cursor:default;' : 'opacity:0.6;'}">
        ${badgeEspecial}

        <!-- Status Badge -->
        <div style="position:absolute; top:1rem; right:1rem;">
          ${isInativo 
            ? '<span class="badge badge-default">Inativo</span>' 
            : '<span class="badge badge-success">Ativo</span>'}
        </div>

        <!-- Nome e Período -->
        <div>
          <h3 style="margin-bottom:0.25rem;">${plano.name}</h3>
          <div style="display:flex; align-items:center; gap:0.5rem; color:var(--text-muted); font-size:0.8rem;">
            <i data-lucide="${recurrenceIcon}" style="width:14px; height:14px;"></i>
            <span>Recorrência ${labelPeriodo.toLowerCase()}</span>
          </div>
        </div>

        <!-- Preço -->
        <div style="padding:1rem 0;">
          ${meses > 1 ? `
            <div style="display:flex; align-items:baseline; gap:0.5rem;">
              <span style="font-size:2rem; font-weight:800; color:var(--primary);">R$ ${mensal.toFixed(2).replace('.', ',')}</span>
              <span style="color:var(--text-muted); font-size:0.85rem;">/mês</span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">
              Total: <strong>R$ ${preco.toFixed(2).replace('.', ',')}</strong> ${labelRecorrencia}
            </div>
          ` : `
            <div style="display:flex; align-items:baseline; gap:0.5rem;">
              <span style="font-size:2rem; font-weight:800; color:var(--primary);">R$ ${preco.toFixed(2).replace('.', ',')}</span>
              <span style="color:var(--text-muted); font-size:0.85rem;">/mês</span>
            </div>
          `}
          ${descontoHTML ? `<div style="margin-top:0.5rem;">${descontoHTML}</div>` : ''}
        </div>

        <!-- Descrição & Benefícios -->
        <div style="flex:1;">
          <p style="color:var(--text-muted); font-size:0.85rem; line-height:1.5;">
            ${plano.description || 'Sem descrição.'}
          </p>
        </div>

        <!-- Duração Info -->
        <div style="background:var(--bg-elevated); border-radius:var(--radius-md); padding:0.6rem 0.75rem; display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="clock" style="width:14px; height:14px; color:var(--text-muted);"></i>
          <span style="font-size:0.8rem; color:var(--text-secondary);">Vigência de <strong>${plano.durationDays} dias</strong> por ciclo</span>
        </div>

        <!-- Ações -->
        <div style="display:flex; gap:0.5rem; justify-content:flex-end; border-top:1px solid var(--border); padding-top:1rem;">
          <button class="btn btn-icon btn-outline-primary" title="Editar plano" onclick="PlanosView.abrirModalEdicao(${plano.id})">
            <i data-lucide="edit-3"></i>
          </button>
          ${plano.active 
            ? `<button class="btn btn-icon btn-outline-danger" title="Inativar plano" onclick="PlanosView.inativarPlano(${plano.id})">
                <i data-lucide="trash-2"></i>
               </button>` 
            : ''}
        </div>
      </div>
    `;
  },

  configurarEventos() {
    const btnNovo = document.getElementById('btn-novo-plano');
    if (btnNovo) {
      btnNovo.onclick = () => this.abrirModalCriacao();
    }
  },

  /**
   * Abre modal de criação com presets de duração (Mensal/Trimestral/Semestral/Anual/Custom).
   */
  abrirModalCriacao() {
    this.planoAtualId = null;
    this._abrirModal('Criar Novo Plano', {}, 'Salvar Plano');
  },

  /**
   * Abre modal de edição pré-preenchido com os dados do plano.
   */
  abrirModalEdicao(id) {
    this.planoAtualId = id;
    const plano = this.dados.find(p => p.id === id);
    if (!plano) return;
    this._abrirModal('Editar Plano', plano, 'Atualizar Plano');
  },

  /**
   * Monta e exibe o modal de formulário com presets de período.
   */
  _abrirModal(title, plano, submitText) {
    const presetsOptions = this.DURATION_PRESETS.map(p => {
      const isSelected = plano.durationDays === p.value;
      return `<option value="${p.value}" ${isSelected ? 'selected' : ''}>${p.label}</option>`;
    }).join('');

    // Se a duração não bate com nenhum preset, seleciona "Personalizado"
    const isCustom = plano.durationDays && !this.DURATION_PRESETS.some(p => p.value === plano.durationDays);

    const bodyHTML = `
      <form id="form-plano" class="form-grid">
        <div class="form-group" style="grid-column: span 2;">
          <label>Nome do Plano *</label>
          <input type="text" id="input-plano-nome" value="${plano.name || ''}" placeholder="Ex: Plano Mensal Premium" required>
        </div>
        <div class="form-group">
          <label>Período / Recorrência *</label>
          <select id="input-plano-periodo">
            ${presetsOptions}
          </select>
        </div>
        <div class="form-group" id="grupo-duracao-custom" style="${isCustom ? '' : 'display:none;'}">
          <label>Duração Personalizada (dias) *</label>
          <input type="number" step="1" min="1" id="input-plano-duracao-custom" value="${isCustom ? plano.durationDays : ''}" placeholder="Ex: 45">
        </div>
        <div class="form-group">
          <label>Valor Total do Período (R$) *</label>
          <input type="number" step="0.01" min="0.01" id="input-plano-valor" value="${plano.price || ''}" placeholder="Ex: 599.40" required>
        </div>
        <div class="form-group">
          <label>Valor Mensal Equivalente</label>
          <div id="display-mensal" style="padding:0.6rem 0.75rem; background:var(--bg-elevated); border-radius:var(--radius-md); font-weight:700; color:var(--primary); font-size:1.1rem;">
            —
          </div>
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label>Descrição / Benefícios</label>
          <textarea id="input-plano-descricao" rows="3" placeholder="Ex: Acesso completo, avaliação física inclusa, sem fidelidade...">${plano.description || ''}</textarea>
        </div>
      </form>

      <div style="background:var(--bg-elevated); border-radius:var(--radius-md); padding:0.75rem 1rem; margin-top:0.5rem;">
        <p style="font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="info" style="width:16px; height:16px; flex-shrink:0;"></i>
          Pagamento recorrente: o aluno será cobrado a cada ciclo (ex: a cada 6 meses no plano semestral). O vencimento é calculado automaticamente ao registrar pagamento.
        </p>
      </div>
    `;

    Modal.open(title, bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: submitText, class: 'btn-primary', action: () => this.submeterFormulario() },
    ]);

    // Configura interatividade do formulário após montar o DOM
    setTimeout(() => {
      this._configurarFormInteracao();

      // Recalcula o mensal se já tem dados preenchidos
      this._atualizarMensal();

      // Recria ícones dentro do modal
      if (window.lucide) {
        const modalBody = document.getElementById('modal-body');
        if (modalBody) lucide.createIcons({ nodes: [modalBody] });
      }
    }, 100);
  },

  /**
   * Configura eventos de interação do formulário:
   * - Ao mudar período, mostra/esconde campo custom e atualiza mensal
   * - Ao mudar valor, recalcula mensal
   */
  _configurarFormInteracao() {
    const selectPeriodo = document.getElementById('input-plano-periodo');
    const grupoCustom = document.getElementById('grupo-duracao-custom');
    const inputValor = document.getElementById('input-plano-valor');

    if (selectPeriodo) {
      selectPeriodo.onchange = () => {
        if (selectPeriodo.value === 'custom') {
          grupoCustom.style.display = '';
        } else {
          grupoCustom.style.display = 'none';
        }
        this._atualizarMensal();
      };
    }

    if (inputValor) {
      inputValor.oninput = () => this._atualizarMensal();
    }

    const inputCustom = document.getElementById('input-plano-duracao-custom');
    if (inputCustom) {
      inputCustom.oninput = () => this._atualizarMensal();
    }
  },

  /**
   * Recalcula e exibe o valor mensal equivalente no formulário.
   */
  _atualizarMensal() {
    const display = document.getElementById('display-mensal');
    if (!display) return;

    const valor = parseFloat(document.getElementById('input-plano-valor')?.value);
    const dias = this._getDuracaoAtual();

    if (!valor || valor <= 0 || !dias || dias <= 0) {
      display.textContent = '—';
      display.style.color = 'var(--text-muted)';
      return;
    }

    const meses = Math.max(1, dias / 30);
    const mensal = valor / meses;
    display.textContent = `R$ ${mensal.toFixed(2).replace('.', ',')} /mês`;
    display.style.color = 'var(--primary)';
  },

  /**
   * Obtém a duração em dias do formulário (preset ou custom).
   */
  _getDuracaoAtual() {
    const selectPeriodo = document.getElementById('input-plano-periodo');
    if (!selectPeriodo) return 30;

    if (selectPeriodo.value === 'custom') {
      return parseInt(document.getElementById('input-plano-duracao-custom')?.value) || 0;
    }
    return parseInt(selectPeriodo.value) || 30;
  },

  async submeterFormulario() {
    const nomeEl = document.getElementById('input-plano-nome');
    const valorEl = document.getElementById('input-plano-valor');
    const descricaoEl = document.getElementById('input-plano-descricao');
    
    const durationDays = this._getDuracaoAtual();

    // Validações
    if (!nomeEl.value) {
      Toast.error('Preencha o nome do plano.');
      return;
    }

    if (!valorEl.value || parseFloat(valorEl.value) <= 0) {
      Toast.error('Regra de Negócio: O plano não pode ter valor zero ou negativo.');
      return;
    }

    if (!durationDays || durationDays <= 0) {
      Toast.error('Regra de Negócio: A duração mínima do plano é de 1 dia.');
      return;
    }

    const payload = {
      name: nomeEl.value,
      price: parseFloat(valorEl.value),
      durationDays: durationDays,
      description: descricaoEl.value,
    };

    try {
      const buttons = document.querySelectorAll('#modal-footer .btn-primary');
      if (buttons.length > 0) {
        buttons[0].disabled = true;
        buttons[0].innerHTML = 'Salvando...';
      }

      if (this.planoAtualId) {
        await API.put(`/planos/${this.planoAtualId}`, payload);
        Toast.success('Plano atualizado com sucesso!');
      } else {
        await API.post('/planos', payload);
        Toast.success('Plano criado com sucesso!');
      }

      Modal.close();
      this.carregarLista();

    } catch (error) {
      Toast.error(error.message || 'Erro ao processar plano.');
    } finally {
      const buttons = document.querySelectorAll('#modal-footer .btn-primary');
      if (buttons.length > 0) {
        buttons[0].disabled = false;
        buttons[0].innerHTML = this.planoAtualId ? 'Atualizar Plano' : 'Salvar Plano';
      }
    }
  },

  async inativarPlano(id) {
    if (!confirm('Deseja realmente inativar este plano? Ele não poderá mais ser atribuído a novos alunos, mas o histórico financeiro será preservado.')) {
      return;
    }

    try {
      await API.delete(`/planos/${id}`);
      Toast.success('Plano inativado. O histórico de mensalidades vinculadas permanece íntegro.');
      this.carregarLista();
    } catch (erro) {
      Toast.error('Erro ao desativar: ' + erro.message);
    }
  }
};
