/** Fichas profissionais: administração ampla e autoria restrita para instrutores. */
const TreinosView = {
  alunosCache: [], catalogoCache: [], currentStudentId: null,
  generation: 0, requests: {},
  invalidar() { this.generation++; this.currentStudentId = null; this.alunosCache = []; this.catalogoCache = []; },
  solicitar(kind, nodeId) {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    return { kind, token: this.requests[kind] = (this.requests[kind] || 0) + 1, generation: this.generation,
      userId: user?.id, role: user?.role, authGeneration: typeof Auth !== 'undefined' ? Auth.generation : null,
      studentId: this.currentStudentId, nodeId, node: document.getElementById(nodeId) };
  },
  atual(request) {
    return request && request.token === this.requests[request.kind] && request.generation === this.generation
      && request.studentId === this.currentStudentId && request.node && request.node.isConnected !== false
      && document.getElementById(request.nodeId) === request.node && typeof Auth !== 'undefined'
      && Auth.user?.id === request.userId && ['admin', 'instructor'].includes(Auth.user?.role)
      && Auth.user.role === request.role && Auth.generation === request.authGeneration
      && (typeof App === 'undefined' || App.currentPage === 'treinos');
  },
  escapar(value) { return FitFlowSecurity.escapeHtml(value); },
  idValido(value) { return Number.isSafeInteger(value) && value > 0; },
  icones(node) { if (window.lucide) window.lucide.createIcons({ nodes: [node] }); },
  async inicializar() {
    this.invalidar();
    const request = this.solicitar('inicializar', 'treinos-alunos-grid');
    await this.carregarAlunosParaPerfis(); if (this.atual(request)) this.configurarEventos();
  },
  configurarEventos() {
    const btn = document.getElementById('btn-novo-treino');
    if (btn) btn.onclick = () => this.abrirModalCriar();
  },
  async carregarAlunosParaPerfis() {
    const request = this.solicitar('alunos', 'treinos-alunos-grid');
    try {
      const response = await API.get('/treinos/alunos');
      if (!this.atual(request)) return;
      this.alunosCache = response.data || []; this.renderizarGradeAlunos(this.alunosCache);
    } catch (error) {
      if (!this.atual(request)) return;
      this.alunosCache = []; this.renderizarGradeAlunos([]); Toast.error(error.message || 'Erro ao carregar alunos elegíveis.');
    }
  },
  renderizarGradeAlunos(alunos) {
    const grid = document.getElementById('treinos-alunos-grid'); if (!grid) return;
    grid.innerHTML = alunos.length ? alunos.filter(a => this.idValido(a.id)).map(a => `
      <button type="button" class="kpi-card" data-student="${a.id}" style="cursor:pointer;text-align:left">
        <div class="kpi-icon"><i data-lucide="user"></i></div>
        <div class="kpi-content"><div class="kpi-label">${this.escapar(a.name)}</div>
          <span class="badge badge-success">Matrícula ativa</span><p>Consultar fichas e planejar</p></div>
      </button>`).join('') : '<p>Nenhum aluno elegível encontrado.</p>';
    grid.onclick = event => {
      const button = event.target.closest('[data-student]'); if (!button || !grid.contains(button)) return;
      const student = this.alunosCache.find(a => a.id === Number(button.dataset.student));
      if (student) this.abrirPerfilAluno(student.id, student.name);
    };
    this.icones(grid);
  },
  filtrarAlunos(term) { this.renderizarGradeAlunos(this.alunosCache.filter(a => String(a.name).toLowerCase().includes(String(term).toLowerCase()))); },
  async abrirPerfilAluno(studentId, name) {
    if (!this.idValido(studentId)) return;
    this.generation++;
    this.currentStudentId = studentId;
    document.getElementById('treinos-view-alunos').style.display = 'none';
    document.getElementById('treinos-view-fichas').style.display = 'block';
    document.getElementById('treinos-aluno-nome').textContent = `Fichas de ${name}`;
    await this.carregarTreinos(studentId);
  },
  voltarParaPerfis() {
    this.generation++;
    this.currentStudentId = null;
    document.getElementById('treinos-view-alunos').style.display = 'block';
    document.getElementById('treinos-view-fichas').style.display = 'none';
    document.getElementById('treinos-table-body').innerHTML = '';
  },
  async carregarTreinos(studentId) {
    if (!this.idValido(studentId) || studentId !== this.currentStudentId) return;
    const request = this.solicitar('fichas', 'treinos-table-body');
    if (!this.atual(request)) return;
    request.node.innerHTML = '';
    try {
      const response = await API.get(`/treinos?studentId=${studentId}`);
      if (this.atual(request)) this.renderizarTabela(response.data || []);
    } catch (error) { if (this.atual(request)) { this.renderizarTabela([]); Toast.error(error.message || 'Erro ao carregar fichas.'); } }
  },
  async carregarCatalogo(request = this.solicitar('catalogo', 'treinos-table-body')) {
    if (!this.atual(request)) return;
    this.catalogoCache = [];
    try { const response = await API.get('/treinos/catalogo'); if (this.atual(request)) this.catalogoCache = response.data || []; }
    catch (error) { if (this.atual(request)) Toast.warning('Catálogo indisponível. Você pode informar exercícios manualmente.'); }
  },
  renderizarTabela(treinos) {
    const tbody = document.getElementById('treinos-table-body'); if (!tbody) return;
    tbody.innerHTML = treinos.length ? treinos.filter(t => this.idValido(t.id)).map(t => `<tr>
      <td><strong>${this.escapar(t.name)}</strong>${t.description ? `<p>${this.escapar(t.description)}</p>` : ''}</td>
      <td>${t.exercises?.length || 0}</td><td>${this.escapar(new Date(t.createdAt).toLocaleDateString('pt-BR'))}</td>
      <td><span class="badge ${t.active ? 'badge-success' : 'badge-secondary'}">${t.active ? 'Ativa' : 'Arquivada'}</span></td>
      <td><button class="btn btn-sm btn-ghost" data-action="detalhe" data-id="${t.id}" title="Ver ficha"><i data-lucide="eye"></i></button>
      ${t.active ? `<button class="btn btn-sm btn-ghost" data-action="editar" data-id="${t.id}" title="Editar ficha"><i data-lucide="pencil"></i></button>
        <button class="btn btn-sm btn-ghost" data-action="arquivar" data-id="${t.id}" title="Arquivar ficha"><i data-lucide="archive"></i></button>` : ''}</td></tr>`).join('') :
      '<tr><td colspan="5">Nenhuma ficha disponível neste acesso. Instrutores veem somente as fichas de sua autoria.</td></tr>';
    tbody.onclick = event => {
      const button = event.target.closest('button[data-action]'); if (!button || !tbody.contains(button)) return;
      const workout = treinos.find(t => t.id === Number(button.dataset.id)); if (!workout) return;
      if (button.dataset.action === 'detalhe') this.abrirModalDetalhe(workout.id);
      if (button.dataset.action === 'editar') this.abrirModalEditar(workout.id);
      if (button.dataset.action === 'arquivar') this.confirmarDesativar(workout.id, workout.name);
    };
    this.icones(tbody);
  },
  exerciciosDetalhes(exercises) {
    return (exercises || []).map((ex, index) => `<article class="workout-exercise-editor">
      <strong>${index + 1}. ${this.escapar(ex.name)}</strong><p>${this.escapar(ex.muscleGroup || 'Grupo não informado')}</p>
      <p>${this.escapar(ex.sets)} séries · ${this.escapar(ex.reps)} repetições · Pausa: ${ex.restSeconds == null ? 'não informada' : `${this.escapar(ex.restSeconds)} s`}</p>
      <p>Carga sugerida: ${this.escapar(ex.suggestedLoad || 'não informada')} · Última carga registrada: ${ex.workoutLogs?.[0] ? `${this.escapar(ex.workoutLogs[0].weight)} kg` : 'não informada'}</p>
      ${ex.notes ? `<p>${this.escapar(ex.notes)}</p>` : ''}</article>`).join('');
  },
  async abrirModalDetalhe(id) {
    const request = this.solicitar('modal', 'treinos-table-body');
    if (!this.atual(request)) return;
    try {
      const workout = (await API.get(`/treinos/${id}`)).data;
      if (!this.atual(request)) return;
      Modal.open(`Ficha: ${workout.name}`, `<p>Aluno: ${this.escapar(workout.student?.user?.name)} · Autor: ${this.escapar(workout.instructor?.name)}</p>
        <p>${this.escapar(workout.description)}</p><p>${this.escapar(workout.notes)}</p>${this.exerciciosDetalhes(workout.exercises)}`,
        [{ text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() }]);
    } catch (error) { if (this.atual(request)) Toast.error(error.message || 'Erro ao consultar ficha.'); }
  },
  async abrirModalCriar() {
    const request = this.solicitar('modal', 'treinos-table-body');
    if (!this.atual(request)) return;
    if (!this.alunosCache.length) await this.carregarAlunosParaPerfis();
    if (!this.atual(request)) return;
    if (!this.alunosCache.length) { Toast.warning('Nenhum aluno elegível para criar a ficha.'); return; }
    await this.carregarCatalogo(request);
    if (!this.atual(request)) return;
    const options = this.alunosCache.filter(a => this.idValido(a.id)).map(a => `<option value="${a.id}" ${a.id === this.currentStudentId ? 'selected' : ''}>${this.escapar(a.name)}</option>`).join('');
    Modal.open('Planejar ficha de treino', this.renderizarConstrutorTreinoLayout(options), [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Salvar ficha', class: 'btn-primary', action: () => this.salvarTreino() }]);
    this.iniciarConstrutor();
  },
  async abrirModalEditar(id) {
    const request = this.solicitar('modal', 'treinos-table-body');
    if (!this.atual(request)) return;
    try {
      const workout = (await API.get(`/treinos/${id}`)).data;
      if (!this.atual(request)) return;
      await this.carregarCatalogo(request);
      if (!this.atual(request)) return;
      Modal.open(`Editar ficha: ${workout.name}`, this.renderizarConstrutorTreinoLayout('', true, workout), [
        { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
        { text: 'Salvar revisão', class: 'btn-primary', action: () => this.salvarTreino(workout.id) }]);
      this.iniciarConstrutor(); (workout.exercises || []).forEach(ex => this.adicionarExercicio(ex));
    } catch (error) { if (this.atual(request)) Toast.error(error.message || 'Erro ao editar ficha.'); }
  },
  renderizarConstrutorTreinoLayout(options, isEdit = false, workout = {}) {
    const value = key => this.escapar(isEdit ? workout[key] : '');
    return `<section id="planejamento-ciencia"></section><div class="workout-builder">
      <section class="workout-catalog"><h4>Selecionar exercícios</h4>
        <input type="search" id="cat-search" aria-label="Buscar exercício" placeholder="Nome ou grupo declarado">
        <div class="workout-catalog-list" id="catalogo-list"></div>
        <button type="button" class="btn btn-secondary" id="add-manual-exercise">Informar exercício manualmente</button>
      </section>
      <section><form id="form-treino" class="workout-edit-form">
        <div class="form-group"><label for="treino-aluno">Aluno</label>${isEdit ?
          `<input type="text" value="${this.escapar(workout.student?.user?.name)}" disabled>` :
          `<select id="treino-aluno" required><option value="">Selecionar matrícula ativa</option>${options}</select>`}</div>
        <div class="form-group"><label for="treino-nome">Nome da ficha</label><input type="text" id="treino-nome" maxlength="100" value="${value('name')}" required></div>
        <div class="form-group"><label for="treino-descricao">Objetivo e contexto</label><textarea id="treino-descricao" maxlength="10000" rows="2">${value('description')}</textarea></div>
        <div class="form-group"><label for="treino-notas">Observações de acompanhamento</label><textarea id="treino-notas" maxlength="10000" rows="2">${value('notes')}</textarea></div>
      </form><h4>Exercícios <span id="qtd-exercicios">(0)</span></h4>
      <p class="workout-history-note">Defina séries, repetições e pausas para esta ficha. Salvar uma edição cria outra revisão e arquiva a ficha anterior, preservando seus exercícios e registros.</p>
      <div id="exercicios-container"><p class="empty-routine">Selecione exercícios do catálogo ou informe um exercício.</p></div></section></div>`;
  },
  iniciarConstrutor() {
    const host = document.getElementById('planejamento-ciencia');
    if (window.PlanejamentoCiencia) window.PlanejamentoCiencia.mount(host);
    else if (host) host.textContent = 'Apoio de planejamento indisponível nesta versão. A ficha pode ser preenchida pelo profissional.';
    document.getElementById('cat-search').oninput = event => this.filtrarCatalogo(event.target.value);
    document.getElementById('add-manual-exercise').onclick = () => this.adicionarExercicio();
    const container = document.getElementById('exercicios-container');
    container.oninput = () => this.atualizarResumo();
    container.onclick = event => {
      const button = event.target.closest('button[data-edit-action]'); if (!button || !container.contains(button)) return;
      const row = button.closest('.exercicio-item'); if (!row) return;
      if (button.dataset.editAction === 'remove') row.remove();
      if (button.dataset.editAction === 'up' && row.previousElementSibling) container.insertBefore(row, row.previousElementSibling);
      if (button.dataset.editAction === 'down' && row.nextElementSibling) container.insertBefore(row.nextElementSibling, row);
      this.atualizarIndices();
    };
    if (window.Sortable) new window.Sortable(container, { handle: '.grip-handle', animation: 150, onEnd: () => this.atualizarIndices() });
    this.renderizarCatalogoLista();
  },
  fonteCatalogo(item) {
    if (item.source !== 'wger') return '<small>Cadastro local: confirmar equipamento e execução com o profissional.</small>';
    const meta = item.sourceMetadata || {}, credit = meta.text || {}, license = credit.license || {};
    let href = null;
    try { const url = new URL(license.url); if (url.protocol === 'https:' && !url.username && !url.password) href = url.href; } catch {}
    const licenseHtml = href ? `<a href="${this.escapar(href)}" rel="noopener noreferrer" target="_blank">${this.escapar(license.code)}</a>` : this.escapar(license.code);
    const names = items => Array.isArray(items) && items.length ? this.escapar(items.map(x => x.name).join(', ')) : 'não informados';
    return `<details><summary>wger · ${item.curated ? 'curadoria local' : 'dados da fonte'} · ${item.locale === 'pt' ? 'português' : 'inglês'}</summary>
      <p>Texto de origem: ${this.escapar(credit.originalName)} · ${this.escapar(credit.author)} · ${licenseHtml}.</p>
      <p>Músculos principais declarados: ${names(meta.primaryMuscles)}. Secundários: ${names(meta.secondaryMuscles)}. Equipamentos: ${names(meta.equipment)}.</p>
      <p>Dados descritivos contribuídos; avaliar a seleção para o aluno.</p></details>`;
  },
  renderizarCatalogoLista(filter = '', requestedPage = 0) {
    const list = document.getElementById('catalogo-list'); if (!list) return;
    const term = String(filter).toLowerCase();
    const items = this.catalogoCache.filter(item => this.idValido(item.id) &&
      `${item.nome} ${item.grupo_muscular}`.toLowerCase().includes(term));
    const pageSize = 30;
    const page = Math.max(0, Math.min(Number.isSafeInteger(requestedPage) ? requestedPage : 0, Math.ceil(items.length / pageSize) - 1));
    const start = page * pageSize;
    const visible = items.slice(start, start + pageSize);
    list.innerHTML = items.length ? `<p class="workout-catalog-count" role="status">${start + 1}–${start + visible.length} de ${items.length} exercícios. Use a busca para refinar.</p>` + visible.map(item => `<article class="workout-catalog-item">
      <button type="button" class="btn btn-ghost" data-catalog="${item.id}"><span>${this.escapar(item.nome)}</span> <i data-lucide="plus"></i></button>
      <p>${this.escapar(item.grupo_muscular)}</p>${this.fonteCatalogo(item)}</article>`).join('') + (items.length > pageSize ? `<nav class="workout-catalog-pages" aria-label="Páginas do catálogo">
        <button type="button" class="btn btn-secondary" data-catalog-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>Anteriores</button>
        <button type="button" class="btn btn-secondary" data-catalog-page="${page + 1}" ${start + pageSize >= items.length ? 'disabled' : ''}>Próximos</button></nav>` : '') : '<p>Nenhum exercício encontrado. Você pode informar um exercício manualmente.</p>';
    list.onclick = event => {
      const pageButton = event.target.closest('[data-catalog-page]');
      if (pageButton && list.contains(pageButton) && !pageButton.disabled) {
        this.renderizarCatalogoLista(filter, Number(pageButton.dataset.catalogPage));
        list.scrollTop = 0;
        const nextFocus = list.querySelector('[data-catalog-page]:not([disabled])') || list.querySelector('[data-catalog]');
        nextFocus?.focus({ preventScroll: true });
        return;
      }
      const button = event.target.closest('[data-catalog]');
      if (button && list.contains(button)) this.adicionarExercicioFromCatalogo(Number(button.dataset.catalog));
    };
    this.icones(list);
  },
  filtrarCatalogo(term) { this.renderizarCatalogoLista(term); },
  adicionarExercicioFromCatalogo(id) {
    const item = this.catalogoCache.find(c => c.id === id);
    if (item) this.adicionarExercicio({ name: item.nome, muscleGroup: item.grupo_muscular });
  },
  adicionarExercicio(data = {}) {
    const container = document.getElementById('exercicios-container'); if (!container) return;
    if (container.querySelectorAll('.exercicio-item').length >= 100) { Toast.warning('Limite de 100 exercícios por ficha.'); return; }
    container.querySelector('.empty-routine')?.remove();
    const row = document.createElement('div'); row.className = 'exercicio-item workout-exercise-editor';
    const field = (label, name, key, type = 'text', attributes = '', full = false) => `<label class="${full ? 'full-width' : ''}">${label}<input class="${name}" type="${type}" value="${this.escapar(data[key])}" ${attributes}></label>`;
    row.innerHTML = `<div class="workout-exercise-head"><span class="exercicio-numero"></span>
      <span class="grip-handle" title="Arrastar para reordenar"><i data-lucide="grip-vertical"></i></span>
      <div><button type="button" class="btn btn-sm btn-ghost" data-edit-action="up" title="Mover para cima">↑</button>
        <button type="button" class="btn btn-sm btn-ghost" data-edit-action="down" title="Mover para baixo">↓</button>
        <button type="button" class="btn btn-sm btn-ghost" data-edit-action="remove" title="Remover exercício"><i data-lucide="trash-2"></i></button></div></div>
      <div class="workout-exercise-fields">
        ${field('Exercício', 'ex-nome', 'name', 'text', 'maxlength="100" required', true)}
        ${field('Grupo direto declarado', 'ex-grupo', 'muscleGroup', 'text', 'maxlength="50"', true)}
        ${field('Séries', 'ex-series', 'sets', 'number', 'min="1" max="100" step="1" placeholder="Definir" required')}
        ${field('Repetições ou faixa', 'ex-reps', 'reps', 'text', 'maxlength="50" placeholder="Definir" required')}
        ${field('Pausa em segundos', 'ex-pausa', 'restSeconds', 'number', 'min="0" max="3600" step="1" placeholder="Definir" required')}
        ${field('Carga / orientação (opcional)', 'ex-carga', 'suggestedLoad', 'text', 'maxlength="50"')}
        ${field('Observações de execução e adaptação', 'ex-obs', 'notes', 'text', 'maxlength="10000"', true)}
      </div>`;
    container.appendChild(row); this.icones(row); this.atualizarIndices();
  },
  atualizarIndices() {
    const container = document.getElementById('exercicios-container'); if (!container) return;
    const rows = container.querySelectorAll('.exercicio-item');
    document.getElementById('qtd-exercicios').textContent = `(${rows.length})`;
    rows.forEach((row, index) => { row.querySelector('.exercicio-numero').textContent = `#${index + 1}`; });
    if (!rows.length) container.innerHTML = '<p class="empty-routine">Selecione ou informe um exercício.</p>';
    this.atualizarResumo();
  },
  coletarExercicios() {
    return [...document.getElementById('exercicios-container').querySelectorAll('.exercicio-item')].map(row => {
      const value = className => row.querySelector(`.${className}`).value.trim();
      return { name: value('ex-nome'), muscleGroup: value('ex-grupo') || null, sets: value('ex-series'),
        reps: value('ex-reps'), restSeconds: value('ex-pausa'), suggestedLoad: value('ex-carga') || null, notes: value('ex-obs') || null };
    });
  },
  atualizarResumo() {
    if (window.PlanejamentoCiencia) window.PlanejamentoCiencia.updateRoutine(document.getElementById('planejamento-ciencia'), this.coletarExercicios());
  },
  async salvarTreino(id = null) {
    const request = this.solicitar('salvar', 'form-treino');
    if (!this.atual(request)) return;
    const exercises = this.coletarExercicios();
    const name = document.getElementById('treino-nome').value.trim();
    const studentId = id ? this.currentStudentId : Number(document.getElementById('treino-aluno').value);
    if (!name || !exercises.length) { Toast.warning('Informe o nome da ficha e pelo menos um exercício.'); return; }
    if (!id && !this.idValido(studentId)) { Toast.warning('Selecione o aluno.'); return; }
    for (const exercise of exercises) {
      if (!exercise.name || !/^\d+$/.test(exercise.sets) || Number(exercise.sets) < 1 || Number(exercise.sets) > 100 ||
        !/^\d+(?:\s*[-–]\s*\d+)?$/.test(exercise.reps) || !/^\d+$/.test(exercise.restSeconds) || Number(exercise.restSeconds) > 3600) {
        Toast.warning('Defina nome, séries, repetições e pausa de todos os exercícios.'); return;
      }
    }
    const payload = { name, exercises, description: document.getElementById('treino-descricao').value.trim(), notes: document.getElementById('treino-notas').value.trim() };
    if (!id) payload.studentId = studentId;
    try {
      const response = id ? await API.put(`/treinos/${id}`, payload) : await API.post('/treinos', payload);
      if (!this.atual(request)) return;
      Toast.success(response.message || 'Ficha salva.'); Modal.close();
      if (this.currentStudentId) await this.carregarTreinos(this.currentStudentId);
    } catch (error) { if (this.atual(request)) Toast.error(error.message || 'Erro ao salvar ficha.'); }
  },
  confirmarDesativar(id, name) {
    const request = this.solicitar('arquivar', 'treinos-table-body');
    if (!this.atual(request)) return;
    this.requests.modal = (this.requests.modal || 0) + 1;
    Modal.confirm(`Arquivar a ficha <strong>${this.escapar(name)}</strong>? Os exercícios, cargas e sessões registrados serão preservados.`, async () => {
      if (!this.atual(request)) return;
      try { await API.delete(`/treinos/${id}`); if (!this.atual(request)) return; Toast.success('Ficha arquivada.'); if (this.currentStudentId) await this.carregarTreinos(this.currentStudentId); }
      catch (error) { if (this.atual(request)) Toast.error(error.message || 'Erro ao arquivar ficha.'); }
    }, 'Arquivar');
  },
};

if (typeof window.addEventListener === 'function') {
  window.addEventListener('auth:logout', () => TreinosView.invalidar());
  window.addEventListener('navigate', () => TreinosView.invalidar());
}

// Compatibility view for legacy append-only charge records.
const MeuTreinoView = {
  async inicializar() { await this.carregarMeusTreinos(); },
  async carregarMeusTreinos() {
    const container = document.getElementById('meu-treino-container'); if (!container) return;
    try { this.renderizarTreinos((await API.get('/treinos/meus')).data || [], container); }
    catch (error) { container.textContent = error.message || 'Não foi possível carregar suas fichas.'; }
  },
  renderizarTreinos(treinos, container) {
    const escape = value => TreinosView.escapar(value);
    container.innerHTML = treinos.length ? treinos.map(workout => `<article class="card" style="margin-bottom:1rem;padding:1rem">
      <h3>${escape(workout.name)}</h3><p>${escape(workout.description)}</p><p>Autor: ${escape(workout.instructor?.name)}</p>
      ${TreinosView.exerciciosDetalhes(workout.exercises)}
      ${(workout.exercises || []).filter(ex => TreinosView.idValido(ex.id)).map(ex => `<button class="btn btn-sm btn-secondary" data-exercise="${ex.id}">Registrar carga: ${escape(ex.name)}</button>`).join('')}
      </article>`).join('') : '<p>Nenhuma ficha ativa. Consulte seu instrutor.</p>';
    container.onclick = event => {
      const button = event.target.closest('[data-exercise]'); if (!button || !container.contains(button)) return;
      const exercise = treinos.flatMap(workout => workout.exercises || []).find(ex => ex.id === Number(button.dataset.exercise));
      if (exercise) this.abrirRegistroCarga(exercise.id, exercise.name);
    };
    TreinosView.icones(container);
  },
  abrirRegistroCarga(exerciseId, name) {
    Modal.open(`Registrar carga: ${name}`, `<form id="form-carga"><p>Registro legado de carga; não comprova todas as séries de uma sessão.</p>
      <div class="form-group"><label for="carga-peso">Carga externa (kg)</label><input type="number" id="carga-peso" min="0" max="9999.99" step="0.01" required><small>Zero representa ausência de carga externa; peso corporal não é estimado.</small></div>
      <div class="form-group"><label for="carga-reps">Repetições registradas (opcional)</label><input type="number" id="carga-reps" min="1" max="1000" step="1"></div>
      <div class="form-group"><label for="carga-obs">Observações</label><input type="text" id="carga-obs" maxlength="10000"></div></form>`, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Salvar carga', class: 'btn-primary', action: () => this.salvarCarga(exerciseId) }]);
  },
  async salvarCarga(exerciseId) {
    const raw = document.getElementById('carga-peso').value;
    const reps = document.getElementById('carga-reps').value;
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || (reps && !/^\d+$/.test(reps))) { Toast.warning('Informe carga e repetições válidas.'); return; }
    try {
      await API.post('/treinos/carga', { exerciseId, weight: Number(raw), repsCompleted: reps ? Number(reps) : null, notes: document.getElementById('carga-obs').value.trim() || null });
      Toast.success('Carga registrada.'); Modal.close(); await this.carregarMeusTreinos();
    } catch (error) { Toast.error(error.message || 'Erro ao registrar carga.'); }
  },
};
