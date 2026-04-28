/**
 * ============================================
 * FitFlow Caraguá — Gestão de Treinos (Admin + Aluno)
 * ============================================
 * Módulo que combina duas visões:
 * 
 * 1. TreinosView (Admin): Criar, editar e gerenciar fichas
 *    de treino dos alunos com exercícios personalizados.
 * 
 * 2. MeuTreinoView (Aluno): Visualizar treinos ativos,
 *    registrar cargas e acompanhar evolução.
 * 
 * Regras de permissão:
 * - Admin pode CRUD completo de treinos
 * - Aluno pode apenas visualizar e registrar cargas
 */

// ============================================
// VISÃO DO ADMIN — GESTÃO DE TREINOS
// ============================================

const TreinosView = {

  /** Cache de alunos e exercícios do catálogo para use nos selects */
  alunosCache: [],
  catalogoCache: [],
  currentStudentId: null,

  /**
   * Inicializa a página de treinos.
   * Carrega dados e configura eventos de interface.
   */
  async inicializar() {
    this.currentStudentId = null;
    await this.carregarAlunosParaPerfis();
    this.configurarEventos();
  },

  /**
   * Configura listeners de eventos da página.
   */
  configurarEventos() {
    const btnNovo = document.getElementById('btn-novo-treino');
    if (btnNovo) {
      // Remover event listeners antigos clonando o nó para evitar multiplos listeners
      const newBtn = btnNovo.cloneNode(true);
      btnNovo.parentNode.replaceChild(newBtn, btnNovo);
      newBtn.addEventListener('click', () => this.abrirModalCriar());
    }
  },

  /**
   * Carrega a lista de alunos e exibe como perfis (cards).
   */
  async carregarAlunosParaPerfis() {
    try {
      const resp = await API.get('/alunos');
      this.alunosCache = resp.data || [];
      this.renderizarGradeAlunos(this.alunosCache);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
      Toast.error('Erro ao carregar alunos.');
    }
  },

  /**
   * Renderiza os cards de alunos na grade
   */
  renderizarGradeAlunos(alunos) {
    const grid = document.getElementById('treinos-alunos-grid');
    if (!grid) return;

    if (alunos.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum aluno encontrado.</div>';
      return;
    }

    grid.innerHTML = alunos.map(a => {
      const nome = a.user?.name || 'Aluno Sem Nome';
      const email = a.user?.email || '';
      const status = a.active ? 'Ativo' : 'Inativo';
      const badgeClass = a.active ? 'badge-success' : 'badge-secondary';
      return `
        <div class="kpi-card" onclick="TreinosView.abrirPerfilAluno(${a.id}, '${nome.replace(/'/g, "\\'")}')" style="cursor: pointer; transition: transform 0.2s ease; display:flex; flex-direction:column; gap:1rem;">
          <div style="display:flex; align-items:center; gap:1rem;">
            <div class="kpi-icon blue"><i data-lucide="user"></i></div>
            <div class="kpi-content" style="flex:1;">
              <div class="kpi-label" style="font-size:1.1rem; font-weight:600; color:var(--text-primary);">${nome}</div>
              <div style="font-size:0.85rem; color:var(--text-muted);">${email}</div>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
            <span class="badge ${badgeClass}">${status}</span>
            <span style="color:var(--primary-500); font-size:0.9rem; font-weight:500; display:flex; align-items:center; gap:0.25rem;">
              Ver Treinos <i data-lucide="arrow-right" style="width:14px;height:14px"></i>
            </span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons({ nodes: [grid] });
  },

  filtrarAlunos(termo) {
    termo = termo.toLowerCase();
    const filtrados = this.alunosCache.filter(a => {
      const nome = (a.user?.name || '').toLowerCase();
      const email = (a.user?.email || '').toLowerCase();
      return nome.includes(termo) || email.includes(termo);
    });
    this.renderizarGradeAlunos(filtrados);
  },

  async abrirPerfilAluno(studentId, studentName) {
    this.currentStudentId = studentId;
    document.getElementById('treinos-view-alunos').style.display = 'none';
    document.getElementById('treinos-view-fichas').style.display = 'block';
    
    const titulo = document.getElementById('treinos-aluno-nome');
    if (titulo) titulo.textContent = `Treinos de ${studentName}`;
    
    await this.carregarTreinos(studentId);
  },

  voltarParaPerfis() {
    this.currentStudentId = null;
    document.getElementById('treinos-view-alunos').style.display = 'block';
    document.getElementById('treinos-view-fichas').style.display = 'none';
    // Limpa a tabela para não vazar info visualmente
    const tbody = document.getElementById('treinos-table-body');
    if (tbody) tbody.innerHTML = '';
  },

  /**
   * Carrega a lista de treinos via API para o aluno selecionado.
   */
  async carregarTreinos(studentId) {
    try {
      const resp = await API.get(`/treinos?studentId=${studentId}`);
      this.renderizarTabela(resp.data || []);
    } catch (error) {
      console.error('Erro ao carregar treinos:', error);
      Toast.error('Erro ao carregar treinos.');
    }
  },

  /**
   * Carrega o catálogo de exercícios para montar selects.
   */
  async carregarCatalogo() {
    try {
      const resp = await API.get('/exercicios');
      this.catalogoCache = resp.data || [];
    } catch (error) {
      console.warn('Erro ao carregar catálogo:', error.message);
    }
  },

  renderizarTabela(treinos) {
    const tbody = document.getElementById('treinos-table-body');
    if (!tbody) return;

    if (treinos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted)">
            <i data-lucide="clipboard-list" style="width:40px;height:40px;opacity:0.3;display:block;margin:0 auto 0.5rem"></i>
            Nenhum treino cadastrado ainda.
          </td>
        </tr>`;
      if (window.lucide) lucide.createIcons({ nodes: [tbody] });
      return;
    }

    tbody.innerHTML = treinos.map(t => {
      const qtdExercicios = t.exercises?.length || 0;
      const dataCriacao = new Date(t.createdAt).toLocaleDateString('pt-BR');

      return `
        <tr style="border-bottom: 1px solid var(--border-color); transition: background var(--transition-fast);">
          <td style="padding:0.75rem 0.5rem">
            <div style="font-weight:600; color:var(--text-primary)">${t.name}</div>
            ${t.description ? `<div style="font-size:var(--font-size-xs); color:var(--text-muted); margin-top:2px">${t.description}</div>` : ''}
          </td>
          <td style="padding:0.75rem 0.5rem; text-align:center">
            <span class="badge badge-info">${qtdExercicios}</span>
          </td>
          <td style="padding:0.75rem 0.5rem; color:var(--text-secondary); font-size:var(--font-size-sm)">${dataCriacao}</td>
          <td style="padding:0.75rem 0.5rem">
            <span class="badge ${t.active ? 'badge-success' : 'badge-secondary'}">${t.active ? 'Ativo' : 'Inativo'}</span>
          </td>
          <td style="padding:0.75rem 0.5rem">
            <div style="display:flex; gap:0.5rem">
              <button class="btn btn-sm btn-ghost" onclick="TreinosView.abrirModalDetalhe(${t.id})" title="Ver detalhes" style="cursor:pointer">
                <i data-lucide="eye" style="width:16px;height:16px"></i>
              </button>
              ${t.active ? `
                <button class="btn btn-sm btn-ghost" onclick="TreinosView.abrirModalEditar(${t.id})" title="Editar" style="cursor:pointer">
                  <i data-lucide="pencil" style="width:16px;height:16px"></i>
                </button>
                <button class="btn btn-sm btn-ghost" onclick="TreinosView.confirmarDesativar(${t.id}, '${t.name.replace(/'/g, "\\'")}')" title="Desativar" style="cursor:pointer; color:var(--error)">
                  <i data-lucide="archive" style="width:16px;height:16px"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons({ nodes: [tbody] });
  },

  /**
   * Abre o modal de detalhes de um treino.
   * Exibe todas as informações de forma organizada.
   * @param {number} id - ID do treino
   */
  async abrirModalDetalhe(id) {
    try {
      const resp = await API.get(`/treinos/${id}`);
      const t = resp.data;
      const nomeAluno = t.student?.user?.name || 'N/A';
      const nomeInstrutor = t.instructor?.name || 'N/A';

      const exerciciosHtml = (t.exercises || []).map((ex, i) => {
        // Verifica se tem último log de carga
        const ultimaCarga = ex.workoutLogs && ex.workoutLogs[0]
          ? `${ex.workoutLogs[0].weight}kg (${new Date(ex.workoutLogs[0].createdAt).toLocaleDateString('pt-BR')})`
          : '—';

        return `
          <div class="treino-exercicio-card" style="background:var(--bg-elevated); border-radius:var(--radius-md); padding:0.75rem 1rem; margin-bottom:0.5rem; border-left:3px solid var(--primary-500)">
            <div style="display:flex; justify-content:space-between; align-items:center">
              <div>
                <span style="color:var(--text-muted); font-size:var(--font-size-xs); margin-right:0.5rem">#${i + 1}</span>
                <strong style="color:var(--text-primary)">${ex.name}</strong>
                ${ex.muscleGroup ? `<span class="badge badge-info" style="margin-left:0.5rem; font-size:0.65rem">${ex.muscleGroup}</span>` : ''}
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.75rem; margin-top:0.5rem; font-size:var(--font-size-sm)">
              <div><span style="color:var(--text-muted)">Séries:</span> <strong>${ex.sets}</strong></div>
              <div><span style="color:var(--text-muted)">Reps:</span> <strong>${ex.reps}</strong></div>
              <div><span style="color:var(--text-muted)">Carga Sugerida:</span> <strong>${ex.suggestedLoad || '—'}</strong></div>
              <div><span style="color:var(--text-muted)">Última Carga:</span> <strong>${ultimaCarga}</strong></div>
            </div>
            ${ex.notes ? `<div style="margin-top:0.4rem; font-size:var(--font-size-xs); color:var(--text-muted); font-style:italic"><i data-lucide="message-circle" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px"></i>${ex.notes}</div>` : ''}
          </div>`;
      }).join('');

      const html = `
        <div style="margin-bottom:1rem">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem">
            <div><span style="color:var(--text-muted);font-size:var(--font-size-sm)">Aluno:</span><br><strong>${nomeAluno}</strong></div>
            <div><span style="color:var(--text-muted);font-size:var(--font-size-sm)">Instrutor:</span><br><strong>${nomeInstrutor}</strong></div>
          </div>
          ${t.description ? `<p style="color:var(--text-secondary); font-size:var(--font-size-sm); margin-bottom:0.5rem">${t.description}</p>` : ''}
          ${t.notes ? `<p style="color:var(--text-muted); font-size:var(--font-size-xs); font-style:italic">📝 ${t.notes}</p>` : ''}
        </div>
        <h4 style="margin-bottom:0.75rem; color:var(--primary-400); font-family:var(--font-heading)">
          <i data-lucide="list-ordered" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px"></i>
          Exercícios (${t.exercises?.length || 0})
        </h4>
        <div style="max-height:400px; overflow-y:auto">
          ${exerciciosHtml || '<p style="color:var(--text-muted)">Nenhum exercício.</p>'}
        </div>`;

      Modal.open(`Treino: ${t.name}`, html, [
        { text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() },
      ]);
    } catch (error) {
      Toast.error('Erro ao carregar detalhes do treino.');
    }
  },

  // ============================================
  // CRIAÇÃO E EDIÇÃO DE TREINOS
  // ============================================

  /**
   * Abre o modal de criação de treino.
   * Carrega alunos e catálogo antes de exibir.
   */
  async abrirModalCriar() {
    if (this.alunosCache.length === 0) {
      try {
        const resp = await API.get('/alunos');
        this.alunosCache = resp.data || [];
      } catch (e) { /* fallback */ }
    }
    await this.carregarCatalogo();

    const alunosOptions = this.alunosCache.map(a => {
      const selected = (this.currentStudentId && a.id == this.currentStudentId) ? 'selected' : '';
      return `<option value="${a.id}" ${selected}>${a.user?.name || 'Aluno'} — ${a.user?.email || ''}</option>`;
    }).join('');

    const html = this.renderizarConstrutorTreinoLayout(alunosOptions, false);

    Modal.open('Construtor de Treino', html, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Salvar Treino', class: 'btn-primary', action: () => this.salvarTreino() },
    ]);

    this.iniciarConstrutor();
  },

  /**
   * Abre o modal de edição com dados do treino pré-preenchidos.
   * @param {number} id - ID do treino
   */
  async abrirModalEditar(id) {
    try {
      const resp = await API.get(`/treinos/${id}`);
      const t = resp.data;

      if (this.alunosCache.length === 0) {
        try {
          const aResp = await API.get('/alunos');
          this.alunosCache = aResp.data || [];
        } catch (e) { /* fallback */ }
      }
      await this.carregarCatalogo();

      const html = this.renderizarConstrutorTreinoLayout('', true, t);

      Modal.open(`Editar Treino: ${t.name}`, html, [
        { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
        { text: 'Salvar Alterações', class: 'btn-primary', action: () => this.salvarTreino(t.id) },
      ]);

      this.iniciarConstrutor();

      // Preenche exercícios existentes
      if (t.exercises && t.exercises.length > 0) {
        t.exercises.forEach(ex => this.adicionarExercicio(ex));
      }
    } catch (error) {
      Toast.error('Erro ao carregar treino para edição.');
    }
  },

  /**
   * Renderiza o layout principal do construtor de treinos (Hevy-Style).
   * Este layout é dividido em duas colunas: Catálogo de Exercícios e Rotina Atual.
   * @param {string} alunosOptions - Opções HTML do select de alunos
   * @param {boolean} isEdit - Define se é modo edição
   * @param {object} t - Dados do treino caso seja edição
   * @returns {string} HTML completo do layout
   */
  renderizarConstrutorTreinoLayout(alunosOptions, isEdit = false, t = null) {
    return `
      <style>
        #modal { max-width: 1000px !important; width: 95% !important; }
        .hevy-layout { display: flex; gap: 1.5rem; height: 65vh; min-height: 500px; }
        .hevy-catalog { flex: 1; border-right: 1px solid var(--border-color); padding-right: 1.5rem; display: flex; flex-direction: column; overflow: hidden; }
        .hevy-workout { flex: 1.2; display: flex; flex-direction: column; overflow: hidden; }
        .hevy-catalog-list { flex: 1; overflow-y: auto; padding-right: 0.5rem; margin-top: 1rem; }
        .hevy-workout-list { flex: 1; overflow-y: auto; padding-right: 0.5rem; }
        
        .cat-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 0.5rem; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .cat-item:hover { border-color: var(--primary-500); transform: translateY(-2px); box-shadow: var(--shadow-sm); z-index: 2; }
        .cat-add-btn { position: absolute; right: 0.75rem; background: var(--bg-elevated); border: none; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary-400); cursor: pointer; opacity: 0.5; transition: 0.2s; }
        .cat-item:hover .cat-add-btn { opacity: 1; background: var(--primary-500); color: white; }
        
        .exercicio-item { background:var(--bg-elevated); border-radius:var(--radius-md); border-left:4px solid var(--primary-500); position:relative; display: flex; flex-direction: column; margin-bottom: 1rem; box-shadow: var(--shadow-sm); }
        .exercicio-item.sortable-ghost { opacity: 0.3; border-style: dashed; }
        .exercicio-item.sortable-drag { cursor: grabbing !important; box-shadow: var(--shadow-lg); opacity: 1; }
        .grip-handle { cursor: grab; color: var(--text-muted); padding: 0.5rem; display: flex; align-items: center; justify-content: center; opacity: 0.6; }
        .grip-handle:hover { opacity: 1; }
        .grip-handle:active { cursor: grabbing; color: var(--primary-500); }
        
        .ex-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.1); }
        .ex-body { padding: 1rem; }
        .ex-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
        .form-mini-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem; color: var(--text-muted); }
      </style>
      <div class="hevy-layout">
        <!-- CATÁLOGO -->
        <div class="hevy-catalog">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
            <h4 style="margin:0; color:var(--text-primary); font-family:var(--font-heading)">
              <i data-lucide="dumbbell" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px"></i>
              Catálogo
            </h4>
          </div>
          <input type="text" id="cat-search" placeholder="Buscar exercício..." oninput="TreinosView.filtrarCatalogo(this.value)" style="padding:0.75rem; border:1px solid var(--border-color); border-radius:var(--radius-md); width:100%; box-sizing:border-box; background:var(--bg-surface); color:var(--text-primary)">
          
          <div class="hevy-catalog-list" id="catalogo-list"></div>
        </div>
        
        <!-- FICHA DE TREINO -->
        <div class="hevy-workout">
          <form id="form-treino" style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1rem; flex-shrink:0;">
            ${isEdit ? `<input type="hidden" id="treino-id" value="${t.id}">` : ''}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem">
              <div style="display:flex; flex-direction:column; gap:0.25rem">
                <label class="form-mini-label">Aluno</label>
                ${isEdit 
                  ? `<input type="text" value="${t.student?.user?.name || 'N/A'}" disabled style="opacity:0.6; padding:0.5rem; background:var(--bg-elevated); border:none; border-radius:4px; color:var(--text-primary)">` 
                  : `<select id="treino-aluno" required style="padding:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary)"><option value="">Selecione...</option>${alunosOptions}</select>`}
              </div>
              <div style="display:flex; flex-direction:column; gap:0.25rem">
                <label class="form-mini-label">Nome da Rotina</label>
                <input type="text" id="treino-nome" value="${isEdit ? t.name : ''}" placeholder="Ex: Treino A" required style="padding:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary)">
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem">
              <label class="form-mini-label">Descrição (Opcional)</label>
              <input type="text" id="treino-descricao" value="${isEdit ? (t.description||'') : ''}" placeholder="Ex: Foco em hipertrofia de superiores" style="padding:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary)">
            </div>
          </form>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-shrink:0; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color)">
            <h4 style="margin:0; color:var(--primary-400); font-family:var(--font-heading)">
              <i data-lucide="list-ordered" style="width:18px;height:18px;display:inline;vertical-align:middle;margin-right:6px"></i>
              Rotina <span id="qtd-exercicios" style="font-size:12px;color:var(--text-muted);font-weight:normal">(0)</span>
            </h4>
            <div style="font-size:11px; color:var(--text-muted); background:var(--bg-elevated); padding:4px 10px; border-radius:12px; display:flex; align-items:center; gap:4px;">
              <i data-lucide="grip-horizontal" style="width:12px;height:12px"></i> Arraste para reordenar
            </div>
          </div>
          
          <div class="hevy-workout-list" id="exercicios-container">
            <!-- Exercícios droppados ficarão aqui -->
            <div class="empty-routine" style="text-align:center; padding: 2rem; color: var(--text-muted); opacity: 0.6">
              Clicar/arrastar exercícios do catálogo
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Inicializa a lógica do construtor após o modal ser aberto.
   * Configura o Sortable.js para drag-and-drop e renderiza o catálogo inicial.
   */
  iniciarConstrutor() {
    setTimeout(() => {
      this.renderizarCatalogoLista();

      const container = document.getElementById('exercicios-container');
      if (container && window.Sortable) {
        new Sortable(container, {
          handle: '.grip-handle',
          animation: 200,
          ghostClass: 'sortable-ghost',
          dragClass: 'sortable-drag',
          onEnd: () => this.atualizarIndices()
        });
      }
    }, 100);
  },

  /**
   * Renderiza a lista de exercícios no painel esquerdo (Catálogo).
   * @param {string} filtro - Termo de busca para filtrar exercícios
   */
  renderizarCatalogoLista(filtro = '') {
    const listEl = document.getElementById('catalogo-list');
    if (!listEl) return;

    filtro = filtro.toLowerCase();
    const filtrados = this.catalogoCache.filter(c => 
      c.nome.toLowerCase().includes(filtro) || 
      c.grupo_muscular.toLowerCase().includes(filtro)
    );

    if (filtrados.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:1rem">Nenhum encontrado.</p>';
      return;
    }

    listEl.innerHTML = filtrados.map(c => `
      <div class="cat-item" onclick="TreinosView.adicionarExercicioFromCatalogo(${c.id})">
        <div style="width:40px;height:40px; border-radius:6px; background:var(--bg-elevated); flex-shrink:0; overflow:hidden">
           ${c.imagem_url ? `<img src="${c.imagem_url}" style="width:100%;height:100%;object-fit:cover">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.5"><i data-lucide="image" style="width:16px;height:16px"></i></div>`}
        </div>
        <div style="flex:1; min-width:0">
          <div style="font-weight:600; color:var(--text-primary); font-size:var(--font-size-sm); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${c.nome}</div>
          <div style="font-size:11px; color:var(--text-muted)">${c.grupo_muscular}</div>
        </div>
        <button class="cat-add-btn"><i data-lucide="plus" style="width:14px;height:14px"></i></button>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons({ nodes: [listEl] });
  },

  /**
   * Handler para o campo de busca do catálogo.
   * @param {string} valor - Valor digitado no input
   */
  filtrarCatalogo(valor) {
    this.renderizarCatalogoLista(valor);
  },

  /**
   * Adiciona um exercício do catálogo diretamente na lista da rotina.
   * @param {number} idCatalogo - ID do exercício no banco
   */
  adicionarExercicioFromCatalogo(idCatalogo) {
    const catData = this.catalogoCache.find(c => c.id === idCatalogo);
    if (catData) {
      this.adicionarExercicio({
        name: catData.nome,
        muscleGroup: catData.grupo_muscular,
        sets: 3,
        reps: '12'
      });
    }
  },

  adicionarExercicio(dados = null) {
    const container = document.getElementById('exercicios-container');
    if (!container) return;

    // Remove empty state message
    const emptyMsg = container.querySelector('.empty-routine');
    if (emptyMsg) emptyMsg.remove();

    const div = document.createElement('div');
    div.className = 'exercicio-item';

    div.innerHTML = `
      <div class="ex-header">
        <div style="display:flex; align-items:center; gap:0.5rem">
          <span class="exercicio-numero" style="font-weight:bold; color:var(--primary-400); font-size:var(--font-size-sm)">#0</span>
          <div style="font-weight:600; color:var(--text-primary)">
            <input type="text" class="ex-nome" value="${dados ? dados.name : ''}" style="background:transparent; border:none; color:inherit; font-weight:inherit; font-family:inherit; font-size:inherit; width:200px; padding:0" required>
          </div>
          <input type="text" class="ex-grupo" value="${dados ? (dados.muscleGroup || '') : ''}" style="background:var(--bg-surface); border:none; color:var(--text-muted); font-size:11px; padding:2px 6px; border-radius:10px; width:80px; margin-left:8px" placeholder="Grupo...">
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem">
          <div class="grip-handle" title="Arraste para reordenar">
            <i data-lucide="grip-horizontal" style="width:16px;height:16px"></i>
          </div>
          <button type="button" class="btn-icon" onclick="this.closest('.exercicio-item').remove(); TreinosView.atualizarIndices()" 
            style="color:var(--error); width:28px; height:28px; background:transparent" title="Remover exercício">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
          </button>
        </div>
      </div>

      <div class="ex-body">
        <div class="ex-grid">
          <div style="display:flex; flex-direction:column; gap:0.2rem">
            <label class="form-mini-label">Séries</label>
            <input type="number" class="ex-series" value="${dados ? dados.sets : 3}" min="1" max="20" style="padding:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary); width:100%; box-sizing:border-box;">
          </div>
          <div style="display:flex; flex-direction:column; gap:0.2rem">
            <label class="form-mini-label">Repetições</label>
            <input type="text" class="ex-reps" value="${dados ? dados.reps : '12'}" placeholder="Ex: 12 ou 8-10" style="padding:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary); width:100%; box-sizing:border-box;">
          </div>
          <div style="display:flex; flex-direction:column; gap:0.2rem">
            <label class="form-mini-label">Carga (Opcional)</label>
            <input type="text" class="ex-carga" value="${dados ? (dados.suggestedLoad || '') : ''}" placeholder="Ex: 40kg" style="padding:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary); width:100%; box-sizing:border-box;">
          </div>
        </div>
        <div style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.2rem">
          <label class="form-mini-label">Observações (Opcional)</label>
          <input type="text" class="ex-obs" value="${dados ? (dados.notes || '') : ''}" placeholder="Dicas de execução, como falha ou ritmo." style="padding:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary); width:100%; box-sizing:border-box; font-size:12px;">
        </div>
      </div>
    `;

    container.appendChild(div);
    if (window.lucide) lucide.createIcons({ nodes: [div] });
    
    // Anima sutilmente
    div.animate([
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 200, easing: 'ease-out' });

    this.atualizarIndices();
  },

  atualizarIndices() {
    const container = document.getElementById('exercicios-container');
    const labelQtd = document.getElementById('qtd-exercicios');
    if (!container) return;

    // Ignora a empty state message ao contar e atualizar os inputs reais
    const items = container.querySelectorAll('.exercicio-item');
    
    if (labelQtd) labelQtd.textContent = `(${items.length})`;
    
    if (items.length === 0) {
      if (!container.querySelector('.empty-routine')) {
        container.innerHTML = `<div class="empty-routine" style="text-align:center; padding: 2rem; color: var(--text-muted); opacity: 0.6">Clicar/arrastar exercícios do catálogo</div>`;
      }
      return;
    }

    items.forEach((item, i) => {
      const numero = item.querySelector('.exercicio-numero');
      if (numero) numero.textContent = `#${i + 1}`;
    });
  },

  /**
   * Coleta os dados do formulário e salva o treino via API.
   * @param {number|null} id - ID do treino (null = criação)
   */
  async salvarTreino(id = null) {
    const nome = document.getElementById('treino-nome').value.trim();
    const descricao = document.getElementById('treino-descricao').value.trim();
    const alunoSelect = document.getElementById('treino-aluno');
    const studentId = alunoSelect ? alunoSelect.value : null;

    // Coleta exercícios do formulário dinâmico
    const container = document.getElementById('exercicios-container');
    const items = container.querySelectorAll('.exercicio-item');
    const exercises = [];

    items.forEach((item) => {
      const name = item.querySelector('.ex-nome').value.trim();
      if (!name) return; // Ignora exercícios sem nome

      exercises.push({
        name,
        muscleGroup: item.querySelector('.ex-grupo').value.trim() || null,
        sets: parseInt(item.querySelector('.ex-series').value) || 3,
        reps: item.querySelector('.ex-reps').value.trim() || '12',
        suggestedLoad: item.querySelector('.ex-carga').value.trim() || null,
        notes: item.querySelector('.ex-obs').value.trim() || null,
      });
    });

    // Validações básicas
    if (!nome) {
      Toast.warning('Informe o nome do treino.');
      return;
    }

    if (exercises.length === 0) {
      Toast.warning('Adicione pelo menos um exercício ao treino.');
      return;
    }

    const payload = { name: nome, description: descricao, exercises };

    try {
      if (id) {
        // Edição
        await API.put(`/treinos/${id}`, payload);
        Toast.success('Treino atualizado com sucesso!');
      } else {
        // Criação — precisa do studentId
        if (!studentId) {
          Toast.warning('Selecione o aluno para o treino.');
          return;
        }
        payload.studentId = parseInt(studentId);
        await API.post('/treinos', payload);
        Toast.success('Treino criado com sucesso!');
      }

      Modal.close();
      if (this.currentStudentId) {
        await this.carregarTreinos(this.currentStudentId);
      }
    } catch (error) {
      Toast.error(error.message || 'Erro ao salvar treino.');
    }
  },

  /**
   * Exibe confirmação antes de desativar um treino.
   * @param {number} id - ID do treino
   * @param {string} nome - Nome do treino
   */
  confirmarDesativar(id, nome) {
    Modal.confirm(
      `Deseja desativar o treino <strong>"${nome}"</strong>?<br>O histórico completo será preservado.`,
      async () => {
        try {
          await API.delete(`/treinos/${id}`);
          Toast.success('Treino desativado com sucesso!');
          if (this.currentStudentId) {
            await this.carregarTreinos(this.currentStudentId);
          }
        } catch (error) {
          Toast.error(error.message || 'Erro ao desativar treino.');
        }
      },
      'Desativar'
    );
  },
};


// ============================================
// VISÃO DO ALUNO — MEU TREINO
// ============================================

const MeuTreinoView = {

  /**
   * Inicializa a página "Meu Treino" para o aluno.
   * Carrega os treinos ativos do aluno logado.
   */
  async inicializar() {
    await this.carregarMeusTreinos();
  },

  /**
   * Carrega os treinos ativos do aluno via API.
   */
  async carregarMeusTreinos() {
    const container = document.getElementById('meu-treino-container');
    if (!container) return;

    try {
      const resp = await API.get('/treinos/meus');
      const treinos = resp.data || [];

      if (treinos.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="text-align:center; padding:3rem">
            <i data-lucide="clipboard-x" style="width:64px; height:64px; opacity:0.3; margin-bottom:1rem"></i>
            <h3 style="color:var(--text-primary)">Nenhum treino ativo</h3>
            <p style="color:var(--text-muted)">Seu instrutor ainda não criou uma ficha de treino para você. Procure a recepção para mais informações.</p>
          </div>`;
        if (window.lucide) lucide.createIcons({ nodes: [container] });
        return;
      }

      this.renderizarTreinos(treinos, container);
    } catch (error) {
      console.error('Erro ao carregar meus treinos:', error);
      container.innerHTML = '<p style="color:var(--error)">Erro ao carregar seus treinos. Tente novamente.</p>';
    }
  },

  /**
   * Renderiza os treinos do aluno como cards com exercícios expansíveis.
   * @param {Array} treinos - Lista de treinos ativos
   * @param {HTMLElement} container - Container DOM
   */
  renderizarTreinos(treinos, container) {
    container.innerHTML = treinos.map(t => {
      const instrutorNome = t.instructor?.name || 'Instrutor';
      const dataCriacao = new Date(t.createdAt).toLocaleDateString('pt-BR');

      const exerciciosHtml = (t.exercises || []).map((ex, i) => {
        // Mostra a última carga registrada, se houver
        const ultimaCarga = ex.workoutLogs && ex.workoutLogs[0]
          ? `<span style="color:var(--accent-400); font-weight:600">${ex.workoutLogs[0].weight}kg</span>`
          : '<span style="color:var(--text-muted)">—</span>';

        return `
          <div class="meu-exercicio-item" style="background:var(--bg-surface); border-radius:var(--radius-md); padding:0.75rem; margin-bottom:0.75rem; border:1px solid var(--border-color); transition: transform var(--transition-fast)">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem">
              <div style="display:flex; align-items:center; gap:0.5rem">
                <span style="color:var(--primary-400); font-size:var(--font-size-sm); font-weight:bold; background:var(--bg-elevated); width:24px; height:24px; display:flex; align-items:center; justify-content:center; border-radius:50%">${i + 1}</span>
                <strong style="color:var(--text-primary); font-size:var(--font-size-base)">${ex.name}</strong>
              </div>
              <button class="btn btn-sm btn-primary" onclick="MeuTreinoView.abrirRegistroCarga(${ex.id}, '${ex.name.replace(/'/g, "\\'")}')" style="cursor:pointer; white-space:nowrap; padding: 4px 10px; font-size:12px">
                <i data-lucide="plus" style="width:12px;height:12px"></i> Carga
              </button>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.5rem; text-align:center; font-size:var(--font-size-sm); color:var(--text-primary);">
               <div style="background:var(--bg-elevated); padding:0.5rem; border-radius:6px">
                 <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px">Séries × Reps</div>
                 <div style="font-weight:600">${ex.sets} × ${ex.reps}</div>
               </div>
               <div style="background:var(--bg-elevated); padding:0.5rem; border-radius:6px">
                 <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px">Sugerido</div>
                 <div style="font-weight:600">${ex.suggestedLoad || '-'}</div>
               </div>
               <div style="background:var(--bg-elevated); padding:0.5rem; border-radius:6px">
                 <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px">Última</div>
                 <div style="font-weight:600">${ultimaCarga}</div>
               </div>
            </div>
            ${ex.notes ? `<div style="font-size:var(--font-size-xs); color:var(--text-muted); margin-top:0.5rem; padding:0.5rem; background:rgba(255,255,255,0.03); border-radius:4px; font-style:italic"><i data-lucide="info" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px"></i>${ex.notes}</div>` : ''}
          </div>`;
      }).join('');

      return `
        <div class="treino-card-aluno" style="background:var(--bg-elevated); border-radius:var(--radius-lg); padding:1.5rem; margin-bottom:1.5rem; box-shadow:var(--shadow-md); transition:box-shadow var(--transition-base)">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
            <div>
              <h3 style="color:var(--primary-400); font-family:var(--font-heading); font-size:var(--font-size-xl); margin:0">${t.name}</h3>
              ${t.description ? `<p style="color:var(--text-secondary); font-size:var(--font-size-sm); margin:0.25rem 0 0">${t.description}</p>` : ''}
            </div>
            <div style="text-align:right; font-size:var(--font-size-xs); color:var(--text-muted)">
              <div>Por: ${instrutorNome}</div>
              <div>${dataCriacao}</div>
            </div>
          </div>
          <div class="treino-exercicios-lista">
            ${exerciciosHtml}
          </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },

  /**
   * Abre modal para o aluno registrar a carga executada.
   * @param {number} exerciseId - ID do exercício
   * @param {string} nome - Nome do exercício
   */
  abrirRegistroCarga(exerciseId, nome) {
    const html = `
      <form id="form-carga" style="display:flex; flex-direction:column; gap:1rem">
        <p style="color:var(--text-secondary)">Registre a carga que você executou:</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem">
          <div class="form-group">
            <label for="carga-peso"><i data-lucide="weight" style="width:14px;height:14px"></i> Carga (kg)</label>
            <input type="number" id="carga-peso" step="0.5" min="0" placeholder="Ex: 42.5" required>
          </div>
          <div class="form-group">
            <label for="carga-reps"><i data-lucide="repeat" style="width:14px;height:14px"></i> Repetições Feitas</label>
            <input type="number" id="carga-reps" min="1" placeholder="Ex: 10">
          </div>
        </div>
        <div class="form-group">
          <label for="carga-obs"><i data-lucide="message-circle" style="width:14px;height:14px"></i> Observação (opcional)</label>
          <input type="text" id="carga-obs" placeholder="Ex: Últimas 2 reps com ajuda">
        </div>
      </form>`;

    Modal.open(`Registrar Carga: ${nome}`, html, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      {
        text: 'Salvar Carga',
        class: 'btn-primary',
        action: () => this.salvarCarga(exerciseId),
      },
    ]);
  },

  /**
   * Envia o registro de carga do aluno para a API.
   * @param {number} exerciseId - ID do exercício
   */
  async salvarCarga(exerciseId) {
    const weight = document.getElementById('carga-peso').value;
    const repsCompleted = document.getElementById('carga-reps').value;
    const notes = document.getElementById('carga-obs').value.trim();

    if (!weight || parseFloat(weight) <= 0) {
      Toast.warning('Informe uma carga válida.');
      return;
    }

    try {
      await API.post('/treinos/carga', {
        exerciseId,
        weight: parseFloat(weight),
        repsCompleted: repsCompleted ? parseInt(repsCompleted) : null,
        notes: notes || null,
      });

      Toast.success('Carga registrada com sucesso! 💪');
      Modal.close();

      // Recarrega para atualizar a última carga exibida
      await this.carregarMeusTreinos();
    } catch (error) {
      Toast.error(error.message || 'Erro ao registrar carga.');
    }
  },
};
