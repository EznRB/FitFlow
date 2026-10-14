const RelatoriosView = {
  container: null,
  requestVersion: 0,
  generation: 0,
  resultConfirmed: false,
  pendingReport: null,
  invalidar() { this.generation++; this.requestVersion++; this.container = null; this.resultConfirmed = false; this.pendingReport = null; },
  contexto() {
    const user = typeof Auth === 'undefined' ? null : Auth.user;
    return { generation: this.generation, container: document.getElementById('relatorios-container'),
      userId: user?.id, role: user?.role, authGeneration: typeof Auth === 'undefined' ? null : Auth.generation,
      epoch: typeof Auth !== 'undefined' && typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null };
  },
  atual(context) {
    return context && context.generation === this.generation && context.container && context.container.isConnected !== false
      && document.getElementById('relatorios-container') === context.container
      && (typeof App === 'undefined' || App.currentPage === 'relatorios')
      && (typeof Auth === 'undefined' || (Auth.user?.id === context.userId && context.role === 'admin' && Auth.user?.role === context.role
        && Auth.generation === context.authGeneration
        && (typeof Auth.getSessionEpoch !== 'function' || (Auth.sessionEpoch === context.epoch && Auth.getSessionEpoch() === context.epoch))));
  },
  escape(value) { return FitFlowSecurity.escapeHtml(value ?? '—'); },
  number(value) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  },
  count(value) { const number = this.number(value); return Number.isSafeInteger(number) ? String(number) : '—'; },
  formatMoney(value) {
    const valid = typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value));
    const number = valid ? Number(value) : NaN;
    return !Number.isFinite(number) ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
  },
  validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  formatDate(value, civil = true) {
    if (typeof value !== 'string' || !value) return '—';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', { timeZone: civil ? 'UTC' : 'America/Sao_Paulo' }) : '—';
  },
  formatTime(value) {
    if (typeof value !== 'string') return '—';
    if (/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return value.slice(0, 5);
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—';
  },
  getStatusBadge(status) {
    const statuses = { active: ['success', 'Ativo'], inactive: ['warning', 'Inativo'], blocked: ['danger', 'Bloqueado'], paid: ['success', 'Pago'], pending: ['warning', 'Pendente'], overdue: ['danger', 'Vencido'], present: ['success', 'Presente'], cancelled: ['danger', 'Cancelado'], correction: ['warning', 'Correção'], refund_recorded: ['warning', 'Devolução informada'] };
    const entry = Object.hasOwn(statuses, status) ? statuses[status] : null;
    return entry ? `<span class="badge badge-${entry[0]}">${entry[1]}</span>` : `<span class="badge">${this.escape(status)}</span>`;
  },
  async inicializar() {
    this.invalidar();
    this.container = document.getElementById('relatorios-container');
    if (!this.container) return;
    const context = this.contexto();
    if (!this.atual(context)) return;
    this.renderizarEstrutura();
    this.bindEvents(context);
    await this.carregarRelatorio('inadimplencia');
  },
  renderizarEstrutura() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = name => parts.find(item => item.type === name).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    const start = new Date(today + 'T00:00:00Z');
    start.setUTCDate(start.getUTCDate() - 29);
    this.container.innerHTML = `
      <div class="page-header admin-page-header reports-heading">
        <div><span class="workspace-kicker">Análise / acompanhamento</span><h2>Relatórios gerenciais</h2><p>Consulte presença, situação dos alunos e registros financeiros.</p></div>
        <button type="button" id="btn-imprimir-relatorio" class="btn btn-outline-primary no-print" disabled>Imprimir relatório</button>
      </div>
      <section class="reports-controls no-print" aria-label="Configurar relatório">
        <div class="reports-filters">
          <div><label for="filtro-tipo-relatorio" class="form-label">Relatório</label><select id="filtro-tipo-relatorio" class="form-select">
            <option value="inadimplencia">Inadimplência</option><option value="frequencia">Frequência por aluno</option>
            <option value="checkins">Check-ins por período</option><option value="pagamentos">Pagamentos por período</option><option value="alunos">Situação dos alunos</option>
          </select></div>
          <div><label for="filtro-data-inicio" class="form-label">Data inicial</label><input type="date" id="filtro-data-inicio" class="form-control" value="${start.toISOString().slice(0, 10)}"></div>
          <div><label for="filtro-data-fim" class="form-label">Data final</label><input type="date" id="filtro-data-fim" class="form-control" value="${today}"></div>
          <button type="button" id="btn-gerar-relatorio" class="btn btn-primary">Atualizar relatório</button>
        </div>
        <p id="aviso-filtro-data" class="reports-filter-note">Inadimplência e situação dos alunos mostram a situação atual, sem filtro de datas.</p>
      </section>
      <p id="relatorio-periodo-aplicado" class="reports-applied" style="display:none"></p>
      <section id="relatorio-resumo" aria-label="Resumo do relatório" style="display:none"></section>
      <div class="reports-ledger">
        <div id="relatorio-loading" class="reports-state" role="status" style="display:none">Carregando relatório…</div>
        <div id="relatorio-empty" class="reports-state" role="status" style="display:none">Nenhum registro encontrado. Ajuste o período ou escolha outro relatório.</div>
        <div id="relatorio-error" class="reports-state" role="alert" style="display:none"></div>
        <div id="relatorio-content" role="region" aria-label="Resultados do relatório; deslize para ver todas as colunas" tabindex="0" style="display:none;overflow-x:auto">
          <table class="table reports-table"><caption id="relatorio-titulo-tabela">Resultados</caption><thead id="relatorio-thead"></thead><tbody id="relatorio-tbody"></tbody></table>
        </div>
      </div>
      <style>@media print{.no-print,.sidebar,.topbar{display:none!important}.main-content{margin-left:0!important;padding:0!important}.card{box-shadow:none!important;border:none!important}#relatorios-container{color:#000}}</style>`;
  },
  bindEvents(context = this.contexto()) {
    document.getElementById('btn-gerar-relatorio').onclick = () => { if (this.atual(context)) return this.carregarRelatorio(document.getElementById('filtro-tipo-relatorio').value); };
    document.getElementById('filtro-tipo-relatorio').onchange = event => { if (this.atual(context)) return this.carregarRelatorio(event.target.value); };
    document.getElementById('btn-imprimir-relatorio').onclick = () => { if (this.atual(context) && this.resultConfirmed) window.print(); };
  },
  state(name) {
    for (const id of ['loading', 'empty', 'content', 'error']) document.getElementById('relatorio-' + id).style.display = id === name ? 'block' : 'none';
    if (name === 'loading' || name === 'error') {
      this.resultConfirmed = false;
      document.getElementById('relatorio-resumo').style.display = 'none';
      document.getElementById('relatorio-periodo-aplicado').style.display = 'none';
    }
    document.getElementById('btn-imprimir-relatorio').disabled = !this.resultConfirmed;
    document.getElementById('relatorios-container').setAttribute('aria-busy', name === 'loading' ? 'true' : 'false');
    document.getElementById('relatorios-container').setAttribute('data-result-confirmed', this.resultConfirmed ? 'true' : 'false');
  },
  mostrarLoading() { this.state('loading'); },
  mostrarVazio() { this.state('empty'); },
  mostrarTabela() { this.state('content'); },
  renderizarResumo(cards, financial = null) {
    const element = document.getElementById('relatorio-resumo');
    if (financial) {
      const item = (label, value) => `<div><dt>${this.escape(label)}</dt><dd>${this.escape(this.formatMoney(value))}</dd></div>`;
      element.innerHTML = `<div class="reports-financial">
        <div class="reports-net"><span class="reports-eyebrow">Resultado do período</span><h3>Líquido registrado</h3><strong>${this.escape(this.formatMoney(financial.totalReceita))}</strong><p>Recebimentos e ajustes registrados, sem confirmação bancária.</p></div>
        <div class="reports-breakdown"><h3>Composição do registro</h3><dl>${item('Recebimentos brutos', financial.totalBruto)}${item('Correções internas', financial.totalCorrecoes)}${item('Devoluções informadas', financial.totalDevolucoesInformadas)}</dl></div>
        <div class="reports-due"><h3>Valores no período</h3><dl>${item('Pendentes', financial.totalPendente)}${item('Vencidos', financial.totalVencido)}</dl></div>
      </div><div class="reports-review"><div><span class="reports-eyebrow">Situação atual · independente do período</span><h3>Conferência de checkout</h3><p>Consultas aguardando verificação do provedor; não são recebimentos confirmados.</p></div><strong>${this.escape(this.count(financial.conferenciasProvedor))}</strong></div>`;
      element.style.display = 'block';
      return;
    }
    element.innerHTML = `<dl class="reports-summary">${(cards || []).map(([label, value]) => `<div><dt>${this.escape(label)}</dt><dd>${this.escape(value)}</dd></div>`).join('')}</dl>`;
    element.style.display = cards?.length ? 'block' : 'none';
  },
  table(title, columns, rows, cards = [], financial = null) {
    if (!Array.isArray(rows)) throw new Error('Formato inesperado do relatório.');
    document.getElementById('relatorio-titulo-tabela').textContent = title;
    this.renderizarResumo(cards, financial);
    // O intervalo pertence à consulta confirmada, não aos filtros editados durante a espera.
    const report = this.pendingReport;
    const applied = document.getElementById('relatorio-periodo-aplicado');
    applied.textContent = report?.dated ? `${title} · Período aplicado: ${this.formatDate(report.start)} a ${this.formatDate(report.end)}` : `${title} · Situação atual · consulta confirmada`;
    applied.style.display = 'block';
    this.resultConfirmed = true;
    if (!rows.length) {
      document.getElementById('relatorio-thead').innerHTML = '';
      document.getElementById('relatorio-tbody').innerHTML = '';
      document.getElementById('relatorio-empty').textContent = financial ? 'Nenhuma movimentação registrada neste período. A conferência de checkout acima mostra a situação atual.' : 'Nenhum registro encontrado. Escolha outro relatório ou, quando disponível, ajuste o período.';
      this.mostrarVazio(); return;
    }
    document.getElementById('relatorio-thead').innerHTML = '<tr>' + columns.map(column => `<th scope="col" style="padding:.75rem">${this.escape(column[0])}</th>`).join('') + '</tr>';
    document.getElementById('relatorio-tbody').innerHTML = rows.map((row, index) => '<tr>' + columns.map(column => `<td style="padding:.75rem">${column[2] === 'badge' ? this.getStatusBadge(column[1](row, index)) : this.escape(column[1](row, index))}</td>`).join('') + '</tr>').join('');
    this.mostrarTabela();
  },
  async carregarRelatorio(type) {
    const context = this.contexto();
    if (!this.atual(context)) return;
    const version = ++this.requestVersion;
    const methods = { inadimplencia: 'carregarInadimplencia', frequencia: 'carregarFrequencia', checkins: 'carregarCheckins', pagamentos: 'carregarPagamentos', alunos: 'carregarAlunos' };
    if (!Object.hasOwn(methods, type)) return;
    const dated = !['inadimplencia', 'alunos'].includes(type);
    const notice = document.getElementById('aviso-filtro-data');
    notice.style.display = !dated || type === 'pagamentos' ? 'block' : 'none';
    notice.textContent = type === 'pagamentos'
      ? 'Recebimentos por data de pagamento; ajustes por data efetiva. Líquido registrado, sem confirmação bancária.'
      : 'Inadimplência e situação dos alunos mostram a situação atual, sem filtro de datas.';
    const start = document.getElementById('filtro-data-inicio'), end = document.getElementById('filtro-data-fim');
    start.disabled = end.disabled = !dated;
    this.mostrarLoading();
    try {
      if (dated && (!this.validDate(start.value) || !this.validDate(end.value) || start.value > end.value)) throw new Error('Informe um período válido; a data inicial deve anteceder ou coincidir com a final.');
      this.pendingReport = { type, dated, start: start.value, end: end.value };
      const query = dated ? '?' + new URLSearchParams({ startDate: this.pendingReport.start, endDate: this.pendingReport.end }) : '';
      await this[methods[type]](query, version, context);
    } catch (error) {
      if (version !== this.requestVersion || !this.atual(context)) return;
      this.state('error');
      document.getElementById('relatorio-error').textContent = error.message || 'Não foi possível carregar o relatório. Tente atualizar.';
    }
  },
  async carregarInadimplencia(query = '', version = this.requestVersion, context = this.contexto()) {
    if (!this.atual(context)) return;
    const { data } = await API.get('/relatorios/inadimplencia', { timeoutMs: 15000 });
    if (version !== this.requestVersion || !this.atual(context)) return;
    if (!Array.isArray(data)) throw new Error('Formato inesperado do relatório.');
    const amounts = data.map(row => this.number(row.totalAtraso));
    const total = amounts.some(value => value === null) ? null : amounts.reduce((sum, value) => sum + value, 0);
    this.table('Inadimplência atual', [['Aluno', r => r.nome], ['E-mail', r => r.email], ['Plano', r => r.plano || 'Sem plano'], ['Situação', r => r.status, 'badge'], ['Registros vencidos', r => this.count(r.mensalidadesAtrasadas)], ['Total devido', r => this.formatMoney(r.totalAtraso)]], data, [['Alunos com atraso', data.length], ['Total devido', this.formatMoney(total)]]);
  },
  async carregarFrequencia(query = '', version = this.requestVersion, context = this.contexto()) {
    if (!this.atual(context)) return;
    const { data } = await API.get('/relatorios/frequencia' + query, { timeoutMs: 15000 });
    if (version !== this.requestVersion || !this.atual(context)) return;
    this.table('Presenças por aluno no período', [['Aluno', r => r.nome], ['Plano', r => r.plano || 'Sem plano'], ['Situação', r => r.statusAluno, 'badge'], ['Presenças', r => this.count(r.totalCheckins)]], data);
  },
  async carregarCheckins(query = '', version = this.requestVersion, context = this.contexto()) {
    if (!this.atual(context)) return;
    const { data } = await API.get('/relatorios/checkins' + query, { timeoutMs: 15000 });
    if (version !== this.requestVersion || !this.atual(context)) return;
    this.table('Check-ins no período', [['Data', r => this.formatDate(r.data)], ['Horário (São Paulo)', r => this.formatTime(r.hora)], ['Aluno', r => r.aluno], ['Situação', r => r.status, 'badge']], data?.items, [['Registros no período', this.count(data?.total)]]);
  },
  async carregarPagamentos(query = '', version = this.requestVersion, context = this.contexto()) {
    if (!this.atual(context)) return;
    const { data } = await API.get('/relatorios/financeiro' + query, { timeoutMs: 15000 });
    if (version !== this.requestVersion || !this.atual(context)) return;
    this.table('Movimentações registradas no período', [['Data efetiva', r => this.formatDate(r.dataPagamento)], ['Aluno', r => r.aluno], ['Recibo', r => '#' + r.paymentId], ['Situação', r => r.status, 'badge'], ['Valor', r => this.formatMoney(r.valor)], ['Motivo / responsável', r => r.tipo === 'recebimento' ? 'Recebimento original' : (r.motivo || '') + ' · ' + (r.responsavel || '')]], data?.items,
      [], data?.resumo || {});
    document.getElementById('aviso-filtro-data').textContent = data?.resumo?.criterio || 'Recebimentos e ajustes pela data efetiva; valores registrados, sem confirmação bancária.';
  },
  async carregarAlunos(query = '', version = this.requestVersion, context = this.contexto()) {
    if (!this.atual(context)) return;
    const { data } = await API.get('/relatorios/alunos', { timeoutMs: 15000 });
    if (version !== this.requestVersion || !this.atual(context)) return;
    this.table('Situação atual dos alunos', [['Matrícula', r => this.formatDate(r.dataMatricula, false)], ['Aluno', r => r.nome], ['E-mail', r => r.email], ['Plano', r => r.plano], ['Situação', r => r.status, 'badge']], data?.items, [['Ativos', this.count(data?.resumo?.ativos)], ['Bloqueados', this.count(data?.resumo?.bloqueados)], ['Inativos', this.count(data?.resumo?.inativos)]]);
  }
};
if (typeof window.addEventListener === 'function') {
  window.addEventListener('auth:logout', () => RelatoriosView.invalidar());
  window.addEventListener('navigate', event => { if (event.detail?.page !== 'relatorios') RelatoriosView.invalidar(); });
}
