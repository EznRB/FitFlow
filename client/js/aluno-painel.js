/** Área do aluno. Respostas pertencem à conta e à instância da página que as iniciou. */
const AlunoUI = {
  escape(value) { return FitFlowSecurity.escapeHtml(value ?? ''); },
  numeric(value) { return (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)); },
  number(value) { return this.numeric(value) ? Number(value).toLocaleString('pt-BR') : '—'; },
  money(value) { return this.numeric(value) ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'; },
  date(value, options, civil = false) {
    if (!value) return '—';
    const date = new Date(value);
    // Presença usa DATE no banco: 00:00 UTC é uma data civil, não o dia anterior no Brasil.
    if (!Number.isFinite(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', { ...options, ...(civil ? { timeZone: 'UTC' } : {}) });
  },
  icons(container) { if (window.lucide) lucide.createIcons({ nodes: [container] }); },
  identity() { return { userId: Auth.user?.id, role: Auth.user?.role, generation: Auth.generation,
    epoch: typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null }; },
  ownsIdentity(scope) {
    return Boolean(scope?.userId && Auth.user?.id === scope.userId && Auth.user?.role === scope.role
      && Auth.generation === scope.generation && (typeof Auth.getSessionEpoch !== 'function'
        || Auth.sessionEpoch === scope.epoch && Auth.getSessionEpoch() === scope.epoch));
  },
  recordRow(record) {
    return `<li><span>${this.number(record.peso)} kg${record.reps != null ? ` × ${this.number(record.reps)} reps` : ' · repetições não informadas'}${record.notas ? `<small>${this.escape(record.notas)}</small>` : ''}</span><time>${this.date(record.data, { hour: '2-digit', minute: '2-digit' })}</time></li>`;
  },
  capture(view, container) {
    const sequence = view.sequence = (view.sequence || 0) + 1;
    const userId = Auth.user?.id;
    const generation = Auth.generation;
    const role = Auth.user?.role;
    const epoch = typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null;
    const page = typeof App === 'undefined' ? null : App.currentPage;
    return () => Boolean(userId && Auth.user?.id === userId && Auth.user?.role === role && Auth.generation === generation
      && (typeof Auth.getSessionEpoch !== 'function' || Auth.sessionEpoch === epoch && Auth.getSessionEpoch() === epoch)
      && (typeof App === 'undefined' || App.currentPage === page)
      && view.sequence === sequence && container.isConnected && document.getElementById(container.id) === container);
  },
  async load(view, id, label, fetch, render) {
    const container = document.getElementById(id);
    if (!container || !Auth.user?.id) return;
    container.classList.add('ff-student');
    const current = this.capture(view, container);
    if (!current()) return;
    container.innerHTML = `<div class="page-loading" role="status"><div class="spinner" aria-hidden="true"></div><span>${this.escape(label)}</span></div>`;
    try {
      const data = await fetch(current);
      if (!current()) return;
      render(container, data);
    } catch (error) {
      if (!current()) return;
      container.innerHTML = `<div class="ff-student-error" role="alert"><h3>Não foi possível carregar esta página</h3><p>${this.escape(error.message || 'Verifique sua conexão e tente novamente.')}</p><button type="button" class="btn btn-secondary" data-retry>Tentar novamente</button></div>`;
      container.querySelector('[data-retry]').onclick = () => view.inicializar();
    }
  },
  bind(container, actions) {
    (container.querySelectorAll?.('[data-action]') || []).forEach(button => {
      button.onclick = () => actions[button.dataset.action]?.(button);
    });
    this.icons(container);
  },
  heading(eyebrow, title, description) { return `<header class="ff-student-heading"><span class="ff-student-eyebrow">${this.escape(eyebrow)}</span><h2>${this.escape(title)}</h2><p>${this.escape(description)}</p></header>`; },
  empty(title, description) { return `<div class="ff-student-empty"><h3>${this.escape(title)}</h3><p>${this.escape(description)}</p></div>`; },
  blocked(message) { return `<div class="aluno-banner-blocked" role="status"><i data-lucide="alert-circle" aria-hidden="true"></i><span>${this.escape(message)}</span></div>`; }
};

const AlunoPainelView = {
  dados: null,
  inicializar() { return AlunoUI.load(this, 'aluno-painel-container', 'Carregando seu painel…', async () => (await API.get('/aluno/painel', { timeoutMs: 15000 })).data, (container, data) => { this.dados = data; this.renderizar(container); }); },
  renderizar(container) {
    const d = this.dados;
    const dias = d.mensalidade.diasRestantes;
    const restante = dias == null ? '—' : dias < 0 ? 'Vencida' : dias === 0 ? 'Vence hoje' : `${AlunoUI.number(dias)} dias`;
    const stats = [ ['aluno-mensalidade', 'Vigência do plano', restante, 'Ver mensalidade'], ['aluno-checkin', 'Presenças neste mês', AlunoUI.number(d.checkins.totalMes), 'Ver presenças'], ['aluno-treino', 'Fichas ativas', AlunoUI.number(d.treinos.length), 'Ver fichas'] ];
    const cards = stats.map(([page, label, value, action]) => `<button type="button" class="ff-student-stat" data-action="navigate" data-page="${page}"><span class="ff-student-stat-label">${label}</span><strong>${value}</strong><span class="ff-student-stat-link">${action}<i data-lucide="arrow-up-right" aria-hidden="true"></i></span></button>`).join('');
    container.innerHTML = AlunoUI.heading('Sua rotina', `Olá, ${String(d.perfil.nome).split(' ')[0]}`, 'Sua ficha, seus registros e a situação da matrícula em um só lugar.') + this._renderAlertas(d.alertas) + `<div class="ff-student-stats">${cards}</div>
      <section class="ff-student-start"><div><span class="ff-student-eyebrow">Registro do treino</span><h3>Uma sessão, série por série</h3><p>Registre carga, repetições e esforço percebido durante o treino. Os registros confirmados compõem sua evolução.</p></div><button type="button" class="btn btn-primary" data-action="sessions"><i data-lucide="play" aria-hidden="true"></i>Abrir sessões</button></section>
      <div class="ff-student-columns">${this._renderTreinoResumo(d.treinos)}${this._renderCheckinsRecentes(d.checkins.recentes)}</div>`;
    AlunoUI.bind(container, { navigate: button => App.navigateTo(button.dataset.page), sessions: () => App.navigateTo('sessoes'), workout: () => App.navigateTo('aluno-treino') });
  },
  _renderAlertas(alertas) {
    return (alertas || []).map(a => `<div class="ff-student-notice ${a.severidade === 'critico' ? 'ff-student-notice-error' : ''}" role="status"><i data-lucide="info" aria-hidden="true"></i><span>${AlunoUI.escape(a.mensagem)}</span></div>`).join('');
  },
  _renderTreinoResumo(treinos) {
    return `<section class="ff-student-section"><h3>Ficha atual</h3>${treinos.length ? `<h4>${AlunoUI.escape(treinos[0].nome)}</h4><p>${AlunoUI.escape(treinos[0].descricao || 'Exercícios e orientações cadastrados pelo seu instrutor.')}</p><div class="ff-student-detail">${AlunoUI.number(treinos[0].qtdExercicios)} exercícios · ${AlunoUI.escape(treinos[0].instrutor)}</div><button type="button" class="btn btn-secondary" data-action="workout">Consultar ficha</button>` : AlunoUI.empty('Nenhuma ficha ativa', 'Peça ao seu instrutor uma ficha adequada ao seu contexto.')}</section>`;
  },
  _renderCheckinsRecentes(checkins) {
    return `<section class="ff-student-section"><h3>Presenças recentes</h3>${checkins.length ? `<ul class="ff-student-records">${checkins.slice(0, 3).map(c => `<li><span>Presença registrada</span><time>${AlunoUI.date(c.data, undefined, true)}</time></li>`).join('')}</ul>` : AlunoUI.empty('Nenhuma presença registrada', 'Registre sua entrada na página Presença.')}</section>`;
  }
};

const AlunoTreinoView = {
  dados: null,
  bloqueado: false,
  loadModal: null,
  loadScope: null,
  loadDrafts: new Map(),
  loadState(exerciseId) {
    if (!AlunoUI.ownsIdentity(this.loadScope)) { this.loadDrafts.clear(); this.loadScope = AlunoUI.identity(); }
    if (!AlunoUI.ownsIdentity(this.loadScope)) return null;
    if (!this.loadDrafts.has(exerciseId)) this.loadDrafts.set(exerciseId, { scope: this.loadScope,
      draft: { weight: '', reps: '', notes: '' }, pending: null, reviewRequired: false, reviewed: false, notice: '' });
    return this.loadDrafts.get(exerciseId);
  },
  inicializar() { return AlunoUI.load(this, 'aluno-treino-container', 'Carregando suas fichas…', async () => (await API.get('/aluno/painel', { timeoutMs: 15000 })).data, (container, data) => { this.dados = data; this.bloqueado = data.perfil.status !== 'active'; this.renderizar(container); }); },
  renderizar(container) {
    const d = this.dados;
    container.innerHTML = AlunoUI.heading('Orientação do instrutor', 'Suas fichas de treino', 'Consulte a prescrição. Para acompanhar cada série e seu volume, use Sessões e séries.') +
      (this.bloqueado ? AlunoUI.blocked('Matrícula indisponível para novos registros. Consulte a administração.') : '') +
      (d.treinos.length ? `<div class="ff-student-toolbar"><button type="button" class="btn btn-primary" data-action="sessions">Abrir sessões e séries</button></div>` + d.treinos.map(t => `<section class="aluno-treino-card"><header class="aluno-treino-header"><div><h3>${AlunoUI.escape(t.nome)}</h3>${t.descricao ? `<p>${AlunoUI.escape(t.descricao)}</p>` : ''}</div><div class="treino-meta">${AlunoUI.escape(t.instrutor)}<br>Ficha de ${AlunoUI.date(t.criadoEm)}</div></header><div class="aluno-treino-body">${t.exercicios.map((ex, i) => this._renderExercicio(ex, i)).join('')}</div></section>`).join('') : AlunoUI.empty('Nenhuma ficha disponível', 'Se sua matrícula estiver ativa, peça ao instrutor para cadastrar uma ficha.'));
    AlunoUI.bind(container, { sessions: () => App.navigateTo('sessoes'), load: button => this.abrirRegistroCarga(Number(button.dataset.exerciseId), button.dataset.exerciseName) });
  },
  _renderExercicio(ex, idx) {
    const recordedDate = AlunoUI.date(ex.ultimaCarga?.data);
    const ultima = ex.ultimaCarga ? `${AlunoUI.number(ex.ultimaCarga.peso)} kg${ex.ultimaCarga.reps != null ? ` × ${AlunoUI.number(ex.ultimaCarga.reps)} reps` : ' · repetições não informadas'}<small>${recordedDate === '—' ? 'Data não informada' : recordedDate}</small>` : 'Sem registro avulso';
    const descanso = ex.descansoSegundos == null ? 'Não informado' : `${AlunoUI.number(ex.descansoSegundos)} s`;
    const origin = typeof FitFlowExerciseOrigin === 'undefined' ? '' : FitFlowExerciseOrigin.render({ name: ex.nome,
      muscleGroup: ex.grupoMuscular, catalogExerciseId: ex.catalogExerciseId, catalogSnapshot: ex.catalogSnapshot }, value => AlunoUI.escape(value));
    return `<article class="aluno-exercicio"><div class="aluno-exercicio-top"><div class="aluno-exercicio-nome"><span class="aluno-exercicio-numero">${idx + 1}</span><h4>${AlunoUI.escape(ex.nome)}</h4></div><button type="button" class="btn btn-secondary ff-student-small" data-action="load" data-exercise-id="${Number(ex.id)}" data-exercise-name="${AlunoUI.escape(ex.nome)}" ${this.bloqueado ? 'disabled' : ''}>Registro avulso</button></div><dl class="ff-student-prescription"><div><dt>Séries e repetições prescritas</dt><dd>${AlunoUI.escape(ex.series)} × ${AlunoUI.escape(ex.reps)}</dd></div><div><dt>Descanso prescrito</dt><dd>${descanso}</dd></div><div><dt>Carga orientada</dt><dd>${AlunoUI.escape(ex.cargaSugerida || 'Não informada')}</dd></div><div class="ff-student-last-log"><dt>Último registro avulso</dt><dd>${ultima}</dd></div></dl>${ex.grupoMuscular ? `<p class="ff-student-detail">Grupo cadastrado: ${AlunoUI.escape(ex.grupoMuscular)}</p>` : ''}${ex.notas ? `<p class="aluno-exercicio-notas">${AlunoUI.escape(ex.notas)}</p>` : ''}<div class="ff-student-origin">${origin}</div></article>`;
  },
  abrirRegistroCarga(exerciseId, nome) {
    if (this.bloqueado || Auth.user?.role !== 'student' || !Number.isSafeInteger(exerciseId) || exerciseId < 1
      || (typeof App !== 'undefined' && App.currentPage !== 'aluno-treino')) return;
    const container = document.getElementById('aluno-treino-container');
    if (!container) return;
    const ownsPage = AlunoUI.capture(this, container);
    if (!ownsPage()) return;
    const record = this.loadState(exerciseId);
    if (!record) return;
    // A confirmação vale para a consulta visível naquele diálogo, não para uma
    // reabertura sem os registros que a pessoa precisa comparar.
    if (record.reviewed) {
      record.reviewed = false;
      record.notice = 'Seus valores foram mantidos. Consulte novamente o histórico nesta reabertura antes de liberar outro envio; o anterior pode já ter sido salvo.';
    }
    const context = { exerciseId, record, form: null, pending: null, current: () => ownsPage()
      && this.loadModal === context && Auth.user?.role === 'student'
      && (typeof App === 'undefined' || App.currentPage === 'aluno-treino')
      && Modal.revision === context.revision && Modal.isOpen()
      && context.form?.isConnected && document.getElementById('form-carga-aluno') === context.form };
    const html = `<form id="form-carga-aluno" class="ff-student-load-form"><p>Registro avulso do histórico anterior. Ele não representa automaticamente uma sessão completa. Para registrar séries, abra Sessões e séries.</p><div class="form-group"><label for="aluno-carga-peso">Carga externa (kg)</label><input type="number" id="aluno-carga-peso" step="0.01" min="0" max="9999.99" required><small>Informe 0 quando não houver carga externa.</small></div><div class="form-group"><label for="aluno-carga-reps">Repetições realizadas (opcional)</label><input type="number" id="aluno-carga-reps" min="1" max="1000" step="1"></div><div class="form-group"><label for="aluno-carga-obs">Observação (opcional)</label><input type="text" id="aluno-carga-obs" maxlength="10000"></div><button type="submit" hidden>Salvar registro</button><p id="aluno-carga-feedback" role="status" aria-live="polite"></p><div class="ff-student-recovery"><button type="button" class="btn btn-secondary" id="aluno-carga-consultar" hidden>Conferir histórico antes de repetir</button><div id="aluno-carga-review"></div><button type="button" class="btn btn-secondary" id="aluno-carga-revisado" hidden>Revisei o histórico; liberar novo envio</button></div><p class="ff-student-draft-note">Rascunho mantido nesta aba enquanto sua sessão estiver ativa. Recarregar ou sair encerra essa cópia local.</p></form>`;
    Modal.open(`Registro avulso: ${nome}`, html, [{ text: 'Cancelar', class: 'btn-secondary', action: () => { if (context.current()) Modal.close(); } }, { text: 'Salvar registro', class: 'btn-primary', action: () => this.salvarCarga(context) }]);
    context.form = document.getElementById('form-carga-aluno'); context.revision = Modal.revision; this.loadModal = context;
    if (!context.form) return;
    context.fields = { weight: context.form.querySelector('#aluno-carga-peso'), reps: context.form.querySelector('#aluno-carga-reps'), notes: context.form.querySelector('#aluno-carga-obs') };
    context.feedback = context.form.querySelector('#aluno-carga-feedback');
    context.draft = () => ({ weight: context.fields.weight.value, reps: context.fields.reps.value, notes: context.fields.notes.value });
    Object.entries(context.fields).forEach(([key, field]) => { field.value = record.draft[key]; field.oninput = () => {
      if (context.current()) record.draft = context.draft();
    }; });
    context.consult = context.form.querySelector('#aluno-carga-consultar');
    context.review = context.form.querySelector('#aluno-carga-review');
    context.confirmReview = context.form.querySelector('#aluno-carga-revisado');
    context.saveButton = Modal.footerEl?.querySelector('.btn-primary');
    context.consult.onclick = () => this.consultarRegistroCarga(context);
    context.confirmReview.onclick = () => this.confirmarRevisaoCarga(context);
    this.loadFeedback(context);
    context.form.onsubmit = event => { event.preventDefault(); return this.salvarCarga(context); };
  },
  loadFeedback(context) {
    if (!context.current()) return;
    const record = context.record;
    context.feedback.textContent = record.notice;
    context.consult.hidden = !record.reviewRequired || Boolean(record.pending);
    context.consult.disabled = Boolean(record.consulting);
    context.confirmReview.hidden = !record.reviewRequired || !record.reviewed;
    if (context.saveButton) context.saveButton.disabled = Boolean(record.pending) || record.reviewRequired;
  },
  async consultarRegistroCarga(context = this.loadModal) {
    if (!context?.current() || !context.record.reviewRequired || context.record.pending || context.record.consulting) return;
    const record = context.record, consultation = record.consulting = {};
    record.reviewed = false;
    record.notice = 'Consultando o histórico deste exercício. Nenhum novo registro será enviado…'; this.loadFeedback(context);
    try {
      const response = await API.get(`/aluno/historico-carga?exerciseId=${context.exerciseId}`, { timeoutMs: 15000 });
      if (!context.current() || record.consulting !== consultation) {
        if (AlunoUI.ownsIdentity(record.scope)) record.notice = 'A consulta pertence ao formulário anterior. Confira novamente o histórico antes de liberar outro envio.';
        return;
      }
      if (!Array.isArray(response.data) || response.data.some(group => Number(group?.exercicioId) !== context.exerciseId
        || typeof group.exercicioNome !== 'string' || !group.exercicioNome.trim() || !Array.isArray(group.registros)
        || group.registros.some(row => !row || !AlunoUI.numeric(row.peso) || Number(row.peso) < 0 || Number(row.peso) > 9999.99
          || row.reps !== null && (!Number.isSafeInteger(row.reps) || row.reps < 1 || row.reps > 1000)
          || typeof row.data !== 'string' || !Number.isFinite(new Date(row.data).getTime())
          || row.notas != null && typeof row.notas !== 'string'))) throw new Error('Histórico inválido; confira novamente antes de repetir.');
      context.review.innerHTML = `<section class="ff-student-load-review"><h4>Histórico consultado agora</h4><p>Até 100 registros deste exercício, do mais recente ao mais antigo. Compare carga, repetições, data e observação com seu rascunho. A consulta não garante que um envio ainda em processamento já esteja visível.</p>${response.data.length ? response.data.map(group => `<h5>${AlunoUI.escape(group.exercicioNome)}</h5><ul class="ff-student-records">${group.registros.map(row => AlunoUI.recordRow(row)).join('')}</ul>`).join('') : '<p>Nenhum registro retornado nesta consulta.</p>'}</section>`;
      record.reviewed = true;
      record.notice = 'Histórico atualizado. Revise os registros antes de liberar outro envio. O envio anterior pode já ter sido salvo; repetir pode duplicá-lo.';
    } catch (error) {
      if (!context.current()) return;
      record.reviewed = false;
      record.notice = 'Não foi possível consultar o histórico. O novo envio continua bloqueado; tente conferir novamente.';
    } finally {
      if (record.consulting === consultation) record.consulting = null;
      if (AlunoUI.ownsIdentity(record.scope)) this.loadFeedback(this.loadModal?.record === record ? this.loadModal : context);
    }
  },
  confirmarRevisaoCarga(context = this.loadModal) {
    if (!context?.current() || !context.record.reviewed || context.record.pending || context.record.consulting) return;
    context.record.reviewRequired = false; context.record.reviewed = false;
    context.record.notice = 'Revisão confirmada. Seus valores foram mantidos. Confira-os antes de enviar um novo registro.';
    context.review.innerHTML = ''; this.loadFeedback(context);
  },
  async salvarCarga(context = this.loadModal) {
    if (!context?.current?.() || context.pending || context.record.pending || context.record.reviewRequired || !context.form.reportValidity()) return;
    const record = context.record, draft = context.draft(), pending = context.pending = record.pending = { promise: null };
    record.draft = draft; record.reviewed = false;
    const payload = { exerciseId: context.exerciseId, weight: Number(draft.weight), repsCompleted: draft.reps === '' ? null : Number(draft.reps), notes: draft.notes.trim() || null };
    record.notice = 'Salvando este registro…'; this.loadFeedback(context);
    try {
      pending.promise = API.post('/treinos/carga', payload, { timeoutMs: 15000 });
      await pending.promise;
      if (!AlunoUI.ownsIdentity(record.scope)) return;
      record.reviewRequired = true;
      record.notice = 'Registro anterior salvo. Seus valores foram mantidos; confira o histórico antes de enviar outro registro.';
      if (!context.current()) { this.loadFeedback(this.loadModal || context); return; }
      // Os campos continuam editáveis. Só fechamos o formulário se o ACK corresponde
      // ao rascunho ainda exibido; digitação posterior pertence à próxima decisão.
      if (JSON.stringify(context.draft()) !== JSON.stringify(draft)) {
        record.draft = context.draft();
        record.notice = 'Registro anterior salvo. Seus novos valores foram mantidos no formulário; eles ainda não foram enviados. Confira o histórico antes de enviar outro registro.';
        this.loadFeedback(context);
        return;
      }
      this.loadDrafts.delete(context.exerciseId);
      Modal.close();
      Toast.success('Registro avulso salvo.');
      await this.inicializar();
    } catch (error) {
      if (!AlunoUI.ownsIdentity(record.scope)) return;
      const uncertain = error.timeout || !error.status || error.status >= 500;
      record.reviewRequired = uncertain;
      record.notice = uncertain
        ? 'Resultado não confirmado. Confira o histórico de registros avulsos antes de repetir; este envio pode já ter sido salvo. Seus valores foram mantidos.'
        : error.message || 'O registro foi recusado. Confira os dados antes de tentar novamente.';
    } finally {
      if (context.pending === pending) context.pending = null;
      if (record.pending === pending) record.pending = null;
      if (AlunoUI.ownsIdentity(record.scope)) this.loadFeedback(this.loadModal?.record === record ? this.loadModal : context);
    }
  }
};

const AlunoHistoricoView = {
  inicializar() { return AlunoUI.load(this, 'aluno-historico-container', 'Carregando registros avulsos…', async () => (await API.get('/aluno/historico-carga', { timeoutMs: 15000 })).data, (container, data) => this.renderizar(container, data)); },
  renderizar(container, grupos) {
    container.innerHTML = AlunoUI.heading('Histórico anterior', 'Registros avulsos de carga', 'Até 100 registros mais recentes retornados pela API. Estes registros não incluem as séries salvas em Sessões e séries.') + (!grupos?.length ? AlunoUI.empty('Nenhum registro avulso', 'Sua evolução por sessão está disponível na página Evolução.') : grupos.map(g => {
      const summary = FitFlowScience.summarizeLogs(g.registros);
      const first = g.registros.slice(0, 8), more = g.registros.slice(8);
      return `<section class="ff-student-section"><h3>${AlunoUI.escape(g.exercicioNome)}</h3>${g.grupoMuscular ? `<p class="ff-student-detail">${AlunoUI.escape(g.grupoMuscular)}</p>` : ''}<p class="ff-student-record-count">${first.length} de ${g.registros.length} registros na lista inicial${more.length ? ` · ${more.length} na expansão abaixo` : ''}.</p><ul class="ff-student-records">${first.map(r => AlunoUI.recordRow(r)).join('')}</ul>${more.length ? `<details class="ff-student-history-more"><summary>Ver mais ${more.length} registros de ${AlunoUI.escape(g.exercicioNome)}</summary><ul class="ff-student-records">${more.map(r => AlunoUI.recordRow(r)).join('')}</ul><p class="ff-student-detail">Todos os ${g.registros.length} registros retornados deste exercício estão disponíveis acima.</p></details>` : ''}<p class="science-note">Volume conhecido dos ${g.registros.length} registros retornados: ${AlunoUI.number(summary.knownVolumeKg)} kg·repetições · ${summary.completeRecords} completos · ${summary.incompleteRecords} incompletos. Carga × repetições não mede hipertrofia; compare o mesmo exercício e equipamento.</p></section>`;
    }).join(''));
    AlunoUI.icons(container);
  }
};

const AlunoMensalidadeView = {
  inicializar() { return AlunoUI.load(this, 'aluno-mensalidade-container', 'Carregando sua mensalidade…', async () => (await API.get('/aluno/mensalidade', { timeoutMs: 15000 })).data, (container, data) => this.renderizar(container, data)); },
  renderizar(container, dados) {
    const statuses = { em_dia: 'Em dia', vencendo: 'Vencimento próximo', vencido: 'Vencida', bloqueado: 'Matrícula bloqueada', indefinido: 'Vigência não informada' };
    const label = Object.hasOwn(statuses, dados.statusVisual) ? statuses[dados.statusVisual] : 'Situação não informada';
    const dias = dados.diasRestantes == null ? 'Não informado' : dados.diasRestantes < 0 ? 'Vencida' : dados.diasRestantes === 0 ? 'Vence hoje' : `${AlunoUI.number(dados.diasRestantes)} dias`;
    const methods = { cash: 'Dinheiro', pix: 'Pix', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', transfer: 'Transferência', card: 'Cartão', dinheiro: 'Dinheiro', cartao: 'Cartão', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito', boleto: 'Boleto', transferencia: 'Transferência', simulado: 'Simulado' };
    const history = dados.historicoPagamentos || [];
    container.innerHTML = AlunoUI.heading('Sua matrícula', 'Plano e mensalidade', 'Consulte a vigência e os pagamentos registrados pela academia.') + (dados.statusAluno === 'blocked' ? AlunoUI.blocked('Matrícula bloqueada. Consulte a administração para regularização.') : '') + `<section class="ff-student-section ff-student-membership"><div class="ff-student-section-top"><h3>Plano atual</h3><span class="ff-student-status">${label}</span></div><dl class="ff-student-prescription"><div><dt>Plano</dt><dd>${AlunoUI.escape(dados.plano?.nome || 'Não vinculado')}</dd></div><div><dt>Valor do plano</dt><dd>${dados.plano ? AlunoUI.money(dados.plano.preco) : '—'}</dd></div><div><dt>Fim da vigência</dt><dd>${AlunoUI.date(dados.vencimento, undefined, true)}</dd></div><div><dt>Tempo restante</dt><dd>${dias}</dd></div></dl><div class="ff-student-payment-action"><button type="button" class="btn btn-primary" data-action="checkout"><i data-lucide="credit-card" aria-hidden="true"></i>Consultar renovação</button><p data-checkout-status role="status" aria-live="polite">Consultando disponibilidade do checkout…</p><p>A situação do pagamento é confirmada pelo servidor. Voltar do checkout não confirma uma renovação.</p></div></section><section class="ff-student-section"><h3>Últimos pagamentos registrados</h3>${history.length ? `<ul class="ff-student-records ff-student-payments">${history.map(p => { const status = p.status === 'paid' ? 'Pago' : p.status === 'overdue' ? 'Em atraso' : 'Pendente'; return `<li><div><strong>${AlunoUI.money(p.valor)}</strong><span>${AlunoUI.escape(p.plano || 'Plano não informado')} · ${AlunoUI.escape(Object.hasOwn(methods, p.metodo) ? methods[p.metodo] : p.metodo || 'Método não informado')}</span></div><div><span>${status}</span><time>${AlunoUI.date(p.dataPagamento)}</time>${p.resumoAjustes?.adjustedAmount > 0 ? `<span>Ajustes: ${AlunoUI.money(p.resumoAjustes.adjustedAmount)} · saldo registrado: ${AlunoUI.money(p.resumoAjustes.remainingAmount)}</span>` : ''}</div></li>`; }).join('')}</ul>` : AlunoUI.empty('Nenhum pagamento registrado', 'A administração pode orientar sobre a situação da matrícula.')}</section>`;
    AlunoUI.bind(container, { checkout: () => this.abrirCheckout() });
    if (typeof MercadoPagoCheckout !== 'undefined' && typeof MercadoPagoCheckout.decorateMembership === 'function') {
      MercadoPagoCheckout.decorateMembership(container, AlunoUI.capture(this, container));
    }
  },
  abrirCheckout() { if (typeof MercadoPagoCheckout !== 'undefined') return MercadoPagoCheckout.abrir(); Toast.error('Checkout indisponível. Consulte a administração.'); }
};

const AlunoCheckinView = {
  studentId: null,
  bloqueado: false,
  posting: false,
  checkinRecord: null,
  checkinState() {
    if (!AlunoUI.ownsIdentity(this.checkinRecord?.scope)) this.checkinRecord = { scope: AlunoUI.identity(), pending: null, reviewRequired: false, reviewed: false, notice: '' };
    return this.checkinRecord;
  },
  validarCheckins(dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)
      || !Number.isSafeInteger(dados.totalMes) || dados.totalMes < 0
      || !Number.isSafeInteger(dados.total) || dados.total < 0
      || !Array.isArray(dados.checkins) || dados.checkins.length > dados.total
      || dados.checkins.some(item => !item || !Number.isSafeInteger(item.id) || item.id < 1
        || !['present', 'cancelled'].includes(item.status)
        || typeof item.data !== 'string' || !Number.isFinite(new Date(item.data).getTime()))) {
      throw new Error('O servidor não retornou uma lista válida de presenças. Consulte novamente antes de registrar ou repetir uma entrada.');
    }
    return dados;
  },
  inicializar() {
    this.checkinContext = null;
    if (AlunoUI.ownsIdentity(this.checkinRecord?.scope) && this.checkinRecord.reviewRequired) this.checkinRecord.reviewed = false;
    return AlunoUI.load(this, 'aluno-checkin-container', 'Carregando suas presenças…', async current => {
    const painel = (await API.get('/aluno/painel', { timeoutMs: 15000 })).data;
    if (!current()) return null;
    const checkins = (await API.get('/aluno/checkins?limit=15', { timeoutMs: 15000 })).data;
    return { painel, checkins };
  }, (container, data) => {
    this.validarCheckins(data?.checkins);
    if (!Number.isSafeInteger(data?.painel?.perfil?.id) || data.painel.perfil.id < 1
      || !['active', 'inactive', 'blocked'].includes(data.painel.perfil.status)) throw new Error('O servidor não confirmou a situação da matrícula. Consulte novamente.');
    this.studentId = data.painel.perfil.id; this.bloqueado = data.painel.perfil.status !== 'active';
    const record = this.checkinState();
    if (record.reviewRequired && !record.pending) record.reviewed = true;
    this.renderizar(container, data.checkins);
  }); },
  renderizar(container, dados) {
    this.validarCheckins(dados);
    this.container = container;
    container.innerHTML = AlunoUI.heading('Entrada na academia', 'Sua presença', 'Registre sua entrada ao chegar. Presença e sessão de treino são registros diferentes.') + (this.bloqueado ? AlunoUI.blocked('Matrícula indisponível para registrar presença. Consulte a administração.') : '') + `<section class="ff-student-start"><div><span class="ff-student-stat-label">Presenças confirmadas neste mês</span><strong class="ff-student-count">${AlunoUI.number(dados.totalMes)}</strong></div><button type="button" class="btn btn-primary" id="btn-aluno-checkin" data-action="checkin" ${this.bloqueado ? 'disabled' : ''}><i data-lucide="calendar-check" aria-hidden="true"></i>Registrar entrada de hoje</button><p id="checkin-feedback" class="ff-student-feedback" role="status" aria-live="polite"></p><div class="ff-student-recovery"><button type="button" class="btn btn-secondary" id="btn-aluno-checkin-consultar" data-action="consultCheckin" hidden>Consultar presenças antes de repetir</button><button type="button" class="btn btn-secondary" id="btn-aluno-checkin-revisado" data-action="reviewCheckin" hidden>Revisei as presenças; liberar novo envio</button></div></section><section class="ff-student-section"><h3>Últimas 15 presenças e cancelamentos</h3>${dados.checkins?.length ? `<ul class="ff-student-records">${dados.checkins.map(c => `<li><span>${c.status === 'cancelled' ? 'Presença cancelada' : c.status === 'present' ? 'Presença registrada' : 'Situação não informada'}</span><time>${AlunoUI.date(c.data, undefined, true)}</time></li>`).join('')}</ul>` : AlunoUI.empty('Nenhuma presença registrada', 'Use o botão acima para registrar sua entrada de hoje.')}</section>`;
    this.checkinContext = AlunoUI.capture(this, container);
    const rendered = this.checkinContext;
    this.checkinFeedback();
    AlunoUI.bind(container, { checkin: () => { if (rendered()) return this.fazerCheckin(); },
      consultCheckin: () => { if (rendered()) return this.inicializar(); }, reviewCheckin: () => { if (rendered()) this.confirmarRevisao(); } });
  },
  checkinFeedback() {
    const container = this.container;
    if (!this.checkinContext?.() || !container?.isConnected || document.getElementById(container.id) !== container) return;
    const record = this.checkinState(), button = container.querySelector('#btn-aluno-checkin'), feedback = container.querySelector('#checkin-feedback');
    if (!button || !feedback) return;
    button.disabled = this.bloqueado || Boolean(record.pending) || record.reviewRequired;
    button.textContent = record.pending ? 'Registrando entrada…' : 'Registrar entrada de hoje';
    feedback.textContent = record.notice;
    const consult = container.querySelector('#btn-aluno-checkin-consultar'), reviewed = container.querySelector('#btn-aluno-checkin-revisado');
    if (consult) consult.hidden = !record.reviewRequired || Boolean(record.pending);
    if (reviewed) reviewed.hidden = !record.reviewRequired || !record.reviewed || Boolean(record.pending);
  },
  confirmarRevisao() {
    if (!this.checkinContext?.()) return;
    const record = this.checkinState();
    if (!record.reviewed || record.pending) return;
    record.reviewRequired = false; record.reviewed = false;
    record.notice = 'Revisão confirmada. A consulta não garante que um envio ainda em processamento já esteja visível. Confira a data antes de registrar novamente.';
    this.checkinFeedback();
  },
  async fazerCheckin() {
    // A identidade pertence à renderização que mostrou o botão. Capturar uma
    // identidade nova aqui autorizaria um botão antigo da conta anterior.
    const current = this.checkinContext;
    if (!current?.() || Auth.user?.role !== 'student') return;
    const record = this.checkinState();
    if (record.pending || record.reviewRequired || this.bloqueado || !this.container?.isConnected) return;
    const container = this.container;
    const userId = Auth.user?.id;
    const generation = Auth.generation;
    const button = container.querySelector('#btn-aluno-checkin');
    const feedback = container.querySelector('#checkin-feedback');
    if (!button || !feedback) return;
    const pending = record.pending = {};
    record.reviewed = false; this.posting = true;
    button.disabled = true;
    button.textContent = 'Registrando entrada…';
    feedback.textContent = '';
    try {
      await API.post('/checkins', {}, { timeoutMs: 15000 });
      if (!AlunoUI.ownsIdentity(record.scope)) return;
      record.notice = 'Entrada de hoje confirmada pelo servidor. Se já existia, a presença foi mantida sem duplicação.';
      if (!current()) return;
      await this.inicializar();
      if (document.getElementById(container.id) === container && Auth.user?.id === userId && Auth.generation === generation && container.isConnected && this.container === container) {
        const updated = container.querySelector('#checkin-feedback');
        if (updated) updated.textContent = 'Entrada de hoje registrada. Se já existia, a presença foi mantida sem duplicação.';
      }
    } catch (error) {
      if (!AlunoUI.ownsIdentity(record.scope)) return;
      record.reviewRequired = Boolean(error.timeout || !error.status || error.status >= 500 || error.status === 409);
      record.notice = error.timeout || !error.status || error.status >= 500
        ? 'Resultado não confirmado. A entrada pode já ter sido registrada. Consulte as presenças e revise os registros antes de repetir.'
        : error.message || 'O registro de presença foi recusado. Confira os dados antes de tentar novamente.';
    } finally {
      if (record.pending === pending) record.pending = null;
      if (this.checkinRecord === record && AlunoUI.ownsIdentity(record.scope)) {
        this.posting = false;
        if (current() || this.checkinContext?.()) this.checkinFeedback();
      }
    }
  }
};

if (typeof window.addEventListener === 'function') window.addEventListener('auth:logout', () => {
  // Rascunhos e resultados incertos pertencem somente a esta sessão, em RAM.
  const context = AlunoTreinoView.loadModal;
  if (context?.form?.isConnected && document.getElementById('form-carga-aluno') === context.form) {
    Object.values(context.fields || {}).forEach(field => { field.value = ''; });
    if (context.feedback) context.feedback.textContent = '';
    if (context.review) context.review.innerHTML = '';
  }
  AlunoTreinoView.loadDrafts.forEach(record => { record.draft = { weight: '', reps: '', notes: '' }; record.notice = ''; record.reviewed = false; });
  AlunoTreinoView.loadDrafts.clear(); AlunoTreinoView.loadScope = null; AlunoTreinoView.loadModal = null;
  AlunoCheckinView.checkinRecord = null; AlunoCheckinView.checkinContext = null; AlunoCheckinView.posting = false;
  for (const view of [AlunoPainelView, AlunoTreinoView, AlunoHistoricoView, AlunoMensalidadeView, AlunoCheckinView]) view.sequence = (view.sequence || 0) + 1;
});
