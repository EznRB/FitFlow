/** Fichas profissionais: administração ampla e autoria restrita para instrutores. */
const TreinosView = {
  alunosCache: [], catalogoCache: [], currentStudentId: null,
  generation: 0, requests: {}, editor: null,
  alunosEstado: null, alunosFiltro: '',
  invalidar() { this.generation++; this.currentStudentId = null; this.alunosCache = []; this.catalogoCache = []; this.editor = null; this.alunosEstado = null; this.alunosFiltro = ''; },
  solicitar(kind, nodeId) {
    const user = typeof Auth !== 'undefined' ? Auth.user : null;
    return { kind, token: this.requests[kind] = (this.requests[kind] || 0) + 1, generation: this.generation,
      userId: user?.id, role: user?.role, authGeneration: typeof Auth !== 'undefined' ? Auth.generation : null,
      epoch: typeof Auth !== 'undefined' && typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null,
      studentId: this.currentStudentId, nodeId, node: document.getElementById(nodeId) };
  },
  atual(request) {
    return request && request.token === this.requests[request.kind] && request.generation === this.generation
      && request.studentId === this.currentStudentId && request.node && request.node.isConnected !== false
      && document.getElementById(request.nodeId) === request.node && typeof Auth !== 'undefined'
      && Auth.user?.id === request.userId && ['admin', 'instructor'].includes(Auth.user?.role)
      && Auth.user.role === request.role && Auth.generation === request.authGeneration
      && (typeof Auth.getSessionEpoch !== 'function' || (Auth.sessionEpoch === request.epoch && Auth.getSessionEpoch() === request.epoch))
      && (typeof App === 'undefined' || App.currentPage === 'treinos');
  },
  escapar(value) { return FitFlowSecurity.escapeHtml(value); },
  idValido(value) { return Number.isSafeInteger(value) && value > 0; },
  listaLida(response) {
    const seen = new Set();
    if (!Array.isArray(response?.data) || response.data.some(item => {
      if (!item || !this.idValido(item.id) || seen.has(item.id) || typeof item.name !== 'string' || !item.name.trim()) return true;
      seen.add(item.id); return false;
    }))
      throw new Error('Resposta incompleta. Atualize a consulta para continuar.');
    return response.data;
  },
  detalheLido(response, id) {
    const workout = response?.data;
    const integer = (value, min, max) => ['number', 'string'].includes(typeof value)
      && /^\d+$/.test(String(value).trim()) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
    const repetitions = value => {
      if (!['number', 'string'].includes(typeof value)) return false;
      const match = String(value).trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
      return Boolean(match && integer(match[1], 1, 1000) && (!match[2] || integer(match[2], Number(match[1]), 1000)));
    };
    const seen = new Set();
    if (!workout || workout.id !== id || typeof workout.name !== 'string' || !workout.name.trim()
      || !['description', 'notes'].every(key => Object.hasOwn(workout, key) && (workout[key] === null || typeof workout[key] === 'string'))
      || !Array.isArray(workout.exercises)
      || workout.exercises.some(ex => {
        if (!ex || !this.idValido(ex.id) || seen.has(ex.id) || typeof ex.name !== 'string' || !ex.name.trim()
          || !integer(ex.sets, 1, 100) || !repetitions(ex.reps) || !integer(ex.restSeconds, 0, 3600)
          || !['muscleGroup', 'suggestedLoad', 'notes'].every(key => Object.hasOwn(ex, key) && (ex[key] === null || typeof ex[key] === 'string'))) return true;
        seen.add(ex.id); return false;
      }))
      throw new Error('Ficha incompleta. Consulte novamente antes de editar.');
    return workout;
  },
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
    if (!this.atual(request)) return;
    this.alunosEstado = 'loading'; this.estadoLista(request);
    try {
      const response = await API.get('/treinos/alunos', { timeoutMs: 15000 });
      if (!this.atual(request)) return;
      this.alunosCache = this.listaLida(response); this.alunosEstado = 'ready'; this.filtrarAlunos(this.alunosFiltro);
    } catch (error) {
      if (!this.atual(request)) return;
      this.alunosCache = []; this.alunosEstado = 'error'; this.estadoLista(request, true);
    }
  },
  estadoLista(request, erro = false) {
    const fichas = request.kind === 'fichas';
    const content = erro ? `<div class="management-list-state" role="alert"><p>Não foi possível carregar ${fichas ? 'as fichas' : 'os alunos'}.</p><button type="button" class="btn btn-secondary" data-retry>Tentar novamente</button></div>`
      : `<div class="management-list-state" role="status"><p>Carregando ${fichas ? 'fichas' : 'alunos'}…</p></div>`;
    request.node.innerHTML = fichas ? `<tr><td colspan="5">${content}</td></tr>` : content;
    let usado = false;
    request.node.onclick = erro ? event => {
      if (event && !event.target.closest('[data-retry]')) return;
      if (usado || !this.atual(request)) return;
      usado = true;
      return fichas ? this.carregarTreinos(request.studentId) : this.carregarAlunosParaPerfis();
    } : null;
  },
  renderizarGradeAlunos(alunos) {
    const grid = document.getElementById('treinos-alunos-grid'); if (!grid) return;
    grid.innerHTML = alunos.length ? alunos.filter(a => this.idValido(a.id)).map(a => `
      <button type="button" class="kpi-card" data-student="${a.id}" style="cursor:pointer;text-align:left">
        <div class="kpi-icon"><i data-lucide="user"></i></div>
        <div class="kpi-content"><div class="kpi-label">${this.escapar(a.name)}</div>
          <span class="badge badge-success">Matrícula ativa</span><p>Consultar fichas e planejar</p><span class="workspace-student-action">Ver fichas <i data-lucide="arrow-up-right" aria-hidden="true"></i></span></div>
      </button>`).join('') : '<p>Nenhum aluno elegível encontrado.</p>';
    grid.onclick = event => {
      const button = event.target.closest('[data-student]'); if (!button || !grid.contains(button)) return;
      const student = this.alunosCache.find(a => a.id === Number(button.dataset.student));
      if (student) this.abrirPerfilAluno(student.id, student.name);
    };
    this.icones(grid);
  },
  filtrarAlunos(term) {
    this.alunosFiltro = String(term || '');
    if (this.alunosEstado !== 'ready') return;
    this.renderizarGradeAlunos(this.alunosCache.filter(a => a.name.toLowerCase().includes(this.alunosFiltro.toLowerCase())));
  },
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
    this.estadoLista(request);
    try {
      const response = await API.get(`/treinos?studentId=${studentId}`, { timeoutMs: 15000 });
      if (!this.atual(request)) return;
      const treinos = this.listaLida(response);
      if (treinos.some(t => typeof t.active !== 'boolean' || !Array.isArray(t.exercises)
        || typeof t.createdAt !== 'string' || !Number.isFinite(Date.parse(t.createdAt))
        || !(t.description === null || typeof t.description === 'string')))
        throw new Error('Lista de fichas incompleta.');
      this.renderizarTabela(treinos);
    } catch (error) { if (this.atual(request)) this.estadoLista(request, true); }
  },
  async carregarCatalogo(request = this.solicitar('catalogo', 'treinos-table-body')) {
    if (!this.atual(request)) return;
    this.catalogoCache = [];
    try {
      const response = await API.get('/treinos/catalogo', { timeoutMs: 15000 });
      if (!this.atual(request)) return;
      if (!Array.isArray(response?.data) || response.data.some(item => !item || !this.idValido(item.id) || typeof item.nome !== 'string'))
        throw new Error('Catálogo incompleto.');
      this.catalogoCache = response.data;
    }
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
      ${ex.notes ? `<p>${this.escapar(ex.notes)}</p>` : ''}${this.origemExercicio(ex)}</article>`).join('');
  },
  origemExercicio(exercise) { return typeof FitFlowExerciseOrigin === 'undefined' ? '' : FitFlowExerciseOrigin.render(exercise, value => this.escapar(value)); },
  async abrirModalDetalhe(id) {
    const request = this.solicitar('modal', 'treinos-table-body');
    if (!this.atual(request)) return;
    try {
      const workout = this.detalheLido(await API.get(`/treinos/${id}`, { timeoutMs: 15000 }), id);
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
    let editor;
    Modal.open('Planejar ficha de treino', this.renderizarConstrutorTreinoLayout(options), [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { if (this.editorAtual(editor)) Modal.close(); } },
      { text: 'Salvar ficha', class: 'btn-primary', action: () => this.salvarTreino(null, editor) }]);
    editor = this.iniciarConstrutor();
  },
  async abrirModalEditar(id) {
    const request = this.solicitar('modal', 'treinos-table-body');
    if (!this.atual(request)) return;
    try {
      const workout = this.detalheLido(await API.get(`/treinos/${id}`, { timeoutMs: 15000 }), id);
      if (!this.atual(request)) return;
      await this.carregarCatalogo(request);
      if (!this.atual(request)) return;
      let editor;
      Modal.open(`Editar ficha: ${workout.name}`, this.renderizarConstrutorTreinoLayout('', true, workout), [
        { text: 'Cancelar', class: 'btn-secondary', action: () => { if (this.editorAtual(editor)) Modal.close(); } },
        { text: 'Salvar revisão', class: 'btn-primary', action: () => this.salvarTreino(workout.id, editor) }]);
      editor = this.iniciarConstrutor(workout.id); (workout.exercises || []).forEach(ex => this.adicionarExercicio(ex));
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
      <section><form id="form-treino" class="workout-edit-form" aria-describedby="treino-save-context treino-save-feedback">
        <fieldset class="workout-metadata"><legend>Identificação e acompanhamento</legend>
        <div class="form-group"><label for="treino-aluno">Aluno</label>${isEdit ?
          `<input type="text" id="treino-aluno" value="${this.escapar(workout.student?.user?.name)}" disabled>` :
          `<select id="treino-aluno" required><option value="">Selecionar matrícula ativa</option>${options}</select>`}</div>
        <div class="form-group"><label for="treino-nome">Nome da ficha</label><input type="text" id="treino-nome" maxlength="100" value="${value('name')}" required></div>
        <div class="form-group"><label for="treino-descricao">Objetivo e contexto</label><textarea id="treino-descricao" maxlength="10000" rows="2">${value('description')}</textarea></div>
        <div class="form-group"><label for="treino-notas">Observações de acompanhamento</label><textarea id="treino-notas" maxlength="10000" rows="2">${value('notes')}</textarea></div></fieldset>
      <div class="workout-prescription-heading"><h4>Prescrição <span id="qtd-exercicios">(0)</span></h4>
      <p class="workout-history-note">Defina séries, repetições e pausas para cada exercício.</p></div>
      <div id="exercicios-container"><p class="empty-routine">Selecione exercícios do catálogo ou informe um exercício.</p></div>
      <div id="treino-save-confirmation" class="workout-save-confirmation"><p id="treino-save-context">${isEdit ? 'Ao salvar, uma nova revisão será criada e a ficha anterior será arquivada. Seus exercícios e registros serão preservados.' : 'A ficha será disponibilizada ao aluno selecionado. A prescrição é definida pelo profissional.'}</p>
        <p id="treino-save-feedback" class="workout-save-feedback" role="status" aria-live="polite" aria-atomic="true"></p>
        <button type="button" id="treino-check-saved" class="btn btn-secondary" hidden>Conferir fichas</button>
      </div><button type="submit" hidden>Salvar ${isEdit ? 'revisão' : 'ficha'}</button>
      </form></section></div>`;
  },
  iniciarConstrutor(id = null) {
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
    return this.configurarSalvamento(id);
  },
  configurarSalvamento(id) {
    const request = this.solicitar('editor', 'form-treino');
    const editor = { id, request, revision: Modal.revision, form: request.node,
      page: document.getElementById('treinos-table-body'), container: document.getElementById('exercicios-container'),
      footer: document.getElementById('modal-footer'), button: document.querySelector?.('#modal-footer .btn-primary'),
      feedback: document.getElementById('treino-save-feedback'), check: document.getElementById('treino-check-saved'),
      fields: {}, pending: null, requiresCheck: false };
    for (const name of ['treino-aluno', 'treino-nome', 'treino-descricao', 'treino-notas']) editor.fields[name] = document.getElementById(name);
    const confirmation = document.getElementById('treino-save-confirmation');
    // Move o status para junto das ações fixas sem recriar os campos preenchidos.
    if (confirmation && editor.footer) editor.footer.prepend(confirmation);
    this.editor = editor;
    if (editor.button) editor.button.setAttribute('aria-describedby', 'treino-save-context treino-save-feedback');
    if (editor.form) editor.form.onsubmit = event => { event.preventDefault(); return this.salvarTreino(id, editor); };
    if (editor.check) editor.check.onclick = async () => {
      if (!this.editorAtual(editor) || editor.pending || !editor.requiresCheck) return;
      const target = editor.targetStudentId;
      editor.pending = {};
      editor.checking = true;
      this.estadoSalvamento(editor, true);
      editor.feedback.textContent = 'Consultando fichas… Seu rascunho foi mantido.';
      try {
        const workouts = this.listaLida(await API.get(`/treinos?studentId=${target}`, { timeoutMs: 15000 }));
        if (!this.editorAtual(editor)) return;
        if (target === this.currentStudentId) this.renderizarTabela(workouts);
        const visible = workouts.slice(0, 20).map(workout => `#${workout.id}: ${workout.name}`).join('; ');
        const remaining = workouts.length > 20 ? ` Mais ${workouts.length - 20} ficha(s) não exibidas aqui.` : '';
        editor.feedback.textContent = `Consulta concluída: ${workouts.length} ficha(s) disponíveis para o aluno.${visible ? ` ${visible}.` : ''}${remaining} A lista não confirma este envio. Seu rascunho continua aqui; copie as alterações antes de cancelar este editor.`;
      } catch (error) {
        if (this.editorAtual(editor)) editor.feedback.textContent = `Não foi possível conferir as fichas: ${error.message || 'consulta indisponível'}. Seu rascunho foi mantido. Você pode conferir novamente.`;
      } finally {
        editor.pending = null;
        editor.checking = false;
        this.estadoSalvamento(editor, false);
      }
    };
    return editor;
  },
  editorAtual(editor) {
    if (!editor || this.editor !== editor || !this.atual(editor.request) || Modal.revision !== editor.revision
      || (typeof Modal.isOpen === 'function' && !Modal.isOpen())) return false;
    const anchors = [['form-treino', editor.form], ['treinos-table-body', editor.page], ['exercicios-container', editor.container],
      ['modal-footer', editor.footer], ['treino-save-feedback', editor.feedback], ['treino-check-saved', editor.check], ...Object.entries(editor.fields)];
    return anchors.every(([id, node]) => node && node.isConnected !== false && document.getElementById(id) === node)
      && (!editor.button || (editor.button.isConnected !== false && document.querySelector?.('#modal-footer .btn-primary') === editor.button));
  },
  rascunhoTreino(editor) {
    const rows = [...editor.container.querySelectorAll('.exercicio-item')].map(row => [row.dataset.catalogExerciseId, row.dataset.sourceExerciseId,
      ...['ex-nome', 'ex-grupo', 'ex-series', 'ex-reps', 'ex-pausa', 'ex-carga', 'ex-obs'].map(name => row.querySelector(`.${name}`).value)]);
    return JSON.stringify({ fields: Object.values(editor.fields).map(field => field.value), rows });
  },
  estadoSalvamento(editor, busy) {
    if (!this.editorAtual(editor)) return;
    editor.form.setAttribute('aria-busy', String(busy));
    if (editor.button) { editor.button.disabled = busy || editor.requiresCheck;
      editor.button.textContent = busy ? (editor.checking ? 'Consultando fichas…' : editor.id ? 'Salvando revisão…' : 'Salvando ficha…') : (editor.id ? 'Salvar revisão' : 'Salvar ficha'); }
    if (editor.check) { editor.check.hidden = !editor.requiresCheck; editor.check.disabled = busy; }
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
    list.innerHTML = items.length ? `<p class="workout-catalog-count" role="status">${start + 1}–${start + visible.length} de ${items.length} ${items.length === 1 ? 'exercício' : 'exercícios'}. Use a busca para refinar.</p>` + visible.map(item => `<article class="workout-catalog-item">
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
    if (item) this.adicionarExercicio({ name: item.nome, muscleGroup: item.grupo_muscular, catalogExerciseId: item.id });
  },
  adicionarExercicio(data = {}) {
    const container = document.getElementById('exercicios-container'); if (!container) return;
    if (container.querySelectorAll('.exercicio-item').length >= 100) { Toast.warning('Limite de 100 exercícios por ficha.'); return; }
    container.querySelector('.empty-routine')?.remove();
    const row = document.createElement('div'); row.className = 'exercicio-item workout-exercise-editor';
    row.dataset.catalogExerciseId = this.idValido(data.catalogExerciseId) ? String(data.catalogExerciseId) : '';
    row.dataset.sourceExerciseId = this.idValido(data.id) ? String(data.id) : '';
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
      </div><div class="exercise-origin-editor">${data.catalogSnapshot ? this.origemExercicio(data) : data.catalogExerciseId ? '<p>Exercício selecionado do catálogo. A origem e os créditos serão registrados ao salvar; nome e grupo podem ser adaptados pelo instrutor.</p>' : '<p>Exercício manual ou anterior: origem não registrada.</p>'}</div>`;
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
        catalogExerciseId: row.dataset.catalogExerciseId ? Number(row.dataset.catalogExerciseId) : null,
        sourceExerciseId: row.dataset.sourceExerciseId ? Number(row.dataset.sourceExerciseId) : null,
        reps: value('ex-reps'), restSeconds: value('ex-pausa'), suggestedLoad: value('ex-carga') || null, notes: value('ex-obs') || null };
    });
  },
  atualizarResumo() {
    if (window.PlanejamentoCiencia) window.PlanejamentoCiencia.updateRoutine(document.getElementById('planejamento-ciencia'), this.coletarExercicios());
  },
  async salvarTreino(id = null, editor = this.editor) {
    if (editor && (!this.editorAtual(editor) || editor.pending || editor.requiresCheck || editor.id !== id)) return;
    const request = this.solicitar('salvar', 'form-treino');
    if (!this.atual(request)) return;
    const exercises = this.coletarExercicios();
    const name = document.getElementById('treino-nome').value.trim();
    const studentId = id ? this.currentStudentId : Number(document.getElementById('treino-aluno').value);
    const warn = message => { if (editor?.feedback) editor.feedback.textContent = message; Toast.warning(message); };
    if (!name || !exercises.length) { warn('Informe o nome da ficha e pelo menos um exercício.'); return; }
    if (!id && !this.idValido(studentId)) { warn('Selecione o aluno.'); return; }
    for (const exercise of exercises) {
      if (!exercise.name || !/^\d+$/.test(exercise.sets) || Number(exercise.sets) < 1 || Number(exercise.sets) > 100 ||
        !/^\d+(?:\s*[-–]\s*\d+)?$/.test(exercise.reps) || !/^\d+$/.test(exercise.restSeconds) || Number(exercise.restSeconds) > 3600) {
        warn('Defina nome, séries, repetições e pausa de todos os exercícios.'); return;
      }
    }
    const payload = { name, exercises, description: document.getElementById('treino-descricao').value.trim(), notes: document.getElementById('treino-notas').value.trim() };
    if (!id) payload.studentId = studentId;
    if (!editor) editor = this.configurarSalvamento(id);
    if (!this.editorAtual(editor) || !editor.form.reportValidity()) return;
    const draft = this.rascunhoTreino(editor), pending = editor.pending = {};
    editor.targetStudentId = studentId;
    editor.feedback.textContent = id ? 'Salvando a nova revisão…' : 'Salvando a ficha…';
    this.estadoSalvamento(editor, true);
    try {
      const response = id ? await API.put(`/treinos/${id}`, payload, { timeoutMs: 15000 }) : await API.post('/treinos', payload, { timeoutMs: 15000 });
      if (!this.atual(request) || !this.editorAtual(editor)) return;
      if (this.rascunhoTreino(editor) !== draft) {
        editor.requiresCheck = true;
        editor.feedback.textContent = 'A ficha enviada foi salva. O rascunho alterado durante o envio foi mantido e ainda não foi salvo. Confira as fichas antes de continuar.';
        return;
      }
      Toast.success(response?.message || 'Ficha salva.'); Modal.close(); this.editor = null;
      if (studentId === this.currentStudentId) await this.carregarTreinos(studentId);
      else if (this.idValido(studentId)) await this.abrirPerfilAluno(studentId, this.alunosCache.find(student => student.id === studentId)?.name || `Aluno #${studentId}`);
    } catch (error) {
      if (!this.atual(request) || !this.editorAtual(editor)) return;
      editor.requiresCheck = Boolean(error.timeout || !error.status || error.status >= 500);
      editor.feedback.textContent = editor.requiresCheck
        ? 'Resultado não confirmado. Este envio pode já ter sido salvo. Seus campos foram mantidos; confira as fichas antes de iniciar outro envio.'
        : error.message || 'A ficha foi recusada. Confira os campos antes de salvar novamente.';
    } finally {
      if (editor.pending === pending) editor.pending = null;
      this.estadoSalvamento(editor, false);
    }
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
