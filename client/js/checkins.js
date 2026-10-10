/** Presença diária e cancelamento administrativo com histórico preservado. */
const CheckinsView = {
  dados: [], alunos: [], filtroAtual: { studentId: '', startDate: '', endDate: '' }, listaRequest: 0,
  escapar(value) { return FitFlowSecurity.escapeHtml(value); },
  idValido(value) { return Number.isSafeInteger(value) && value > 0 && value <= 2147483647; },
  icones(node) { if (window.lucide) window.lucide.createIcons({ nodes: [node] }); },
  async inicializar() {
    this.dados = []; this.alunos = []; this.listaRequest++;
    this.filtroAtual = { studentId: '', startDate: document.getElementById('filtro-data-inicio')?.value || '', endDate: document.getElementById('filtro-data-fim')?.value || '' };
    const user = Auth.user || Auth.getLocalUser(); this.isAdmin = user?.role === 'admin';
    if (this.isAdmin) { await Promise.all([this.carregarKPIs(), this.carregarLista(), this.carregarAlunos()]); this.configurarEventos(); }
    else if (user?.role === 'student') await this.renderVisaoAluno();
  },
  async carregarKPIs() {
    try {
      const summary = (await API.get('/checkins/hoje')).data;
      const total = document.getElementById('kpi-checkins-total'), last = document.getElementById('kpi-ultimo-checkin');
      if (total) total.textContent = summary.totalHoje ?? 0;
      if (last) last.textContent = summary.checkins?.length ? `${summary.checkins[0].alunoNome} às ${summary.checkins[0].horario}` : 'Nenhum registro';
    } catch (error) {
      const total = document.getElementById('kpi-checkins-total'); if (total) total.textContent = '—';
    }
  },
  async carregarAlunos() {
    try { this.alunos = (await API.get('/alunos')).data || []; this.popularFiltroAluno(); }
    catch (error) { this.alunos = []; Toast.warning('Lista de alunos indisponível.'); }
  },
  popularFiltroAluno() {
    const old = document.getElementById('filtro-aluno-checkin'); if (!old) return;
    const select = old.tagName === 'SELECT' ? old : document.createElement('select');
    select.id = old.id; select.className = 'form-select'; select.style.maxWidth = '100%'; select.setAttribute('aria-label', 'Filtrar presença por aluno');
    select.innerHTML = '<option value="">Todos os alunos</option>' + this.alunos.filter(a => this.idValido(a.id)).map(a =>
      `<option value="${a.id}">${this.escapar(a.user?.name || 'Aluno')} · #${a.id}</option>`).join('');
    if (select !== old) old.replaceWith(select);
    select.value = String(this.filtroAtual.studentId);
    select.onchange = () => { this.filtroAtual.studentId = select.value; this.carregarLista(); };
  },
  async carregarLista() {
    const tbody = document.getElementById('checkins-table-body'); if (!tbody) return;
    const request = ++this.listaRequest;
    const { studentId, startDate, endDate } = this.filtroAtual;
    if (startDate && endDate && startDate > endDate) { Toast.warning('A data inicial deve preceder a data final.'); return; }
    tbody.innerHTML = '<tr><td colspan="5" role="status">Carregando presenças…</td></tr>';
    try {
      const params = new URLSearchParams({ incluirCancelados: 'true' });
      if (studentId) params.set('studentId', studentId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const response = await API.get(`/checkins?${params}`);
      if (request !== this.listaRequest) return;
      this.dados = response.data || [];
      tbody.innerHTML = this.dados.length ? this.dados.map(record => {
        const name = record.student?.user?.name || 'Aluno não informado';
        const action = record.status === 'present' && this.idValido(record.id) ?
          `<button type="button" class="btn-icon" data-cancel-id="${record.id}" title="Cancelar presença" aria-label="Cancelar presença de ${this.escapar(name)}"><i data-lucide="x-circle"></i></button>` :
          record.status === 'cancelled' ? `<details><summary>Motivo do cancelamento</summary><p>${this.escapar(record.cancelReason || 'Não informado')}</p></details>` : '—';
        return `<tr><td><strong>${this.escapar(name)}</strong><p>${this.escapar(record.student?.user?.email)}</p></td>
          <td>${this.formatarData(record.checkinDate)}</td><td>${this.formatarHorario(record.createdAt)}</td>
          <td>${this.renderBadgeStatus(record.status)}</td><td>${action}</td></tr>`;
      }).join('') : '<tr><td colspan="5">Nenhuma presença encontrada neste filtro.</td></tr>';
      tbody.onclick = event => {
        const button = event.target.closest('[data-cancel-id]'); if (!button || !tbody.contains(button)) return;
        const record = this.dados.find(item => item.id === Number(button.dataset.cancelId));
        if (record) this.abrirModalCancelar(record.id, record.student?.user?.name || 'Aluno');
      };
      this.icones(tbody);
    } catch (error) {
      if (request !== this.listaRequest) return;
      this.dados = []; tbody.textContent = 'Não foi possível carregar presenças.'; Toast.error(error.message || 'Erro ao carregar presenças.');
    }
  },
  configurarEventos() {
    const register = document.getElementById('btn-registrar-checkin'), ranking = document.getElementById('btn-ver-ranking');
    if (register) register.onclick = () => this.abrirModalRegistro();
    if (ranking) ranking.onclick = () => this.abrirModalRanking();
    ['filtro-data-inicio', 'filtro-data-fim'].forEach((id, index) => {
      const input = document.getElementById(id); if (!input) return;
      input.setAttribute('aria-label', index === 0 ? 'Data inicial das presenças' : 'Data final das presenças');
      input.onchange = () => { this.filtroAtual[index === 0 ? 'startDate' : 'endDate'] = input.value; this.carregarLista(); };
    });
  },
  abrirModalRegistro() {
    const options = this.alunos.filter(a => a.status === 'active' && a.user?.active !== false && this.idValido(a.id)).map(a =>
      `<option value="${a.id}">${this.escapar(a.user?.name || 'Aluno')} · #${a.id}</option>`).join('');
    Modal.open('Registrar presença', `<form id="form-checkin"><div class="form-group"><label for="input-checkin-aluno">Aluno com matrícula ativa</label>
      <select id="input-checkin-aluno" required><option value="">Selecionar aluno</option>${options}</select></div>
      <p>A data e o horário serão registrados pelo sistema. Há um registro diário por aluno, inclusive se o registro anterior foi cancelado.</p></form>`, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Confirmar presença', class: 'btn-success', action: () => this.submeterCheckin() }]);
  },
  async submeterCheckin() {
    if (this.registrando) return;
    const raw = document.getElementById('input-checkin-aluno')?.value;
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || !this.idValido(Number(raw))) { Toast.warning('Selecione um aluno válido.'); return; }
    const form = document.getElementById('form-checkin'), button = document.querySelector('#modal-footer .btn-success');
    this.registrando = true; if (button) button.disabled = true;
    try {
      await API.post('/checkins', { studentId: Number(raw) }); Toast.success('Presença registrada.');
      if (document.getElementById('form-checkin') === form) Modal.close(); await Promise.all([this.carregarKPIs(), this.carregarLista()]);
    } catch (error) { Toast.error(error.message || 'Erro ao registrar presença.'); }
    finally { this.registrando = false; if (button) button.disabled = false; }
  },
  abrirModalCancelar(id, name) {
    if (!this.idValido(id)) return;
    Modal.open('Cancelar presença', `<form id="form-cancel-checkin"><p>Cancelar o registro de <strong>${this.escapar(name)}</strong> preserva o histórico e registra o motivo e o administrador responsável.</p>
      <div class="form-group"><label for="input-cancel-motivo">Motivo do cancelamento</label><textarea id="input-cancel-motivo" rows="3" minlength="5" maxlength="255" required aria-describedby="cancel-checkin-help"></textarea>
      <small id="cancel-checkin-help">Informe de 5 a 255 caracteres.</small></div></form>`, [
      { text: 'Voltar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Confirmar cancelamento', class: 'btn-danger', action: () => this.submeterCancelamento(id) }]);
  },
  async submeterCancelamento(id) {
    if (this.cancelando) return;
    const reason = document.getElementById('input-cancel-motivo')?.value?.trim();
    if (!this.idValido(id) || !reason || reason.length < 5 || reason.length > 255) { Toast.warning('Informe um motivo de 5 a 255 caracteres.'); return; }
    const form = document.getElementById('form-cancel-checkin'), button = document.querySelector('#modal-footer .btn-danger');
    this.cancelando = true; if (button) button.disabled = true;
    try {
      await API.put(`/checkins/${id}/cancelar`, { motivo: reason }); Toast.success('Registro cancelado e preservado.');
      if (document.getElementById('form-cancel-checkin') === form) Modal.close(); await Promise.all([this.carregarKPIs(), this.carregarLista()]);
    } catch (error) { Toast.error(error.message || 'Erro ao cancelar presença.'); }
    finally { this.cancelando = false; if (button) button.disabled = false; }
  },
  async abrirModalRanking() {
    try {
      const ranking = (await API.get('/checkins/frequencia?dias=30')).data || [];
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
        [{ text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() }]);
    } catch (error) { Toast.error(error.message || 'Erro ao carregar frequência.'); }
  },
  async renderVisaoAluno() {
    const container = document.getElementById('checkins-aluno-container'); if (!container) return;
    container.innerHTML = '<section class="card"><h3>Presença de hoje</h3><p>A presença é registrada quando você confirma abaixo.</p><button id="btn-self-checkin" type="button" class="btn btn-primary">Registrar presença hoje</button><p id="self-checkin-feedback" role="status" aria-live="polite"></p></section>';
    const button = container.querySelector('#btn-self-checkin'), feedback = container.querySelector('#self-checkin-feedback');
    button.onclick = async () => {
      button.disabled = true;
      try { await API.post('/checkins', {}); feedback.textContent = 'Presença registrada hoje.'; button.textContent = 'Presença registrada'; }
      catch (error) {
        feedback.textContent = error.status === 409 ? `Já existe um registro para hoje. ${error.message || ''}` : error.message || 'Não foi possível registrar presença.';
        button.disabled = error.status === 409;
      }
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
