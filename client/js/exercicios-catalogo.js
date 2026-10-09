/**
 * ============================================
 * FitFlow Caraguá — Catálogo de Exercícios (Admin)
 * ============================================
 * Tela administrativa para gerenciar o catálogo geral
 * de exercícios disponíveis na academia.
 * 
 * O catálogo é a "biblioteca" de exercícios que o instrutor
 * pode usar ao montar fichas de treino. Cada exercício tem
 * nome, grupo muscular e instruções de execução.
 * 
 * Funcionalidades:
 * - Listagem com filtro por grupo muscular
 * - Criação de novos exercícios
 * - Edição de exercícios existentes
 * - Desativação (soft delete)
 */

const ExerciciosCatalogoView = {

  escapar(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  },

  urlSegura(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  },

  grupos: ['Peito', 'Costas', 'Pernas', 'Ombros', 'Bíceps', 'Tríceps', 'Abdômen', 'Glúteos', 'Antebraço',
    'Panturrilhas', 'Braços', 'Cardio', 'Funcional', 'Múltiplos', 'Outros', 'Não informado'],

  opcoesGrupos(selected = '') {
    const groups = [...new Set([...this.grupos, ...(selected ? [selected] : [])])];
    return groups.map(g => `<option value="${this.escapar(g)}" ${selected === g ? 'selected' : ''}>${this.escapar(g)}</option>`).join('');
  },

  renderizarFonte(ex) {
    if (ex.source !== 'wger') return '<small>Cadastro local · revisão da academia</small>';
    const meta = ex.sourceMetadata || {};
    const link = (url, label) => {
      const safe = this.urlSegura(url);
      return safe ? `<a href="${this.escapar(safe)}" target="_blank" rel="noopener noreferrer">${this.escapar(label)}</a>` : this.escapar(label);
    };
    const credit = item => `${this.escapar(item?.author || 'Autoria não informada')} · ${link(item?.license?.url, item?.license?.code || 'Licença não informada')}`;
    const names = items => Array.isArray(items) && items.length ? this.escapar(items.map(item => item.name).join(', ')) : 'Não informados';
    const locale = ex.curated ? 'Edição local; idioma de origem: ' : 'Idioma: ';
    const language = ex.locale === 'pt' ? 'português' : ex.locale === 'en' ? 'inglês (sem tradução PT elegível)' : this.escapar(ex.locale || 'não informado');
    const assets = (Array.isArray(meta.media) ? meta.media : []).map(asset =>
      `<li>${link(asset.url, `Imagem #${asset.id}`)}: ${credit(asset)}</li>`).join('');
    return `<details style="font-size:var(--font-size-xs); margin-top:0.4rem; white-space:normal; max-width:440px">
      <summary>wger · ${ex.curated ? 'adaptado pela academia' : 'conteúdo da fonte'} · ${language}</summary>
      <p>${locale}${language}. ${link(meta.sourceUrl, `Fonte wger #${ex.externalId || ''}`)}</p>
      <p>Texto de origem: ${this.escapar(meta.text?.originalName || ex.nome)}. ${credit(meta.text)}.
        HTML convertido em texto simples${ex.curated ? '; conteúdo editado localmente' : ''}.</p>
      <p>Dados de base: ${credit(meta.base)}.</p>
      <p>Músculos principais declarados pela fonte: ${names(meta.primaryMuscles)}.<br>
        Secundários: ${names(meta.secondaryMuscles)}.<br>Equipamentos: ${names(meta.equipment)}.</p>
      ${assets ? `<ul>${assets}</ul>` : '<p>Sem mídia da fonte com licença e autoria elegíveis.</p>'}
      <p>Catálogo descritivo de contribuições externas. A seleção, técnica e prescrição exigem avaliação do profissional.</p>
    </details>`;
  },

  /**
   * Ponto de entrada da página de exercícios.
   * Carrega a lista de exercícios e configura os eventos.
   */
  async inicializar() {
    await this.carregarExercicios();
    this.configurarEventos();
  },

  /**
   * Configura os listeners de eventos da página.
   * Inclui botão "Novo Exercício" e filtro por grupo muscular.
   */
  configurarEventos() {
    // Botão de novo exercício
    const btnNovo = document.getElementById('btn-novo-exercicio');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => this.abrirModalCriar());
    }

    // Filtro por grupo muscular
    const selectGrupo = document.getElementById('filtro-grupo-muscular');
    if (selectGrupo) {
      selectGrupo.addEventListener('change', () => this.carregarExercicios());
    }

    // Botão de sincronização API
    const btnSync = document.getElementById('btn-sync-wger');
    if (btnSync) {
      btnSync.addEventListener('click', () => this.sincronizarAPI());
    }
  },

  /**
   * Carrega a lista de exercícios do catálogo via API.
   * Aplica filtro de grupo muscular se selecionado.
   */
  async carregarExercicios() {
    try {
      // Monta query string com filtro se houver
      let endpoint = '/exercicios';
      const selectGrupo = document.getElementById('filtro-grupo-muscular');
      if (selectGrupo && selectGrupo.value) {
        endpoint += `?grupo_muscular=${encodeURIComponent(selectGrupo.value)}`;
      }

      const resp = await API.get(endpoint);
      this.renderizarTabela(resp.data || []);

      // Carrega os grupos musculares para o filtro (apenas na primeira vez)
      if (selectGrupo && selectGrupo.options.length <= 1) {
        await this.carregarGruposMusculares();
      }
    } catch (error) {
      console.error('Erro ao carregar exercícios:', error);
      Toast.error('Erro ao carregar catálogo de exercícios.');
    }
  },

  /**
   * Carrega os grupos musculares para o select de filtro.
   */
  async carregarGruposMusculares() {
    try {
      const resp = await API.get('/exercicios/grupos');
      const selectGrupo = document.getElementById('filtro-grupo-muscular');
      if (selectGrupo && resp.data) {
        resp.data.forEach(grupo => {
          const option = document.createElement('option');
          option.value = grupo;
          option.textContent = grupo;
          selectGrupo.appendChild(option);
        });
      }
    } catch (error) {
      console.warn('Erro ao carregar grupos musculares:', error.message);
    }
  },

  /**
   * Renderiza a tabela de exercícios no DOM.
   * Cada linha tem botões de ação (editar, desativar).
   * @param {Array} exercicios - Lista de exercícios do catálogo
   */
  renderizarTabela(exercicios) {
    const tbody = document.getElementById('exercicios-table-body');
    if (!tbody) return;

    if (exercicios.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted)">
            <i data-lucide="dumbbell" style="width:40px;height:40px;opacity:0.3;display:block;margin:0 auto 0.5rem"></i>
            Nenhum exercício cadastrado.
          </td>
        </tr>`;
      if (window.lucide) lucide.createIcons({ nodes: [tbody] });
      return;
    }

    tbody.innerHTML = exercicios.filter(ex => Number.isSafeInteger(ex.id) && ex.id > 0).map(ex => `
      <tr style="border-bottom: 1px solid var(--border-color); transition: background var(--transition-fast);">
        <td style="padding:0.75rem 0.5rem">
          <div style="display:flex; align-items:center; gap:0.75rem">
            <div style="width:48px;height:48px; flex-shrink:0; border-radius:8px; overflow:hidden; background:var(--bg-subtle)">
              ${this.urlSegura(ex.imagem_url) ? `<img src="${this.escapar(this.urlSegura(ex.imagem_url))}" style="width:100%;height:100%;object-fit:cover" alt="${this.escapar(ex.nome)}" loading="lazy" referrerpolicy="no-referrer">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.5"><i data-lucide="image" style="width:20px;height:20px"></i></div>'}
            </div>
            <div>
              <div style="font-weight:600; color:var(--text-primary)">${this.escapar(ex.nome)}</div>
              ${ex.instrucoes ? `<div style="font-size:var(--font-size-xs); color:var(--text-muted); margin-top:2px; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${this.escapar(ex.instrucoes)}">${this.escapar(ex.instrucoes)}</div>` : ''}
              ${this.renderizarFonte(ex)}
            </div>
          </div>
        </td>
        <td style="padding:0.75rem 0.5rem">
          <span class="badge badge-info">${this.escapar(ex.grupo_muscular)}</span>
        </td>
        <td style="padding:0.75rem 0.5rem">
          <span class="badge ${ex.ativo ? 'badge-success' : 'badge-secondary'}">${ex.ativo ? 'Ativo' : 'Inativo'}</span>
        </td>
        <td style="padding:0.75rem 0.5rem">
          <div style="display:flex; gap:0.5rem">
            <button class="btn btn-sm btn-ghost" data-action="editar" data-id="${ex.id}" title="Editar" style="cursor:pointer">
              <i data-lucide="pencil" style="width:16px;height:16px"></i>
            </button>
            ${ex.ativo ? `
              <button class="btn btn-sm btn-ghost" data-action="desativar" data-id="${ex.id}" title="Desativar" style="cursor:pointer; color:var(--error)">
                <i data-lucide="trash-2" style="width:16px;height:16px"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    tbody.onclick = event => {
      const button = event.target.closest('button[data-action]');
      if (!button || !tbody.contains(button)) return;
      const ex = exercicios.find(item => item.id === Number(button.dataset.id));
      if (!ex) return;
      if (button.dataset.action === 'editar') this.abrirModalEditar(ex.id);
      if (button.dataset.action === 'desativar') this.confirmarDesativar(ex.id, ex.nome);
    };

    if (window.lucide) lucide.createIcons({ nodes: [tbody] });
  },

  /**
   * Abre o modal de criação de exercício.
   * Formulário limpo para inserir nome, grupo e instruções.
   */
  abrirModalCriar() {
    const html = `
      <form id="form-exercicio" style="display:flex; flex-direction:column; gap:1rem">
        <div class="form-group">
          <label for="ex-nome"><i data-lucide="type" style="width:14px;height:14px"></i> Nome do Exercício</label>
          <input type="text" id="ex-nome" placeholder="Ex: Supino Reto com Barra" maxlength="100" required>
        </div>
        <div class="form-group">
          <label for="ex-grupo"><i data-lucide="layers" style="width:14px;height:14px"></i> Grupo Muscular</label>
          <select id="ex-grupo" required>
            <option value="">Selecione o grupo...</option>
            ${this.opcoesGrupos()}
          </select>
        </div>
        <div class="form-group">
          <label for="ex-imagem"><i data-lucide="image" style="width:14px;height:14px"></i> URL da Imagem (Opcional)</label>
          <input type="url" id="ex-imagem" placeholder="https://exemplo.com/imagem.jpg" maxlength="255">
        </div>
        <div class="form-group">
          <label for="ex-instrucoes"><i data-lucide="file-text" style="width:14px;height:14px"></i> Instruções de Execução</label>
          <textarea id="ex-instrucoes" rows="3" maxlength="10000" placeholder="Descreva como executar o exercício corretamente..."></textarea>
        </div>
      </form>`;

    Modal.open('Novo Exercício', html, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Salvar', class: 'btn-primary', action: () => this.salvarExercicio() },
    ]);
  },

  /**
   * Abre o modal de edição com dados pré-preenchidos.
   * Carrega o exercício por ID antes de exibir o formulário.
   * @param {number} id - ID do exercício
   */
  async abrirModalEditar(id) {
    try {
      const resp = await API.get(`/exercicios/${id}`);
      const ex = resp.data;

      const html = `
        <form id="form-exercicio" style="display:flex; flex-direction:column; gap:1rem">
          <input type="hidden" id="ex-id" value="${this.escapar(ex.id)}">
          <div class="form-group">
            <label for="ex-nome"><i data-lucide="type" style="width:14px;height:14px"></i> Nome do Exercício</label>
            <input type="text" id="ex-nome" value="${this.escapar(ex.nome)}" maxlength="100" required>
          </div>
          <div class="form-group">
            <label for="ex-grupo"><i data-lucide="layers" style="width:14px;height:14px"></i> Grupo Muscular</label>
            <select id="ex-grupo" required>
              <option value="">Selecione o grupo...</option>
              ${this.opcoesGrupos(ex.grupo_muscular)}
            </select>
          </div>
          <div class="form-group">
            <label for="ex-imagem"><i data-lucide="image" style="width:14px;height:14px"></i> URL da Imagem (Opcional)</label>
            <input type="url" id="ex-imagem" placeholder="https://exemplo.com/imagem.jpg" value="${this.escapar(ex.imagem_url)}" maxlength="255">
          </div>
          <div class="form-group">
            <label for="ex-instrucoes"><i data-lucide="file-text" style="width:14px;height:14px"></i> Instruções de Execução</label>
            <textarea id="ex-instrucoes" rows="3" maxlength="10000">${this.escapar(ex.instrucoes)}</textarea>
          </div>
          ${this.renderizarFonte(ex)}
          ${ex.source === 'wger' ? '<small>Salvar registra curadoria local e preserva esta edição nas próximas sincronizações.</small>' : ''}
        </form>`;

      Modal.open('Editar Exercício', html, [
        { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
        { text: 'Atualizar', class: 'btn-primary', action: () => this.salvarExercicio(ex.id) },
      ]);
    } catch (error) {
      Toast.error('Erro ao carregar exercício.');
    }
  },

  /**
   * Salva um exercício (criação ou edição).
   * Coleta dados do formulário e envia para a API.
   * @param {number|null} id - ID para edição, null para criação
   */
  async salvarExercicio(id = null) {
    const nome = document.getElementById('ex-nome').value.trim();
    const grupo_muscular = document.getElementById('ex-grupo').value;
    const instrucoes = document.getElementById('ex-instrucoes').value.trim();
    const imagem_url = document.getElementById('ex-imagem').value.trim();

    if (!nome || !grupo_muscular) {
      Toast.warning('Preencha o nome e o grupo muscular.');
      return;
    }

    try {
      if (id) {
        await API.put(`/exercicios/${id}`, { nome, grupo_muscular, instrucoes, imagem_url });
        Toast.success('Exercício atualizado com sucesso!');
      } else {
        await API.post('/exercicios', { nome, grupo_muscular, instrucoes, imagem_url });
        Toast.success('Exercício criado com sucesso!');
      }

      Modal.close();
      await this.carregarExercicios();
    } catch (error) {
      Toast.error(error.message || 'Erro ao salvar exercício.');
    }
  },

  /**
   * Exibe confirmação antes de desativar um exercício.
   * @param {number} id - ID do exercício
   * @param {string} nome - Nome para exibição na mensagem
   */
  confirmarDesativar(id, nome) {
    Modal.confirm(
      `Deseja desativar o exercício <strong>"${this.escapar(nome)}"</strong>? Ele não aparecerá mais nas listas, mas o histórico será preservado.`,
      async () => {
        try {
          await API.delete(`/exercicios/${id}`);
          Toast.success('Exercício desativado com sucesso!');
          await this.carregarExercicios();
        } catch (error) {
          Toast.error(error.message || 'Erro ao desativar exercício.');
        }
      },
      'Desativar'
    );
  },

  /**
   * Sincroniza o catálogo com a Wger API.
   */
  async sincronizarAPI() {
    try {
      const btnSync = document.getElementById('btn-sync-wger');
      if (btnSync) {
        btnSync.disabled = true;
        btnSync.innerHTML = '<div class="spinner spinner-sm"></div> <span>Sincronizando...</span>';
      }

      const resp = await API.post('/exercicios/sync?limit=100');
      
      if (resp.data?.completa === false) Toast.warning(resp.message || 'Sincronização incompleta. Catálogo local preservado.');
      else Toast.success(resp.message || 'Sincronização concluída!');
      
      // Recarrega a lista
      await this.carregarExercicios();
      
      // Recarrega grupos musculares no select (caso novos tenham sido criados)
      const selectGrupo = document.getElementById('filtro-grupo-muscular');
      if (selectGrupo) {
        selectGrupo.innerHTML = '<option value="">Todos os grupos</option>';
        await this.carregarGruposMusculares();
      }

    } catch (error) {
      console.error('Erro na sincronização:', error);
      Toast.error('Erro ao sincronizar com a API externa.');
    } finally {
      const btnSync = document.getElementById('btn-sync-wger');
      if (btnSync) {
        btnSync.disabled = false;
        btnSync.innerHTML = '<i data-lucide="refresh-cw"></i> <span>Sincronizar wger</span>';
        if (window.lucide) lucide.createIcons({ nodes: [btnSync] });
      }
    }
  }
};
