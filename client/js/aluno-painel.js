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
  capture(view, container) {
    const sequence = view.sequence = (view.sequence || 0) + 1;
    const userId = Auth.user?.id;
    const generation = Auth.generation;
    return () => Boolean(userId && Auth.user?.id === userId && Auth.generation === generation && view.sequence === sequence && container.isConnected && document.getElementById(container.id) === container);
  },
  async load(view, id, label, fetch, render) {
    const container = document.getElementById(id);
    if (!container || !Auth.user?.id) return;
    container.classList.add('ff-student');
    const current = this.capture(view, container);
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
  inicializar() { return AlunoUI.load(this, 'aluno-painel-container', 'Carregando seu painel…', async () => (await API.get('/aluno/painel')).data, (container, data) => { this.dados = data; this.renderizar(container); }); },
  renderizar(container) {
    const d = this.dados;
    const dias = d.mensalidade.diasRestantes;
    const restante = dias == null ? '—' : dias <= 0 ? 'Vencida' : `${AlunoUI.number(dias)} dias`;
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
  saving: false,
  inicializar() { return AlunoUI.load(this, 'aluno-treino-container', 'Carregando suas fichas…', async () => (await API.get('/aluno/painel')).data, (container, data) => { this.dados = data; this.bloqueado = data.perfil.status !== 'active'; this.renderizar(container); }); },
  renderizar(container) {
    const d = this.dados;
    container.innerHTML = AlunoUI.heading('Orientação do instrutor', 'Suas fichas de treino', 'Consulte a prescrição. Para acompanhar cada série e seu volume, use Sessões e séries.') +
      (this.bloqueado ? AlunoUI.blocked('Matrícula indisponível para novos registros. Consulte a administração.') : '') +
      (d.treinos.length ? `<div class="ff-student-toolbar"><button type="button" class="btn btn-primary" data-action="sessions">Abrir sessões e séries</button></div>` + d.treinos.map(t => `<section class="aluno-treino-card"><header class="aluno-treino-header"><div><h3>${AlunoUI.escape(t.nome)}</h3>${t.descricao ? `<p>${AlunoUI.escape(t.descricao)}</p>` : ''}</div><div class="treino-meta">${AlunoUI.escape(t.instrutor)}<br>Ficha de ${AlunoUI.date(t.criadoEm)}</div></header><div class="aluno-treino-body">${t.exercicios.map((ex, i) => this._renderExercicio(ex, i)).join('')}</div></section>`).join('') : AlunoUI.empty('Nenhuma ficha disponível', 'Se sua matrícula estiver ativa, peça ao instrutor para cadastrar uma ficha.'));
    AlunoUI.bind(container, { sessions: () => App.navigateTo('sessoes'), load: button => this.abrirRegistroCarga(Number(button.dataset.exerciseId), button.dataset.exerciseName) });
  },
  _renderExercicio(ex, idx) {
    const ultima = ex.ultimaCarga ? `${AlunoUI.number(ex.ultimaCarga.peso)} kg${ex.ultimaCarga.reps != null ? ` × ${AlunoUI.number(ex.ultimaCarga.reps)} reps` : ''}` : 'Sem registro avulso';
    const descanso = ex.descansoSegundos == null ? 'Não informado' : `${AlunoUI.number(ex.descansoSegundos)} s`;
    return `<article class="aluno-exercicio"><div class="aluno-exercicio-top"><div class="aluno-exercicio-nome"><span class="aluno-exercicio-numero">${idx + 1}</span><h4>${AlunoUI.escape(ex.nome)}</h4></div><button type="button" class="btn btn-secondary ff-student-small" data-action="load" data-exercise-id="${Number(ex.id)}" data-exercise-name="${AlunoUI.escape(ex.nome)}" ${this.bloqueado ? 'disabled' : ''}>Registro avulso</button></div><dl class="ff-student-prescription"><div><dt>Séries e repetições prescritas</dt><dd>${AlunoUI.escape(ex.series)} × ${AlunoUI.escape(ex.reps)}</dd></div><div><dt>Descanso prescrito</dt><dd>${descanso}</dd></div><div><dt>Carga orientada</dt><dd>${AlunoUI.escape(ex.cargaSugerida || 'Não informada')}</dd></div><div><dt>Último registro avulso</dt><dd>${ultima}</dd></div></dl>${ex.grupoMuscular ? `<p class="ff-student-detail">Grupo cadastrado: ${AlunoUI.escape(ex.grupoMuscular)}</p>` : ''}${ex.notas ? `<p class="aluno-exercicio-notas">${AlunoUI.escape(ex.notas)}</p>` : ''}</article>`;
  },
  abrirRegistroCarga(exerciseId, nome) {
    if (this.bloqueado || Auth.user?.role !== 'student') return;
    const container = document.getElementById('aluno-treino-container');
    if (!container) return;
    this.modalCurrent = AlunoUI.capture(this, container);
    const html = `<form id="form-carga-aluno" class="ff-student-load-form"><p>Registro avulso do histórico anterior. Ele não representa automaticamente uma sessão completa. Para registrar séries, abra Sessões e séries.</p><div class="form-group"><label for="aluno-carga-peso">Carga externa (kg)</label><input type="number" id="aluno-carga-peso" step="0.01" min="0" max="9999.99" required><small>Informe 0 quando não houver carga externa.</small></div><div class="form-group"><label for="aluno-carga-reps">Repetições realizadas (opcional)</label><input type="number" id="aluno-carga-reps" min="1" max="1000" step="1"></div><div class="form-group"><label for="aluno-carga-obs">Observação (opcional)</label><input type="text" id="aluno-carga-obs" maxlength="10000"></div><p id="aluno-carga-feedback" role="status"></p></form>`;
    Modal.open(`Registro avulso: ${nome}`, html, [{ text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() }, { text: 'Salvar registro', class: 'btn-primary', action: () => this.salvarCarga(exerciseId) }]);
  },
  async salvarCarga(exerciseId) {
    if (this.saving || !this.modalCurrent?.()) return;
    const form = document.getElementById('form-carga-aluno');
    if (!form?.reportValidity()) return;
    const weight = document.getElementById('aluno-carga-peso').value;
    const reps = document.getElementById('aluno-carga-reps').value;
    const notes = document.getElementById('aluno-carga-obs').value.trim();
    const feedback = document.getElementById('aluno-carga-feedback');
    const current = this.modalCurrent;
    this.saving = true;
    feedback.textContent = 'Salvando registro…';
    try {
      await API.post('/treinos/carga', { exerciseId, weight: Number(weight), repsCompleted: reps === '' ? null : Number(reps), notes: notes || null });
      if (!current() || document.getElementById('form-carga-aluno') !== form) return;
      Modal.close();
      Toast.success('Registro avulso salvo.');
      await this.inicializar();
    } catch (error) {
      if (current() && document.getElementById('form-carga-aluno') === form) feedback.textContent = error.message || 'Não foi possível salvar. Tente novamente.';
    } finally { this.saving = false; }
  }
};

const AlunoHistoricoView = {
  inicializar() { return AlunoUI.load(this, 'aluno-historico-container', 'Carregando registros avulsos…', async () => (await API.get('/aluno/historico-carga')).data, (container, data) => this.renderizar(container, data)); },
  renderizar(container, grupos) {
    container.innerHTML = AlunoUI.heading('Histórico anterior', 'Registros avulsos de carga', 'Até 100 registros mais recentes retornados pela API. Estes registros não incluem as séries salvas em Sessões e séries.') + (!grupos?.length ? AlunoUI.empty('Nenhum registro avulso', 'Sua evolução por sessão está disponível na página Evolução.') : grupos.map(g => {
      const summary = FitFlowScience.summarizeLogs(g.registros);
      return `<section class="ff-student-section"><h3>${AlunoUI.escape(g.exercicioNome)}</h3>${g.grupoMuscular ? `<p class="ff-student-detail">${AlunoUI.escape(g.grupoMuscular)}</p>` : ''}<ul class="ff-student-records">${g.registros.slice(0, 8).map(r => `<li><span>${AlunoUI.number(r.peso)} kg${r.reps != null ? ` × ${AlunoUI.number(r.reps)} reps` : ' · repetições não informadas'}</span><time>${AlunoUI.date(r.data)}</time></li>`).join('')}</ul><p class="science-note">Volume conhecido dos registros retornados: ${AlunoUI.number(summary.knownVolumeKg)} kg·repetições · ${summary.completeRecords} completos · ${summary.incompleteRecords} incompletos. Carga × repetições não mede hipertrofia; compare o mesmo exercício e equipamento.</p></section>`;
    }).join(''));
    AlunoUI.icons(container);
  }
};

const AlunoMensalidadeView = {
  inicializar() { return AlunoUI.load(this, 'aluno-mensalidade-container', 'Carregando sua mensalidade…', async () => (await API.get('/aluno/mensalidade')).data, (container, data) => this.renderizar(container, data)); },
  renderizar(container, dados) {
    const statuses = { em_dia: 'Em dia', vencendo: 'Vencimento próximo', vencido: 'Vencida', bloqueado: 'Matrícula bloqueada', indefinido: 'Vigência não informada' };
    const label = Object.hasOwn(statuses, dados.statusVisual) ? statuses[dados.statusVisual] : 'Situação não informada';
    const dias = dados.diasRestantes == null ? 'Não informado' : dados.diasRestantes <= 0 ? 'Vencida' : `${AlunoUI.number(dados.diasRestantes)} dias`;
    const methods = { cash: 'Dinheiro', pix: 'Pix', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', transfer: 'Transferência', card: 'Cartão', dinheiro: 'Dinheiro', cartao: 'Cartão', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito', boleto: 'Boleto', transferencia: 'Transferência', simulado: 'Simulado' };
    const history = dados.historicoPagamentos || [];
    container.innerHTML = AlunoUI.heading('Sua matrícula', 'Plano e mensalidade', 'Consulte a vigência e os pagamentos registrados pela academia.') + (dados.statusAluno === 'blocked' ? AlunoUI.blocked('Matrícula bloqueada. Consulte a administração para regularização.') : '') + `<section class="ff-student-section"><div class="ff-student-section-top"><h3>Plano atual</h3><span class="ff-student-status">${label}</span></div><dl class="ff-student-prescription"><div><dt>Plano</dt><dd>${AlunoUI.escape(dados.plano?.nome || 'Não vinculado')}</dd></div><div><dt>Valor do plano</dt><dd>${dados.plano ? AlunoUI.money(dados.plano.preco) : '—'}</dd></div><div><dt>Fim da vigência</dt><dd>${AlunoUI.date(dados.vencimento, undefined, true)}</dd></div><div><dt>Tempo restante</dt><dd>${dias}</dd></div></dl><div class="ff-student-payment-action"><button type="button" class="btn btn-primary" data-action="checkout"><i data-lucide="credit-card" aria-hidden="true"></i>Consultar renovação</button><p>O checkout deste projeto usa o ambiente de testes. Um retorno do navegador não confirma pagamento: a situação é conciliada no servidor.</p></div></section><section class="ff-student-section"><h3>Últimos pagamentos registrados</h3>${history.length ? `<ul class="ff-student-records ff-student-payments">${history.map(p => { const status = p.status === 'paid' ? 'Pago' : p.status === 'overdue' ? 'Em atraso' : 'Pendente'; return `<li><div><strong>${AlunoUI.money(p.valor)}</strong><span>${AlunoUI.escape(p.plano || 'Plano não informado')} · ${AlunoUI.escape(Object.hasOwn(methods, p.metodo) ? methods[p.metodo] : p.metodo || 'Método não informado')}</span></div><div><span>${status}</span><time>${AlunoUI.date(p.dataPagamento)}</time></div></li>`; }).join('')}</ul>` : AlunoUI.empty('Nenhum pagamento registrado', 'A administração pode orientar sobre a situação da matrícula.')}</section>`;
    AlunoUI.bind(container, { checkout: () => this.abrirCheckout() });
  },
  abrirCheckout() { if (typeof MercadoPagoCheckout !== 'undefined') return MercadoPagoCheckout.abrir(); Toast.error('Checkout indisponível. Consulte a administração.'); }
};

const AlunoCheckinView = {
  studentId: null,
  bloqueado: false,
  posting: false,
  inicializar() { return AlunoUI.load(this, 'aluno-checkin-container', 'Carregando suas presenças…', async current => {
    const painel = (await API.get('/aluno/painel')).data;
    if (!current()) return null;
    const checkins = (await API.get('/aluno/checkins?limit=15')).data;
    return { painel, checkins };
  }, (container, data) => { this.studentId = data.painel.perfil.id; this.bloqueado = data.painel.perfil.status !== 'active'; this.renderizar(container, data.checkins); }); },
  renderizar(container, dados) {
    this.container = container;
    container.innerHTML = AlunoUI.heading('Entrada na academia', 'Sua presença', 'Registre sua entrada ao chegar. Presença e sessão de treino são registros diferentes.') + (this.bloqueado ? AlunoUI.blocked('Matrícula indisponível para registrar presença. Consulte a administração.') : '') + `<section class="ff-student-start"><div><span class="ff-student-stat-label">Presenças confirmadas neste mês</span><strong class="ff-student-count">${AlunoUI.number(dados.totalMes)}</strong></div><button type="button" class="btn btn-primary" id="btn-aluno-checkin" data-action="checkin" ${this.bloqueado ? 'disabled' : ''}><i data-lucide="calendar-check" aria-hidden="true"></i>Registrar entrada de hoje</button><p id="checkin-feedback" class="ff-student-feedback" role="status" aria-live="polite"></p></section><section class="ff-student-section"><h3>Últimas 15 presenças e cancelamentos</h3>${dados.checkins?.length ? `<ul class="ff-student-records">${dados.checkins.map(c => `<li><span>${c.status === 'cancelled' ? 'Presença cancelada' : c.status === 'present' ? 'Presença registrada' : 'Situação não informada'}</span><time>${AlunoUI.date(c.data, undefined, true)}</time></li>`).join('')}</ul>` : AlunoUI.empty('Nenhuma presença registrada', 'Use o botão acima para registrar sua entrada de hoje.')}</section>`;
    AlunoUI.bind(container, { checkin: () => this.fazerCheckin() });
  },
  async fazerCheckin() {
    if (this.posting || this.bloqueado || !this.container?.isConnected) return;
    const container = this.container;
    const userId = Auth.user?.id;
    const generation = Auth.generation;
    const current = AlunoUI.capture(this, container);
    if (!current()) return;
    const button = container.querySelector('#btn-aluno-checkin');
    const feedback = container.querySelector('#checkin-feedback');
    if (!button || !feedback) return;
    this.posting = true;
    button.disabled = true;
    button.textContent = 'Registrando entrada…';
    feedback.textContent = '';
    try {
      await API.post('/checkins', {});
      if (!current()) return;
      await this.inicializar();
      if (document.getElementById(container.id) === container && Auth.user?.id === userId && Auth.generation === generation && container.isConnected && this.container === container) {
        const updated = container.querySelector('#checkin-feedback');
        if (updated) updated.textContent = 'Entrada de hoje registrada. Se já existia, a presença foi mantida sem duplicação.';
      }
    } catch (error) {
      if (!current()) return;
      feedback.textContent = error.message || 'Não foi possível registrar sua entrada. Tente novamente.';
      button.textContent = 'Tentar registrar entrada';
      button.disabled = error.status === 409;
    } finally { this.posting = false; }
  }
};
