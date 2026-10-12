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
    if (ex.source !== 'wger') return '<small>Cadastro local da academia · sem fonte externa vinculada</small>';
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

  dados: [], cacheContext: null, generation: 0, listSequence: 0, groupSequence: 0, modalSequence: 0,
  activeForm: null, syncPending: null, page: 1, pageSize: 24,
  invalidar() {
    this.generation++; this.listSequence++; this.groupSequence++; this.modalSequence++;
    this.dados = []; this.cacheContext = null; this.activeForm = null; this.syncPending = null; this.page = 1;
  },
  contexto() {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    return { generation: this.generation, table: document.getElementById('exercicios-table-body'), userId: user?.id,
      role: user?.role, authGeneration: typeof Auth !== 'undefined' ? Auth.generation : null,
      epoch: typeof Auth !== 'undefined' && typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null };
  },
  atual(context) {
    return context && context.generation === this.generation && context.table && context.table.isConnected !== false
      && document.getElementById('exercicios-table-body') === context.table
      && typeof Auth !== 'undefined' && Auth.user?.id === context.userId && context.role === 'admin' && Auth.user?.role === context.role
      && Auth.generation === context.authGeneration
      && (typeof Auth.getSessionEpoch !== 'function' || (Auth.sessionEpoch === context.epoch && Auth.getSessionEpoch() === context.epoch))
      && (typeof App === 'undefined' || App.currentPage === 'exercicios');
  },
  idValido(id) { return Number.isSafeInteger(id) && id > 0 && id <= 2147483647; },
  async inicializar() {
    this.invalidar(); const context = this.contexto(); if (!this.atual(context)) return;
    this.configurarEventos(context);
    await Promise.all([this.carregarExercicios(), this.carregarGruposMusculares(context)]);
  },
  configurarEventos(context = this.contexto()) {
    const bind = (id, event, action) => {
      const node = document.getElementById(id);
      if (node) node['on' + event] = () => { if (this.atual(context)) return action(); };
    };
    bind('btn-novo-exercicio', 'click', () => this.abrirModalCriar());
    bind('btn-sync-wger', 'click', () => this.sincronizarAPI());
    bind('filtro-grupo-muscular', 'change', () => this.carregarExercicios());
    bind('filtro-status-exercicio', 'change', () => this.carregarExercicios());
    bind('filtro-nome-exercicio', 'input', () => this.aplicarFiltros());
    bind('filtro-idioma-exercicio', 'change', () => this.aplicarFiltros());
    bind('catalog-prev', 'click', () => this.mudarPagina(-1));
    bind('catalog-next', 'click', () => this.mudarPagina(1));
  },
  async carregarExercicios() {
    const context = this.contexto(), sequence = ++this.listSequence;
    if (!this.atual(context)) return;
    const current = () => sequence === this.listSequence && this.atual(context);
    const group = document.getElementById('filtro-grupo-muscular')?.value || '';
    const active = document.getElementById('filtro-status-exercicio')?.value === 'false' ? 'false' : 'true';
    const endpoint = '/exercicios?ativo=' + active + (group ? '&grupo_muscular=' + encodeURIComponent(group) : '');
    this.dados = []; this.cacheContext = null; this.page = 1; this.controlesConsulta(false);
    context.table.innerHTML = '<tr><td colspan="4" role="status" class="catalog-loading"><div class="spinner spinner-sm"></div> Carregando catálogo…</td></tr>';
    context.table.onclick = null;
    try {
      const resp = await API.get(endpoint); if (!current()) return;
      this.dados = (Array.isArray(resp.data) ? resp.data : []).filter(ex => this.idValido(ex.id)); this.cacheContext = context;
      this.controlesConsulta(true); this.renderizarResultados(); return resp;
    } catch (error) {
      if (!current()) return;
      context.table.innerHTML = `<tr><td colspan="4"><section class="management-list-state" role="alert"><h3>Não foi possível carregar o catálogo</h3><p>${this.escapar(error.message || 'Confira a conexão e tente novamente.')}</p><button type="button" class="btn btn-secondary" data-catalog-retry>Tentar novamente</button></section></td></tr>`;
      context.table.onclick = event => {
        if (!current()) return;
        const button = event.target?.closest?.('button[data-catalog-retry]');
        if (button && context.table.contains(button)) return this.carregarExercicios();
      };
    }
  },
  controlesConsulta(ready) {
    for (const id of ['filtro-nome-exercicio', 'filtro-idioma-exercicio']) { const node = document.getElementById(id); if (node) node.disabled = !ready; }
    if (!ready) {
      for (const id of ['catalog-prev', 'catalog-next']) { const node = document.getElementById(id); if (node) node.disabled = true; }
      const count = document.getElementById('catalog-count'), page = document.getElementById('catalog-page');
      if (count) count.textContent = 'Aguardando consulta'; if (page) page.textContent = '—';
    }
  },
  async carregarGruposMusculares(context = this.contexto()) {
    if (!this.atual(context)) return;
    const sequence = ++this.groupSequence;
    const select = document.getElementById('filtro-grupo-muscular');
    if (!select) return;
    try {
      const resp = await API.get('/exercicios/grupos');
      if (!this.atual(context) || sequence !== this.groupSequence || document.getElementById('filtro-grupo-muscular') !== select) return;
      const selected = select.value;
      const groups = [...new Set([...(Array.isArray(resp.data) ? resp.data.filter(g => typeof g === 'string') : []), ...(selected ? [selected] : [])])];
      select.innerHTML = '<option value="">Todos os grupos</option>' + groups.map(g => `<option value="${this.escapar(g)}">${this.escapar(g)}</option>`).join(''); select.value = selected;
    } catch { /* Group discovery is optional; the selected query and list still work. */ }
  },
  normalizar(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim(); },
  aplicarFiltros() { this.page = 1; this.renderizarResultados(); },
  mudarPagina(delta) {
    if (![-1, 1].includes(delta) || !this.atual(this.cacheContext)) return;
    this.page += delta; this.renderizarResultados();
  },
  renderizarResultados() {
    if (!this.atual(this.cacheContext)) return;
    const term = this.normalizar(document.getElementById('filtro-nome-exercicio')?.value);
    const locale = document.getElementById('filtro-idioma-exercicio')?.value || '';
    const filtered = this.dados.filter(ex => this.idValido(ex.id) && this.normalizar(ex.nome).includes(term)
      && (!locale || (locale === 'local' ? ex.source !== 'wger' : ex.source === 'wger' && ex.locale === locale)));
    const pages = Math.max(1, Math.ceil(filtered.length / this.pageSize)); this.page = Math.max(1, Math.min(pages, this.page));
    const start = (this.page - 1) * this.pageSize, shown = filtered.slice(start, start + this.pageSize);
    this.renderizarTabela(shown);
    const count = document.getElementById('catalog-count'), page = document.getElementById('catalog-page');
    if (count) count.textContent = filtered.length ? `${start + 1}–${start + shown.length} de ${filtered.length} exercícios · ${this.dados.length} na consulta` : `0 exercícios encontrados · ${this.dados.length} na consulta`;
    if (page) page.textContent = `Página ${this.page} de ${pages}`;
    const previous = document.getElementById('catalog-prev'), next = document.getElementById('catalog-next');
    if (previous) previous.disabled = this.page === 1; if (next) next.disabled = this.page === pages;
  },
  renderizarTabela(exercicios) {
    const context = this.contexto(), tbody = context.table; if (!tbody) return;
    const rows = exercicios.filter(ex => this.idValido(ex.id));
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="management-list-state" role="status"><h3>Nenhum exercício encontrado</h3><p>Revise o nome, o grupo, o idioma ou a disponibilidade selecionados.</p></div></td></tr>';
      tbody.onclick = null; return;
    }
    tbody.innerHTML = rows.map(ex => `<tr class="catalog-row" role="row">
      <td role="cell" class="catalog-main-cell"><div class="catalog-entry">
        <div class="catalog-thumbnail">${this.urlSegura(ex.imagem_url) ? `<img src="${this.escapar(this.urlSegura(ex.imagem_url))}" alt="${this.escapar(ex.nome)}" loading="lazy" referrerpolicy="no-referrer">` : '<i data-lucide="dumbbell" aria-hidden="true"></i>'}</div>
        <div class="catalog-entry-copy"><button type="button" class="catalog-name" data-action="detalhes" data-id="${ex.id}">${this.escapar(ex.nome)}</button>
          <p class="catalog-excerpt">${ex.instrucoes ? this.escapar(ex.instrucoes) : 'Descrição não informada pela fonte.'}</p>
          ${this.renderizarFonte(ex)}</div></div></td>
      <td role="cell" class="catalog-group"><span class="badge badge-info">${this.escapar(ex.grupo_muscular)}</span></td>
      <td role="cell" class="catalog-status"><span class="badge ${ex.ativo ? 'badge-success' : 'badge-secondary'}">${ex.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td role="cell" class="catalog-actions"><button type="button" class="btn btn-sm btn-ghost" data-action="editar" data-id="${ex.id}" title="Editar ${this.escapar(ex.nome)}" aria-label="Editar ${this.escapar(ex.nome)}"><i data-lucide="pencil" aria-hidden="true"></i></button>
      ${ex.ativo ? `<button type="button" class="btn btn-sm btn-ghost" data-action="desativar" data-id="${ex.id}" title="Desativar ${this.escapar(ex.nome)}" aria-label="Desativar ${this.escapar(ex.nome)}"><i data-lucide="archive" aria-hidden="true"></i></button>` : ''}</td></tr>`).join('');
    tbody.onclick = event => {
      if (!this.atual(context)) return;
      const button = event.target?.closest?.('button[data-action]'); if (!button || !tbody.contains(button)) return;
      const ex = rows.find(item => item.id === Number(button.dataset.id)); if (!ex) return;
      if (button.dataset.action === 'detalhes') this.abrirDetalhes(ex.id);
      else if (button.dataset.action === 'editar') this.abrirModalEditar(ex.id);
      else if (button.dataset.action === 'desativar') this.confirmarDesativar(ex.id, ex.nome);
    };
    if (window.lucide) lucide.createIcons({ nodes: [tbody] });
  },
  abrirDetalhes(id) {
    if (!this.atual(this.cacheContext)) return;
    const ex = this.dados.find(item => item.id === id); if (!ex) return;
    ++this.modalSequence; this.activeForm = null;
    const image = this.urlSegura(ex.imagem_url), imported = ex.source === 'wger';
    Modal.open('Biblioteca de movimento', `<article id="catalog-detail" class="catalog-detail">
      <div class="catalog-detail-heading"><span class="workspace-kicker">${imported ? 'Referência wger' : 'Cadastro da academia'}</span><h3>${this.escapar(ex.nome)}</h3><span class="badge badge-info">${this.escapar(ex.grupo_muscular)}</span></div>
      ${image ? `<figure><img src="${this.escapar(image)}" alt="${this.escapar(ex.nome)}" referrerpolicy="no-referrer"><figcaption>Imagem do cadastro. Autoria e licença disponíveis nos créditos abaixo quando informadas.</figcaption></figure>` : '<p class="catalog-no-image">Sem imagem cadastrada para este exercício.</p>'}
      <section><h4>Descrição ${imported && !ex.curated ? 'da fonte' : 'do cadastro'}</h4><p class="catalog-description">${this.escapar(ex.instrucoes || 'Descrição não informada.')}</p></section>
      <p class="catalog-evidence-note">Esta descrição não foi validada como recomendação científica pelo FitFlow. Consulte o profissional responsável para seleção, técnica e prescrição. As evidências revisadas do sistema estão em Fundamentos.</p>
      <section class="catalog-credits"><h4>Origem e créditos</h4>${this.renderizarFonte(ex)}</section></article>`, [{ text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() }]);
  },
  formulario(ex = null) {
    return `<form id="form-exercicio" class="management-form">
      <p class="management-form-intro">${ex ? 'Revise o cadastro. Alterações não reescrevem o histórico das fichas.' : 'Crie uma referência local para a biblioteca da academia.'} Campos com * são obrigatórios.</p>
      <fieldset class="management-form-section"><legend><span>01</span>Identificação</legend><div class="management-fields">
        <div class="form-group management-wide"><label for="ex-nome">Nome do exercício *</label><input type="text" id="ex-nome" value="${this.escapar(ex?.nome || '')}" maxlength="100" required></div>
        <div class="form-group management-wide"><label for="ex-grupo">Grupo muscular *</label><select id="ex-grupo" required><option value="">Selecione o grupo</option>${this.opcoesGrupos(ex?.grupo_muscular || '')}</select></div>
      </div></fieldset>
      <fieldset class="management-form-section"><legend><span>02</span>Descrição e imagem</legend><div class="management-fields">
        <div class="form-group management-wide"><label for="ex-instrucoes">Descrição de execução</label><textarea id="ex-instrucoes" rows="5" maxlength="10000">${this.escapar(ex?.instrucoes || '')}</textarea></div>
        <div class="form-group management-wide"><label for="ex-imagem">URL HTTPS da imagem</label><input type="url" id="ex-imagem" value="${this.escapar(ex?.imagem_url || '')}" placeholder="https://" maxlength="255"><p class="management-help">Use uma imagem com autorização e créditos. Uma descrição de catálogo não substitui prescrição ou avaliação técnica.</p></div>
      </div></fieldset>
      ${ex ? this.renderizarFonte(ex) : ''}${ex?.source === 'wger' ? '<p class="management-help">Salvar registra edição local e preserva o conteúdo editado nas próximas sincronizações; não certifica validação científica.</p>' : ''}</form>`;
  },
  abrirFormulario(ex, scope, sequence) {
    if (!this.atual(scope) || sequence !== this.modalSequence) return;
    let context;
    Modal.open(ex ? 'Editar exercício' : 'Novo exercício', this.formulario(ex), [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: ex ? 'Atualizar exercício' : 'Criar exercício', class: 'btn-primary', action: () => this.salvarExercicio(ex?.id || null, context) },
    ]);
    context = { scope, sequence, id: ex?.id || null, form: document.getElementById('form-exercicio'), button: document.querySelectorAll('#modal-footer .btn-primary')[0], pending: null };
    this.activeForm = context;
    if (context.form) context.form.onsubmit = event => { event.preventDefault(); return this.salvarExercicio(context.id, context); };
  },
  abrirModalCriar() { this.abrirFormulario(null, this.contexto(), ++this.modalSequence); },
  async abrirModalEditar(id) {
    const scope = this.contexto(), sequence = ++this.modalSequence, modalRevision = Modal.revision; this.activeForm = null;
    if (!this.idValido(id) || !this.atual(scope)) return;
    try {
      const resp = await API.get(`/exercicios/${id}`);
      if (!this.atual(scope) || sequence !== this.modalSequence || Modal.revision !== modalRevision) return;
      if (!resp.data || resp.data.id !== id) throw new Error('Cadastro indisponível.');
      this.abrirFormulario(resp.data, scope, sequence);
    } catch (error) { if (this.atual(scope) && sequence === this.modalSequence && Modal.revision === modalRevision) Toast.error(error.message || 'Não foi possível carregar o exercício.'); }
  },
  formularioAtual(context) {
    return context && this.activeForm === context && context.sequence === this.modalSequence && this.atual(context.scope)
      && context.form && context.form.isConnected !== false && document.getElementById('form-exercicio') === context.form
      && (typeof Modal.isOpen !== 'function' || Modal.isOpen());
  },
  salvarExercicio(id = null, context = this.activeForm) {
    if (!this.formularioAtual(context) || id !== context.id) return;
    if (context.pending) return context.pending;
    if (!context.form.reportValidity()) return;
    const field = name => context.form.querySelector('#' + name)?.value || '';
    const payload = { nome: field('ex-nome').trim(), grupo_muscular: field('ex-grupo'), instrucoes: field('ex-instrucoes').trim(), imagem_url: field('ex-imagem').trim() };
    if (!payload.nome || !payload.grupo_muscular) { Toast.warning('Preencha o nome e o grupo muscular.'); return; }
    const button = context.button, label = button?.innerHTML;
    if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
    context.pending = (async () => {
      try {
        const resp = id ? await API.put(`/exercicios/${id}`, payload) : await API.post('/exercicios', payload);
        if (this.formularioAtual(context)) { Modal.close(); this.activeForm = null; Toast.success(id ? 'Exercício atualizado.' : 'Exercício criado.'); await this.carregarExercicios(); }
        return resp;
      } catch (error) { if (this.formularioAtual(context)) Toast.error(error.message || 'Não foi possível salvar o exercício.'); }
      finally { context.pending = null; if (this.formularioAtual(context) && button) { button.disabled = false; button.innerHTML = label; } }
    })(); return context.pending;
  },
  confirmarDesativar(id, nome) {
    const scope = this.contexto(), sequence = ++this.modalSequence; this.activeForm = null;
    if (!this.idValido(id) || !this.atual(scope)) return;
    let anchor, pending = false;
    const current = () => this.atual(scope) && sequence === this.modalSequence;
    Modal.open('Desativar exercício', `<div id="catalog-confirm"><p>Desativar <strong>${this.escapar(nome)}</strong>?</p><p>Ele sai das opções ativas; fichas e sessões anteriores preservam o histórico.</p></div>`, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Desativar', class: 'btn-danger', action: async () => {
        if (pending || !current() || !anchor || document.getElementById('catalog-confirm') !== anchor || anchor.isConnected === false || (typeof Modal.isOpen === 'function' && !Modal.isOpen())) return;
        pending = true; Modal.close();
        try { const resp = await API.delete(`/exercicios/${id}`); if (current()) { Toast.success('Exercício desativado. Histórico preservado.'); await this.carregarExercicios(); } return resp; }
        catch (error) { if (current()) Toast.error(error.message || 'Não foi possível desativar o exercício.'); }
      } },
    ]); anchor = document.getElementById('catalog-confirm');
  },
  sincronizarAPI() {
    const scope = this.contexto(), button = document.getElementById('btn-sync-wger');
    if (!this.atual(scope) || !button) return;
    if (this.syncPending && this.syncPending.scope.generation === scope.generation) return this.syncPending.promise;
    const current = () => this.atual(scope) && document.getElementById('btn-sync-wger') === button;
    const label = button.innerHTML; button.disabled = true; button.textContent = 'Sincronizando…';
    const operation = { scope, promise: null }; this.syncPending = operation;
    operation.promise = (async () => {
      try {
        const resp = await API.post('/exercicios/sync?limit=100');
        if (current()) {
          if (resp.data?.completa === false) Toast.warning(resp.message || 'Sincronização incompleta. Catálogo local preservado.'); else Toast.success(resp.message || 'Sincronização concluída.');
          await Promise.all([this.carregarExercicios(), this.carregarGruposMusculares(scope)]);
        } return resp;
      } catch (error) { if (current()) Toast.error(error.message || 'Não foi possível sincronizar o catálogo.'); }
      finally { if (this.syncPending === operation) this.syncPending = null; if (current()) { button.disabled = false; button.innerHTML = label; if (window.lucide) lucide.createIcons({ nodes: [button] }); } }
    })(); return operation.promise;
  }
};
if (typeof window.addEventListener === 'function') {
  window.addEventListener('auth:logout', () => ExerciciosCatalogoView.invalidar());
  window.addEventListener('navigate', event => { if (event.detail?.page !== 'exercicios') ExerciciosCatalogoView.invalidar(); });
}
