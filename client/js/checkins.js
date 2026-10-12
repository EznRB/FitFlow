/** Presença diária e cancelamento administrativo com histórico preservado. */
const CheckinsView = {
  dados: [], alunos: [], filtroAtual: { studentId: '', startDate: '', endDate: '' }, listaRequest: 0,
  generation: 0, kpiRequest: 0, kpiPending: null, alunosRequest: 0, rankingRequest: 0, rankingPending: null, activeForm: null, alunosContext: null, alunosEstado: 'loading',
  invalidar() {
    this.generation++; this.listaRequest++; this.kpiRequest++; this.alunosRequest++; this.rankingRequest++;
    this.dados = []; this.alunos = []; this.alunosContext = null; this.activeForm = null; this.rankingPending = null; this.kpiPending = null;
  },
  contexto(role = 'admin') {
    const user = typeof Auth === 'undefined' ? null : Auth.user;
    const anchorId = role === 'student' ? 'checkins-aluno-container' : 'checkins-table-body';
    return { generation: this.generation, anchorId, anchor: document.getElementById(anchorId), role,
      userId: user?.id, authGeneration: typeof Auth === 'undefined' ? null : Auth.generation,
      epoch: typeof Auth === 'undefined' ? null : Auth.sessionEpoch };
  },
  atual(context) {
    return context && context.generation === this.generation && context.anchor && context.anchor.isConnected !== false
      && document.getElementById(context.anchorId) === context.anchor && (typeof App === 'undefined' || App.currentPage === 'checkins')
      && (typeof Auth === 'undefined' || (Auth.user?.id === context.userId && Auth.user?.role === context.role
        && Auth.generation === context.authGeneration && Auth.sessionEpoch === context.epoch
        && (typeof Auth.getSessionEpoch !== 'function' || Auth.getSessionEpoch() === context.epoch)));
  },
  formularioAtual(context) {
    return context && this.activeForm === context && this.atual(context.scope) && context.revision === Modal.revision
      && context.form && context.form.isConnected !== false && document.getElementById(context.formId) === context.form
      && document.getElementById(context.fieldId) === context.field && (typeof Modal.isOpen !== 'function' || Modal.isOpen());
  },
  escapar(value) { return FitFlowSecurity.escapeHtml(value); },
  idValido(value) { return Number.isSafeInteger(value) && value > 0 && value <= 2147483647; },
  icones(node) { if (window.lucide) window.lucide.createIcons({ nodes: [node] }); },
  async inicializar() {
    this.invalidar(); this.alunosEstado = 'loading';
    this.filtroAtual = { studentId: '', startDate: document.getElementById('filtro-data-inicio')?.value || '', endDate: document.getElementById('filtro-data-fim')?.value || '' };
    const user = Auth.user || Auth.getLocalUser(); this.isAdmin = user?.role === 'admin';
    if (this.isAdmin) { const context = this.contexto(); if (!this.atual(context)) return; this.configurarEventos(context); await Promise.all([this.carregarKPIs(), this.carregarLista(), this.carregarAlunos()]); }
    else if (user?.role === 'student') await this.renderVisaoAluno();
  },
  async carregarKPIs() {
    const context = this.contexto();
    if (!this.atual(context)) return;
    const total = document.getElementById('kpi-checkins-total'), last = document.getElementById('kpi-ultimo-checkin');
    const button = document.getElementById('btn-atualizar-presencas');
    const pending = this.kpiPending;
    if (pending && this.atual(pending.scope) && pending.total === total && pending.last === last && pending.button === button) return;
    const request = ++this.kpiRequest, operation = { scope: context, total, last, button };
    this.kpiPending = operation; button?.setAttribute('aria-busy', 'true');
    const current = () => this.atual(context) && request === this.kpiRequest
      && document.getElementById('kpi-checkins-total') === total && document.getElementById('kpi-ultimo-checkin') === last;
    try {
      const summary = (await API.get('/checkins/hoje', { timeoutMs: 15000 })).data;
      if (!current()) return;
      if (total) total.textContent = summary.totalHoje ?? 0;
      if (last) last.textContent = summary.checkins?.length ? `${summary.checkins[0].alunoNome} às ${summary.checkins[0].horario}` : 'Nenhum registro';
    } catch (error) {
      if (!current()) return;
      if (total) total.textContent = '—'; if (last) last.textContent = 'Resumo indisponível. Use Atualizar resumo.';
    } finally {
      if (this.kpiPending === operation) this.kpiPending = null;
      if (current() && document.getElementById('btn-atualizar-presencas') === button) button?.removeAttribute('aria-busy');
    }
  },
  async carregarAlunos() {
    const context = this.contexto(), request = ++this.alunosRequest;
    if (!this.atual(context)) return;
    this.alunosEstado = 'loading'; this.atualizarAlunosFormulario();
    try {
      const response = await API.get('/alunos', { timeoutMs: 15000 });
      if (!this.atual(context) || request !== this.alunosRequest) return;
      this.alunos = Array.isArray(response.data) ? response.data : []; this.alunosContext = context; this.alunosEstado = 'ready'; this.popularFiltroAluno(context); this.atualizarAlunosFormulario();
    } catch (error) {
      if (!this.atual(context) || request !== this.alunosRequest) return;
      this.alunos = []; this.alunosContext = null; this.alunosEstado = 'error'; this.atualizarAlunosFormulario();
      const select = document.getElementById('filtro-aluno-checkin'); if (select) select.innerHTML = '<option value="">Todos os alunos · seleção indisponível</option>';
    }
  },
  popularFiltroAluno(context = this.contexto()) {
    if (!this.atual(context)) return;
    const old = document.getElementById('filtro-aluno-checkin'); if (!old) return;
    const select = old.tagName === 'SELECT' ? old : document.createElement('select');
    select.id = old.id; select.className = 'form-select'; select.style.maxWidth = '100%'; select.setAttribute('aria-label', 'Filtrar presença por aluno');
    select.innerHTML = '<option value="">Todos os alunos</option>' + this.alunos.filter(a => this.idValido(a.id)).map(a =>
      `<option value="${a.id}">${this.escapar(a.user?.name || 'Aluno')} · #${a.id}</option>`).join('');
    if (select !== old) old.replaceWith(select);
    select.value = String(this.filtroAtual.studentId);
    select.onchange = () => { if (!this.atual(context) || document.getElementById(select.id) !== select) return; this.filtroAtual.studentId = select.value; this.carregarLista(); };
  },
  async carregarLista() {
    const context = this.contexto(); if (!this.atual(context)) return;
    const tbody = document.getElementById('checkins-table-body'); if (!tbody) return;
    const request = ++this.listaRequest;
    const { studentId, startDate, endDate } = this.filtroAtual;
    if (startDate && endDate && startDate > endDate) {
      this.dados = []; tbody.onclick = null;
      tbody.innerHTML = '<tr><td colspan="5"><div class="management-list-state" role="alert"><h3>Período inválido</h3><p>A data inicial deve preceder a data final. Corrija as datas acima para consultar presenças.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="5" role="status">Carregando presenças…</td></tr>';
    try {
      const params = new URLSearchParams({ incluirCancelados: 'true' });
      if (studentId) params.set('studentId', studentId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const response = await API.get(`/checkins?${params}`, { timeoutMs: 15000 });
      if (!this.atual(context) || request !== this.listaRequest || document.getElementById('checkins-table-body') !== tbody) return;
      this.dados = response.data || [];
      tbody.innerHTML = this.dados.length ? this.dados.map(record => {
        const name = record.student?.user?.name || 'Aluno não informado';
        const action = record.status === 'present' && this.idValido(record.id) ?
          `<button type="button" class="btn-icon" data-cancel-id="${record.id}" title="Cancelar presença" aria-label="Cancelar presença de ${this.escapar(name)}"><i data-lucide="x-circle"></i></button>` :
          record.status === 'cancelled' ? `<details><summary>Motivo do cancelamento</summary><p>${this.escapar(record.cancelReason || 'Não informado')}</p></details>` : '—';
        return `<tr><td><strong>${this.escapar(name)}</strong><p>${this.escapar(record.student?.user?.email)}</p></td>
          <td>${this.formatarData(record.checkinDate)}</td><td>${this.formatarHorario(record.createdAt)}</td>
          <td>${this.renderBadgeStatus(record.status)}</td><td>${action}</td></tr>`;
      }).join('') : '<tr><td colspan="5"><div class="management-list-state" role="status"><h3>Nenhuma presença neste filtro</h3><p>Consulte outro período ou registre uma presença de hoje.</p></div></td></tr>';
      tbody.onclick = event => {
        if (!this.atual(context) || request !== this.listaRequest || document.getElementById('checkins-table-body') !== tbody) return;
        const button = event.target.closest('[data-cancel-id]'); if (!button || !tbody.contains(button)) return;
        const record = this.dados.find(item => item.id === Number(button.dataset.cancelId));
        if (record) this.abrirModalCancelar(record.id, record.student?.user?.name || 'Aluno');
      };
      this.icones(tbody);
    } catch (error) {
      if (!this.atual(context) || request !== this.listaRequest || document.getElementById('checkins-table-body') !== tbody) return;
      this.dados = []; tbody.innerHTML = `<tr><td colspan="5"><div class="management-list-state" role="alert"><h3>Não foi possível carregar presenças</h3><p>${this.escapar(error.message || 'Confira a conexão e tente novamente.')}</p><button type="button" class="btn btn-secondary" data-checkin-retry>Tentar novamente</button></div></td></tr>`;
      tbody.onclick = event => {
        if (!this.atual(context) || request !== this.listaRequest || document.getElementById('checkins-table-body') !== tbody) return;
        const button = event.target?.closest?.('[data-checkin-retry]'); if (!button || !tbody.contains(button)) return;
        button.disabled = true; this.carregarKPIs(); return this.carregarLista();
      };
    }
  },
  configurarEventos(context = this.contexto()) {
    const register = document.getElementById('btn-registrar-checkin'), ranking = document.getElementById('btn-ver-ranking');
    const refresh = document.getElementById('btn-atualizar-presencas');
    if (register) register.onclick = () => { if (this.atual(context) && document.getElementById('btn-registrar-checkin') === register) this.abrirModalRegistro(); };
    if (ranking) ranking.onclick = () => { if (this.atual(context) && document.getElementById('btn-ver-ranking') === ranking) return this.abrirModalRanking(); };
    if (refresh) refresh.onclick = () => { if (this.atual(context) && document.getElementById('btn-atualizar-presencas') === refresh) return this.carregarKPIs(); };
    ['filtro-data-inicio', 'filtro-data-fim'].forEach((id, index) => {
      const input = document.getElementById(id); if (!input) return;
      input.setAttribute('aria-label', index === 0 ? 'Data inicial das presenças' : 'Data final das presenças');
      input.onchange = () => { if (!this.atual(context) || document.getElementById(id) !== input) return; this.filtroAtual[index === 0 ? 'startDate' : 'endDate'] = input.value; this.carregarLista(); };
    });
  },
  abrirModalRegistro() {
    const scope = this.contexto(); if (!this.atual(scope)) return;
    let context;
    Modal.open('Registrar presença', `<form id="form-checkin"><div class="form-group"><label for="input-checkin-aluno">Aluno com matrícula ativa</label>
      <select id="input-checkin-aluno" required><option value="">Selecionar aluno</option></select></div>
      <p id="checkin-form-feedback" role="status" aria-live="polite"></p><button type="button" id="checkin-form-retry" class="btn btn-secondary" hidden>Tentar carregar alunos novamente</button>
      <p>A data e o horário serão registrados pelo sistema. Há um registro diário por aluno, inclusive se o registro anterior foi cancelado.</p><button type="submit" hidden tabindex="-1" aria-hidden="true">Confirmar presença</button></form>`, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { if (this.formularioAtual(context)) Modal.close(); } },
      { text: 'Confirmar presença', class: 'btn-success', action: () => this.submeterCheckin(context) }]);
    context = this.capturarFormulario(scope, 'form-checkin', 'input-checkin-aluno', '.btn-success');
    context.form.onsubmit = event => { event.preventDefault(); return this.submeterCheckin(context); };
    const retry = document.getElementById('checkin-form-retry');
    if (retry) retry.onclick = () => { if (this.formularioAtual(context) && !context.pending && this.alunosEstado !== 'loading') return this.carregarAlunos(); };
    this.atualizarAlunosFormulario();
  },
  capturarFormulario(scope, formId, fieldId, buttonClass) {
    const context = { scope, formId, fieldId, form: document.getElementById(formId), field: document.getElementById(fieldId),
      revision: Modal.revision, button: Modal.footerEl?.querySelector(buttonClass) || document.querySelector?.(`#modal-footer ${buttonClass}`), pending: false };
    this.activeForm = context; return context;
  },
  atualizarAlunosFormulario() {
    const context = this.activeForm;
    if (!this.formularioAtual(context) || context.formId !== 'form-checkin' || context.pending) return;
    const field = context.field, previous = field.value;
    const eligible = (typeof Auth === 'undefined' || this.atual(this.alunosContext))
      ? this.alunos.filter(a => a.status === 'active' && a.user?.active !== false && this.idValido(a.id)) : [];
    const loading = this.alunosEstado === 'loading', error = this.alunosEstado === 'error';
    field.innerHTML = `<option value="">${loading ? 'Carregando alunos…' : error ? 'Seleção indisponível' : 'Selecionar aluno'}</option>`
      + eligible.map(a => `<option value="${a.id}">${this.escapar(a.user?.name || 'Aluno')} · #${a.id}</option>`).join('');
    field.value = eligible.some(a => String(a.id) === previous) ? previous : ''; field.disabled = loading || error || !eligible.length;
    if (context.button) context.button.disabled = field.disabled;
    const feedback = context.form.querySelector?.('#checkin-form-feedback'), retry = context.form.querySelector?.('#checkin-form-retry');
    if (feedback) feedback.textContent = loading ? 'Consultando alunos com matrícula ativa…' : error ? 'Não foi possível carregar os alunos. Tente novamente para selecionar uma matrícula.' : eligible.length ? '' : 'Nenhum aluno com matrícula ativa disponível para registrar presença.';
    if (retry) retry.hidden = !error;
  },
  async submeterCheckin(context = this.activeForm) {
    if (!this.formularioAtual(context) || context.formId !== 'form-checkin' || context.pending || context.field.disabled) return;
    if (context.form.reportValidity && !context.form.reportValidity()) return;
    const raw = context.field.value;
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || !this.idValido(Number(raw))) { Toast.warning('Selecione um aluno válido.'); return; }
    return this.enviarFormulario(context, '/checkins', { studentId: Number(raw) }, false, raw);
  },
  async enviarFormulario(context, url, payload, cancellation, submittedValue) {
    context.pending = true; if (context.button) context.button.disabled = true;
    try {
      if (cancellation) await API.put(url, payload, { timeoutMs: 15000 }); else await API.post(url, payload, { timeoutMs: 15000 });
      if (!this.formularioAtual(context)) return;
      const unchanged = context.field.value === submittedValue;
      Toast.success(cancellation ? 'Registro cancelado e preservado.' : 'Presença registrada.');
      if (unchanged) Modal.close();
      else { const feedback = context.form.querySelector?.(cancellation ? '#checkin-cancel-feedback' : '#checkin-form-feedback'); if (feedback) feedback.textContent = 'O envio anterior foi confirmado. As alterações seguintes continuam neste formulário, sem novo envio.'; }
      await Promise.all([this.carregarKPIs(), this.carregarLista()]);
    } catch (error) {
      if (!this.formularioAtual(context)) return;
      const uncertain = error.timeout || !error.status || error.status >= 500;
      const message = uncertain ? 'O resultado não foi confirmado. Confira o histórico antes de tentar registrar novamente; o servidor pode ter concluído a operação.' : error.message || 'Não foi possível concluir o registro.';
      const feedback = context.form.querySelector?.(cancellation ? '#checkin-cancel-feedback' : '#checkin-form-feedback'); if (feedback) feedback.textContent = message;
      Toast.error(message);
    } finally { context.pending = false; if (this.formularioAtual(context) && context.button) context.button.disabled = false; }
  },
  abrirModalCancelar(id, name) {
    const scope = this.contexto(); if (!this.idValido(id) || !this.atual(scope)) return;
    let context;
    Modal.open('Cancelar presença', `<form id="form-cancel-checkin"><p>Cancelar o registro de <strong>${this.escapar(name)}</strong> preserva o histórico e registra o motivo e o administrador responsável.</p>
      <div class="form-group"><label for="input-cancel-motivo">Motivo do cancelamento</label><textarea id="input-cancel-motivo" rows="3" minlength="5" maxlength="255" required aria-describedby="cancel-checkin-help"></textarea>
      <small id="cancel-checkin-help">Informe de 5 a 255 caracteres.</small></div><p id="checkin-cancel-feedback" role="status" aria-live="polite"></p><button type="submit" hidden tabindex="-1" aria-hidden="true">Confirmar cancelamento</button></form>`, [
      { text: 'Voltar', class: 'btn-secondary', action: () => { if (this.formularioAtual(context)) Modal.close(); } },
      { text: 'Confirmar cancelamento', class: 'btn-danger', action: () => this.submeterCancelamento(id, context) }]);
    context = this.capturarFormulario(scope, 'form-cancel-checkin', 'input-cancel-motivo', '.btn-danger'); context.checkinId = id;
    context.form.onsubmit = event => { event.preventDefault(); return this.submeterCancelamento(id, context); };
  },
  async submeterCancelamento(id, context = this.activeForm) {
    if (!this.formularioAtual(context) || context.formId !== 'form-cancel-checkin' || context.checkinId !== id || context.pending) return;
    if (context.form.reportValidity && !context.form.reportValidity()) return;
    const raw = context.field.value, reason = raw?.trim();
    if (!this.idValido(id) || !reason || reason.length < 5 || reason.length > 255) { Toast.warning('Informe um motivo de 5 a 255 caracteres.'); return; }
    return this.enviarFormulario(context, `/checkins/${id}/cancelar`, { motivo: reason }, true, raw);
  },
  async abrirModalRanking() {
    const scope = this.contexto(); if (!this.atual(scope)) return;
    if (this.rankingPending && this.atual(this.rankingPending.scope) && this.rankingPending.revision === Modal.revision) return;
    const context = { scope, revision: Modal.revision, request: ++this.rankingRequest, button: document.getElementById('btn-ver-ranking') };
    this.rankingPending = context; context.button?.setAttribute('aria-busy', 'true');
    const current = () => this.atual(scope) && context.request === this.rankingRequest && context.revision === Modal.revision
      && document.getElementById('btn-ver-ranking') === context.button;
    let shownRevision;
    try {
      const response = await API.get('/checkins/frequencia?dias=30', { timeoutMs: 15000 });
      if (!current()) return;
      const ranking = Array.isArray(response.data) ? response.data : [];
      const counts = ranking.map(item => typeof item.totalCheckins === 'number' ||
        (typeof item.totalCheckins === 'string' && /^\d+$/.test(item.totalCheckins)) ? Number(item.totalCheckins) : NaN);
      const max = Math.max(0, ...counts.filter(n => Number.isSafeInteger(n) && n >= 0));
      const rows = ranking.map((item, index) => {
        const count = counts[index], valid = Number.isSafeInteger(count) && count >= 0;
        const width = valid && max > 0 ? Math.max(0, Math.min(100, count / max * 100)) : 0;
        return `<li style="margin-bottom:1rem;overflow-wrap:anywhere"><strong>${this.escapar(item.nome)}</strong> · ${valid ? count : 'não informado'} registros
          <div aria-hidden="true" style="height:6px;margin-top:.3rem;background:var(--bg-elevated);border-radius:4px"><div style="width:${width}%;height:100%;background:var(--primary-500);border-radius:4px"></div></div></li>`;
      }).join('');
      Modal.open('Frequência nos últimos 30 dias', ranking.length ? `<p>Contagem de registros de presença; não mede execução ou qualidade de treino.</p><ol style="padding-left:1.5rem">${rows}</ol>` : '<p>Nenhum registro de presença no período.</p>',
        [{ text: 'Fechar', class: 'btn-secondary', action: () => { if (this.atual(scope) && Modal.revision === shownRevision) Modal.close(); } }]);
      shownRevision = Modal.revision;
    } catch (error) { if (current()) Toast.error(error.message || 'Erro ao carregar frequência.'); }
    finally {
      if (this.rankingPending === context) this.rankingPending = null;
      if (this.atual(scope) && context.request === this.rankingRequest && document.getElementById('btn-ver-ranking') === context.button) context.button?.removeAttribute('aria-busy');
    }
  },
  async renderVisaoAluno() {
    const scope = this.contexto('student'); if (!this.atual(scope)) return;
    const container = document.getElementById('checkins-aluno-container'); if (!container) return;
    container.innerHTML = '<section class="card"><h3>Presença de hoje</h3><p>A presença é registrada quando você confirma abaixo.</p><button id="btn-self-checkin" type="button" class="btn btn-primary">Registrar presença hoje</button><p id="self-checkin-feedback" role="status" aria-live="polite"></p></section>';
    const button = container.querySelector('#btn-self-checkin'), feedback = container.querySelector('#self-checkin-feedback');
    let pending = false;
    const current = () => this.atual(scope) && document.getElementById('checkins-aluno-container') === container
      && container.querySelector('#btn-self-checkin') === button && container.querySelector('#self-checkin-feedback') === feedback;
    button.onclick = async () => {
      if (!current() || pending || button.disabled) return;
      pending = true;
      button.disabled = true;
      try { await API.post('/checkins', {}, { timeoutMs: 15000 }); if (!current()) return; feedback.textContent = 'Presença registrada hoje.'; button.textContent = 'Presença registrada'; }
      catch (error) {
        if (!current()) return;
        feedback.textContent = error.status === 409 ? `Já existe um registro para hoje. ${error.message || ''}`
          : error.timeout || !error.status || error.status >= 500 ? 'O resultado não foi confirmado. Confira o histórico antes de tentar registrar novamente.' : error.message || 'Não foi possível registrar presença.';
        button.disabled = error.status === 409;
      } finally { pending = false; }
    };
  },
  formatarData(value) {
    if (typeof value !== 'string') return '—';
    const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
  },
  formatarHorario(value) {
    if (typeof value !== 'string') return '—';
    const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—';
  },
  renderBadgeStatus(status) {
    const known = { present: '<span class="badge badge-success">Presente</span>', cancelled: '<span class="badge badge-error">Cancelado</span>' };
    return Object.hasOwn(known, status) ? known[status] : `<span class="badge badge-neutral">${this.escapar(status || 'Não informado')}</span>`;
  },
};
if (typeof window.addEventListener === 'function') {
  window.addEventListener('auth:logout', () => CheckinsView.invalidar());
  window.addEventListener('navigate', event => { if (event.detail?.page !== 'checkins') CheckinsView.invalidar(); });
}
