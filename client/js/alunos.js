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

  /**
   * Ponto de entrada: Chamado pelo app.js ao abrir a tela "alunos".
   */
  async inicializar() {
    await this.carregarLista();
    this.configurarEventos();
  },

  /**
   * Busca alunos via API e renderiza as linhas na tabela.
   */
  async carregarLista() {
    const tableBody = document.getElementById('alunos-table-body');
    if (!tableBody) return; // Segurança

    try {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center"><div class="spinner spinner-sm"></div> Carregando...</td></tr>`;
      
      const response = await API.get('/alunos');
      this.dados = response.data;

      if (this.dados.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; opacity:0.5">Nenhum aluno cadastrado.</td></tr>`;
        return;
      }

      tableBody.innerHTML = this.dados.map(aluno => `
        <tr data-id="${aluno.id}" class="${aluno.status === 'inactive' ? 'aluno-inativo' : ''}">
          <td>
            <strong>${aluno.user.name}</strong><br>
            <small style="color:var(--text-muted)">${aluno.user.email}</small>
          </td>
          <td>${aluno.cpf || '-'}</td>
          <td>${aluno.plan ? aluno.plan.name : '<span class="badge badge-warning">Sem Plano</span>'}</td>
          <td>
             <span class="badge ${aluno.status === 'active' ? 'badge-success' : 'badge-danger'}">
               ${aluno.status === 'active' ? 'Ativo' : 'Inativo'}
             </span>
          </td>
          <td>
            <button class="btn btn-icon btn-outline-primary" title="Editar" onclick="AlunosView.abrirModalEdicao(${aluno.id})">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="btn btn-icon btn-outline-danger" title="Inativar" onclick="AlunosView.inativarAluno(${aluno.id})">
              <i data-lucide="user-x"></i>
            </button>
          </td>
        </tr>
      `).join('');

      // Renderiza ícones injetados
      if (window.lucide) {
        lucide.createIcons({ nodes: [tableBody] });
      }

    } catch (error) {
      Toast.error('Erro ao buscar lista de alunos: ' + error.message);
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger)">Erro ao carregar dados.</td></tr>`;
    }
  },

  /**
   * Prepara os ouvintes de clique para botões de Novo Cadastro e Salvar Modal.
   */
  configurarEventos() {
    const btnNovo = document.getElementById('btn-novo-aluno');
    const form = document.getElementById('form-aluno');

    // Remove event listeners antigos clonando o nó (evita duplicação caso mude de aba e volte)
    if (form) {
      const novoForm = form.cloneNode(true);
      form.parentNode.replaceChild(novoForm, form);
      novoForm.addEventListener('submit', this.handleFormSubmit.bind(this));
    }

    if (btnNovo) {
      btnNovo.onclick = () => this.abrirModalCriacao();
    }
  },

  abrirModalCriacao() {
    this.alunoAtualId = null; 

    const bodyHTML = `
      <form id="form-aluno" class="form-grid">
        <div class="form-group">
          <label>Nome Completo*</label>
          <input type="text" id="input-aluno-nome" required>
        </div>
        <div class="form-group">
          <label>E-mail*</label>
          <input type="email" id="input-aluno-email" required>
        </div>
        <div class="form-group">
          <label>CPF</label>
          <input type="text" id="input-aluno-cpf" placeholder="Apenas números">
        </div>
        <div class="form-group">
          <label>Telefone</label>
          <input type="text" id="input-aluno-telefone">
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label>Plano de Matrícula*</label>
          <select id="input-aluno-plano" required>
            <option value="">Carregando planos...</option>
          </select>
        </div>
      </form>
    `;

    Modal.open('Matricular Novo Aluno', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Salvar Cliente', class: 'btn-primary', action: () => this.submeterFormulario() },
    ]);

    this.carregarPlanosSelect();
  },

  async carregarPlanosSelect() {
    const select = document.getElementById('input-aluno-plano');
    if (!select) return;

    try {
      const resp = await API.get('/planos?active=true');
      const planos = resp.data;
      
      select.innerHTML = '<option value="">Selecione um plano</option>' + 
        planos.map(p => `<option value="${p.id}">${p.name} (R$ ${p.price})</option>`).join('');
    } catch (e) {
      select.innerHTML = '<option value="">Erro ao carregar planos</option>';
    }
  },

  /**
   * Preenche o modal de edição com os dados do aluno.
   */
  abrirModalEdicao(id) {
    this.alunoAtualId = id; 
    const aluno = this.dados.find(a => a.id === id);
    if (!aluno) return;

    let dataNascimento = '';
    if (aluno.birthDate) {
      dataNascimento = aluno.birthDate.split('T')[0];
    }

    const bodyHTML = `
      <form id="form-aluno" class="form-grid">
        <div class="form-group">
          <label>Nome Completo*</label>
          <input type="text" id="input-aluno-nome" value="${aluno.user.name}" required>
        </div>
        <div class="form-group">
          <label>E-mail* (Gerenciado por Senha)</label>
          <input type="email" id="input-aluno-email" value="${aluno.user.email}" disabled>
        </div>
        <div class="form-group">
          <label>CPF</label>
          <input type="text" id="input-aluno-cpf" value="${aluno.cpf || ''}">
        </div>
        <div class="form-group">
          <label>Telefone</label>
          <input type="text" id="input-aluno-telefone" value="${aluno.phone || ''}">
        </div>
        <div class="form-group">
          <label>Nascimento</label>
          <input type="date" id="input-aluno-aniversario" value="${dataNascimento}">
        </div>
      </form>
    `;

    Modal.open('Editar Cadastro', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Salvar Alterações', class: 'btn-primary', action: () => this.submeterFormulario() },
    ]);
  },

  /**
   * Lida com Envios convertidos de função pura
   */
  async submeterFormulario() {
    const nomeEl = document.getElementById('input-aluno-nome');
    const emailEl = document.getElementById('input-aluno-email');
    
    if (!nomeEl.value || !emailEl.value) {
      Toast.error('Nome e email são obrigatórios.');
      return;
    }

    const payload = {
      name: nomeEl.value,
      email: emailEl.value,
      cpf: document.getElementById('input-aluno-cpf') ? document.getElementById('input-aluno-cpf').value : '',
      phone: document.getElementById('input-aluno-telefone') ? document.getElementById('input-aluno-telefone').value : '',
      birthDate: document.getElementById('input-aluno-aniversario') ? document.getElementById('input-aluno-aniversario').value : undefined,
      planId: document.getElementById('input-aluno-plano') ? document.getElementById('input-aluno-plano').value : undefined,
    };

    try {
      const buttons = document.querySelectorAll('#modal-footer .btn-primary');
      if(buttons.length > 0) {
        buttons[0].disabled = true;
        buttons[0].innerHTML = 'Salvando...';
      }

      if (this.alunoAtualId) {
        // EDIÇÃO
        await API.put(`/alunos/${this.alunoAtualId}`, payload);
        Toast.success('Aluno atualizado com sucesso!');
      } else {
        // CRIAÇÃO
        await API.post('/alunos', payload);
        Toast.success('Aluno matriculado com sucesso!');
      }

      Modal.close('modal-aluno');
      this.carregarLista(); // Atualiza painel

    } catch (error) {
      Toast.error(error.message || 'Erro ao processar instrução.');
    } finally {
      const buttons = document.querySelectorAll('#modal-footer .btn-primary');
      if(buttons.length > 0) {
        buttons[0].disabled = false;
        buttons[0].innerHTML = this.alunoAtualId ? 'Salvar Alterações' : 'Salvar Cliente';
      }
    }
  },

  /**
   * Trata o Hard/Soft Delete disparando requisição na API.
   */
  async inativarAluno(id) {
    if (!confirm('Deseja realmente transitar este aluno para INATIVO? Seu histórico financeiro será mantido.')) {
      return;
    }

    try {
      await API.delete(`/alunos/${id}`);
      Toast.success('Aluno desativado via Soft-delete.');
      this.carregarLista();
    } catch (erro) {
      Toast.error('Erro de exclusão: ' + erro.message);
    }
  }
};
