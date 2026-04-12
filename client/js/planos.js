/**
 * ============================================================================
 * FitFlow Caraguá — Módulo de Planos do Frontend
 * ============================================================================
 * Lida com chamadas à API e renderização dinâmica dos planos de assinatura,
 * modais de formulário e exclusão (soft-delete).
 */

const PlanosView = {
  dados: [],
  planoAtualId: null,

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
      // Lista todos os planos; os inativos ficarão na parte inferior visualmente pela classe 'plano-inativo'
      this.dados = response.data;

      if (this.dados.length === 0) {
        gridContainer.innerHTML = `<div class="empty-state">Nenhum plano cadastrado.</div>`;
        return;
      }

      gridContainer.innerHTML = this.dados.map(plano => `
        <div class="card ${!plano.active ? 'plano-inativo' : ''}" style="display:flex; flex-direction:column; gap: 1rem; position: relative;">
          ${!plano.active ? '<div style="position:absolute; top:1rem; right:1rem;"><span class="badge badge-default">Inativo</span></div>' : '<div style="position:absolute; top:1rem; right:1rem;"><span class="badge badge-success">Ativo</span></div>'}
          <h3>${plano.name}</h3>
          <h2 style="color: var(--primary)">R$ ${parseFloat(plano.price).toFixed(2).replace('.', ',')}</h2>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            Duração: ${plano.durationDays} dias<br>
            ${plano.description || 'Sem descrição particular.'}
          </p>
          <div style="margin-top: auto; display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 1rem;">
            <button class="btn btn-icon btn-outline-primary" title="Editar" onclick="PlanosView.abrirModalEdicao(${plano.id})">
              <i data-lucide="edit-3"></i>
            </button>
            ${plano.active ? 
              `<button class="btn btn-icon btn-outline-danger" title="Inativar" onclick="PlanosView.inativarPlano(${plano.id})">
                <i data-lucide="trash-2"></i>
               </button>` : ''}
          </div>
        </div>
      `).join('');

      if (window.lucide) {
        lucide.createIcons({ nodes: [gridContainer] });
      }

    } catch (error) {
      Toast.error('Erro ao buscar lista de planos: ' + error.message);
      gridContainer.innerHTML = `<p style="color:var(--danger)">Erro ao carregar dados.</p>`;
    }
  },

  configurarEventos() {
    const btnNovo = document.getElementById('btn-novo-plano');
    if (btnNovo) {
      btnNovo.onclick = () => this.abrirModalCriacao();
    }
  },

  abrirModalCriacao() {
    this.planoAtualId = null;

    const bodyHTML = `
      <form id="form-plano" class="form-grid">
        <div class="form-group" style="grid-column: span 2;">
          <label>Nome do Plano*</label>
          <input type="text" id="input-plano-nome" placeholder="Ex: Mensal Básico" required>
        </div>
        <div class="form-group">
          <label>Valor (R$)*</label>
          <input type="number" step="0.01" min="0.01" id="input-plano-valor" placeholder="Ex: 89.90" required>
        </div>
        <div class="form-group">
          <label>Duração (dias)*</label>
          <input type="number" step="1" min="1" id="input-plano-duracao" placeholder="Ex: 30" required>
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label>Descrição</label>
          <textarea id="input-plano-descricao" rows="2" placeholder="Benefícios do plano..."></textarea>
        </div>
      </form>
    `;

    Modal.open('Criar Novo Plano', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Salvar Plano', class: 'btn-primary', action: () => this.submeterFormulario() },
    ]);
  },

  abrirModalEdicao(id) {
    this.planoAtualId = id;
    const plano = this.dados.find(p => p.id === id);
    if (!plano) return;

    const bodyHTML = `
      <form id="form-plano" class="form-grid">
        <div class="form-group" style="grid-column: span 2;">
          <label>Nome do Plano*</label>
          <input type="text" id="input-plano-nome" value="${plano.name}" required>
        </div>
        <div class="form-group">
          <label>Valor (R$)*</label>
          <input type="number" step="0.01" min="0.01" id="input-plano-valor" value="${plano.price}" required>
        </div>
        <div class="form-group">
          <label>Duração (dias)*</label>
          <input type="number" step="1" min="1" id="input-plano-duracao" value="${plano.durationDays}" required>
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label>Descrição</label>
          <textarea id="input-plano-descricao" rows="2">${plano.description || ''}</textarea>
        </div>
      </form>
    `;

    Modal.open('Editar Plano', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Atualizar Plano', class: 'btn-primary', action: () => this.submeterFormulario() },
    ]);
  },

  async submeterFormulario() {
    const nomeEl = document.getElementById('input-plano-nome');
    const valorEl = document.getElementById('input-plano-valor');
    const duracaoEl = document.getElementById('input-plano-duracao');
    const descricaoEl = document.getElementById('input-plano-descricao');
    
    // Front-end constraints validation
    if (!nomeEl.value || !valorEl.value || !duracaoEl.value) {
      Toast.error('Preencha os campos obrigatórios (Nome, Valor, Duração).');
      return;
    }

    if (parseFloat(valorEl.value) <= 0) {
      Toast.error('Regra de Negócio: O plano não pode ter valor zero ou negativo.');
      return;
    }

    if (parseInt(duracaoEl.value) <= 0) {
      Toast.error('Regra de Negócio: A duração mínima do plano é de 1 dia.');
      return;
    }

    const payload = {
      name: nomeEl.value,
      price: parseFloat(valorEl.value),
      durationDays: parseInt(duracaoEl.value),
      description: descricaoEl.value,
    };

    try {
      // Find modal submit button to give visual feedback
      const buttons = document.querySelectorAll('#modal-footer .btn-primary');
      if(buttons.length > 0) {
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
      Toast.error(error.message || 'Erro ao processar criação/edição do plano.');
    } finally {
      const buttons = document.querySelectorAll('#modal-footer .btn-primary');
      if(buttons.length > 0) {
        buttons[0].disabled = false;
        buttons[0].innerHTML = this.planoAtualId ? 'Atualizar Plano' : 'Salvar Plano';
      }
    }
  },

  async inativarPlano(id) {
    if (!confirm('Deseja realmente inativar este plano? Ele não poderá mais ser atribuído a alunos, mas servirá para histórico do financeiro.')) {
      return;
    }

    try {
      await API.delete(`/planos/${id}`);
      Toast.success('Plano inativado via Soft-Delete. (O histórico de mensalidades vinculadas continuará íntegro).');
      this.carregarLista();
    } catch (erro) {
      Toast.error('Erro de ao desativar: ' + erro.message);
    }
  }
};
