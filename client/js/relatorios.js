const RelatoriosView = {
  container: null,
  requestVersion: 0,
  escape(value) { return FitFlowSecurity.escapeHtml(value ?? '—'); },
  number(value) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  },
  count(value) { const number = this.number(value); return Number.isSafeInteger(number) ? String(number) : '—'; },
  formatMoney(value) {
    const number = this.number(value);
    return number === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
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
    const statuses = { active: ['success', 'Ativo'], inactive: ['warning', 'Inativo'], blocked: ['danger', 'Bloqueado'], paid: ['success', 'Pago'], pending: ['warning', 'Pendente'], overdue: ['danger', 'Vencido'], present: ['success', 'Presente'], cancelled: ['danger', 'Cancelado'] };
    const entry = Object.hasOwn(statuses, status) ? statuses[status] : null;
    return entry ? `<span class="badge badge-${entry[0]}">${entry[1]}</span>` : `<span class="badge">${this.escape(status)}</span>`;
  },
  async inicializar() {
    this.container = document.getElementById('relatorios-container');
    if (!this.container) return;
    this.renderizarEstrutura();
    this.bindEvents();
    await this.carregarRelatorio('inadimplencia');
  },
  renderizarEstrutura() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = name => parts.find(item => item.type === name).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    const start = new Date(today + 'T00:00:00Z');
    start.setUTCDate(start.getUTCDate() - 29);
    this.container.innerHTML = `
      <div class="page-header" style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
        <div><h2>Relatórios gerenciais</h2><p>Consulte presença, situação dos alunos e registros financeiros.</p></div>
        <button type="button" id="btn-imprimir-relatorio" class="btn btn-outline-primary no-print">Imprimir</button>
      </div>
      <div class="card no-print" style="padding:1.25rem;margin-bottom:1.5rem">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:1rem;align-items:end">
          <div><label for="filtro-tipo-relatorio" class="form-label">Relatório</label><select id="filtro-tipo-relatorio" class="form-select">
            <option value="inadimplencia">Inadimplência</option><option value="frequencia">Frequência por aluno</option>
            <option value="checkins">Check-ins por período</option><option value="pagamentos">Pagamentos por período</option><option value="alunos">Situação dos alunos</option>
          </select></div>
          <div><label for="filtro-data-inicio" class="form-label">Data inicial</label><input type="date" id="filtro-data-inicio" class="form-control" value="${start.toISOString().slice(0, 10)}"></div>
          <div><label for="filtro-data-fim" class="form-label">Data final</label><input type="date" id="filtro-data-fim" class="form-control" value="${today}"></div>
          <button type="button" id="btn-gerar-relatorio" class="btn btn-primary">Atualizar relatório</button>
        </div>
        <p id="aviso-filtro-data" style="margin-top:.75rem">Inadimplência e situação dos alunos mostram a situação atual, sem filtro de datas.</p>
      </div>
      <div id="relatorio-resumo" style="display:none;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:1rem;margin-bottom:1.5rem"></div>
      <div class="card" style="padding:1rem">
        <div id="relatorio-loading" role="status" style="display:none;padding:2rem">Carregando relatório…</div>
        <div id="relatorio-empty" role="status" style="display:none;padding:2rem">Nenhum registro encontrado.</div>
        <div id="relatorio-error" role="alert" style="display:none;padding:2rem"></div>
        <div id="relatorio-content" role="region" aria-label="Resultados do relatório; deslize para ver todas as colunas" tabindex="0" style="display:none;overflow-x:auto">
          <table class="table" style="width:100%;text-align:left"><caption id="relatorio-titulo-tabela" style="text-align:left;font-weight:600;padding-bottom:1rem">Resultados</caption><thead id="relatorio-thead"></thead><tbody id="relatorio-tbody"></tbody></table>
        </div>
      </div>
      <style>@media print{.no-print,.sidebar,.topbar{display:none!important}.main-content{margin-left:0!important;padding:0!important}.card{box-shadow:none!important;border:none!important}#relatorios-container{color:#000}}</style>`;
  },
  bindEvents() {
    document.getElementById('btn-gerar-relatorio').onclick = () => this.carregarRelatorio(document.getElementById('filtro-tipo-relatorio').value);
    document.getElementById('filtro-tipo-relatorio').onchange = event => this.carregarRelatorio(event.target.value);
    document.getElementById('btn-imprimir-relatorio').onclick = () => window.print();
  },
  state(name) {
    for (const id of ['loading', 'empty', 'content', 'error']) document.getElementById('relatorio-' + id).style.display = id === name ? 'block' : 'none';
    if (name !== 'content') document.getElementById('relatorio-resumo').style.display = 'none';
  },
  mostrarLoading() { this.state('loading'); },
  mostrarVazio() { this.state('empty'); },
  mostrarTabela() { this.state('content'); },
  renderizarResumo(cards) {
    const element = document.getElementById('relatorio-resumo');
    element.innerHTML = (cards || []).map(([label, value]) => `<div class="kpi-card"><div class="kpi-content"><div class="kpi-value">${this.escape(value)}</div><div class="kpi-label">${this.escape(label)}</div></div></div>`).join('');
    element.style.display = cards?.length ? 'grid' : 'none';
  },
  table(title, columns, rows, cards = []) {
    if (!Array.isArray(rows)) throw new Error('Formato inesperado do relatório.');
    document.getElementById('relatorio-titulo-tabela').textContent = title;
    if (!rows.length) { this.mostrarVazio(); return; }
    document.getElementById('relatorio-thead').innerHTML = '<tr>' + columns.map(column => `<th scope="col" style="padding:.75rem">${this.escape(column[0])}</th>`).join('') + '</tr>';
    document.getElementById('relatorio-tbody').innerHTML = rows.map((row, index) => '<tr>' + columns.map(column => `<td style="padding:.75rem">${column[2] === 'badge' ? this.getStatusBadge(column[1](row, index)) : this.escape(column[1](row, index))}</td>`).join('') + '</tr>').join('');
    this.renderizarResumo(cards);
    this.mostrarTabela();
  },
  async carregarRelatorio(type) {
    const version = ++this.requestVersion;
    const methods = { inadimplencia: 'carregarInadimplencia', frequencia: 'carregarFrequencia', checkins: 'carregarCheckins', pagamentos: 'carregarPagamentos', alunos: 'carregarAlunos' };
    if (!Object.hasOwn(methods, type)) return;
    const dated = !['inadimplencia', 'alunos'].includes(type);
    document.getElementById('aviso-filtro-data').style.display = dated ? 'none' : 'block';
    const start = document.getElementById('filtro-data-inicio'), end = document.getElementById('filtro-data-fim');
    start.disabled = end.disabled = !dated;
    this.mostrarLoading();
    try {
      if (dated && (!this.validDate(start.value) || !this.validDate(end.value) || start.value > end.value)) throw new Error('Informe um período válido; a data inicial deve anteceder ou coincidir com a final.');
      const query = dated ? '?' + new URLSearchParams({ startDate: start.value, endDate: end.value }) : '';
      await this[methods[type]](query, version);
    } catch (error) {
      if (version !== this.requestVersion) return;
      this.state('error');
      document.getElementById('relatorio-error').textContent = error.message || 'Não foi possível carregar o relatório. Tente atualizar.';
    }
  },
  async carregarInadimplencia(query = '', version = this.requestVersion) {
    const { data } = await API.get('/relatorios/inadimplencia');
    if (version !== this.requestVersion) return;
    if (!Array.isArray(data)) throw new Error('Formato inesperado do relatório.');
    const amounts = data.map(row => this.number(row.totalAtraso));
    const total = amounts.some(value => value === null) ? null : amounts.reduce((sum, value) => sum + value, 0);
    this.table('Inadimplência atual', [['Aluno', r => r.nome], ['E-mail', r => r.email], ['Plano', r => r.plano || 'Sem plano'], ['Situação', r => r.status, 'badge'], ['Registros vencidos', r => this.count(r.mensalidadesAtrasadas)], ['Total devido', r => this.formatMoney(r.totalAtraso)]], data, [['Alunos com atraso', data.length], ['Total devido', this.formatMoney(total)]]);
  },
  async carregarFrequencia(query = '', version = this.requestVersion) {
    const { data } = await API.get('/relatorios/frequencia' + query);
    if (version !== this.requestVersion) return;
    this.table('Presenças por aluno no período', [['Aluno', r => r.nome], ['Plano', r => r.plano || 'Sem plano'], ['Situação', r => r.statusAluno, 'badge'], ['Presenças', r => this.count(r.totalCheckins)]], data);
  },
  async carregarCheckins(query = '', version = this.requestVersion) {
    const { data } = await API.get('/relatorios/checkins' + query);
    if (version !== this.requestVersion) return;
    this.table('Check-ins no período', [['Data', r => this.formatDate(r.data)], ['Horário (São Paulo)', r => this.formatTime(r.hora)], ['Aluno', r => r.aluno], ['Situação', r => r.status, 'badge']], data?.items, [['Registros no período', this.count(data?.total)]]);
  },
  async carregarPagamentos(query = '', version = this.requestVersion) {
    const { data } = await API.get('/relatorios/financeiro' + query);
    if (version !== this.requestVersion) return;
    this.table('Registros financeiros no período', [['Data do pagamento', r => this.formatDate(r.dataPagamento)], ['Aluno', r => r.aluno], ['Plano', r => r.plano], ['Situação', r => r.status, 'badge'], ['Valor', r => this.formatMoney(r.valor)]], data?.items, [['Receita confirmada', this.formatMoney(data?.resumo?.totalReceita)], ['Pendentes', this.formatMoney(data?.resumo?.totalPendente)], ['Vencidos', this.formatMoney(data?.resumo?.totalVencido)]]);
  },
  async carregarAlunos(query = '', version = this.requestVersion) {
    const { data } = await API.get('/relatorios/alunos');
    if (version !== this.requestVersion) return;
    this.table('Situação atual dos alunos', [['Matrícula', r => this.formatDate(r.dataMatricula, false)], ['Aluno', r => r.nome], ['E-mail', r => r.email], ['Plano', r => r.plano], ['Situação', r => r.status, 'badge']], data?.items, [['Ativos', this.count(data?.resumo?.ativos)], ['Bloqueados', this.count(data?.resumo?.bloqueados)], ['Inativos', this.count(data?.resumo?.inativos)]]);
  }
};
