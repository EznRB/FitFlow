/**
 * ============================================================================
 * FitFlow Caraguá — View de Relatórios (Task 12)
 * ============================================================================
 * Exibe as principais métricas e dados analíticos para a gestão da academia.
 */

const RelatoriosView = {
  container: null,

  async inicializar() {
    this.container = document.getElementById('relatorios-container');
    if (!this.container) return;

    this.renderizarEstrutura();
    this.bindEvents();
    
    // Carrega o relatório padrão (Inadimplência)
    this.carregarRelatorio('inadimplencia');
  },

  renderizarEstrutura() {
    const hoje = new Date().toISOString().split('T')[0];
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const dataPadraoInicial = trintaDiasAtras.toISOString().split('T')[0];

    this.container.innerHTML = `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2>Relatórios Gerenciais</h2>
          <p style="color:var(--text-muted)">Visualize métricas de inadimplência, frequência, receitas e alunos ativos.</p>
        </div>
        <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;" class="no-print">
          <button id="btn-imprimir-relatorio" class="btn btn-outline-primary" style="cursor:pointer">
            <i data-lucide="printer"></i>
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      <!-- Barra de Filtros -->
      <div class="card no-print" style="margin-bottom: 1.5rem; padding: 1.5rem;">
        <div style="display:flex; gap:1rem; align-items:flex-end; flex-wrap:wrap;">
          
          <div class="form-group" style="margin:0; flex:1; min-width: 200px;">
            <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0.25rem;">Tipo de Relatório</label>
            <select id="filtro-tipo-relatorio" class="form-select">
              <option value="inadimplencia">Inadimplência</option>
              <option value="frequencia">Frequência por Aluno</option>
              <option value="checkins">Check-ins por Período</option>
              <option value="pagamentos">Pagamentos por Período</option>
              <option value="alunos">Alunos Ativos e Inativos</option>
            </select>
          </div>

          <div class="form-group" style="margin:0; min-width: 150px;">
            <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0.25rem;">Data Início</label>
            <input type="date" id="filtro-data-inicio" class="form-control" value="${dataPadraoInicial}">
          </div>

          <div class="form-group" style="margin:0; min-width: 150px;">
            <label class="form-label" style="font-size: 0.85rem; margin-bottom: 0.25rem;">Data Fim</label>
            <input type="date" id="filtro-data-fim" class="form-control" value="${hoje}">
          </div>

          <button id="btn-gerar-relatorio" class="btn btn-primary" style="margin:0;">
            <i data-lucide="filter"></i>
            <span>Filtrar</span>
          </button>
        </div>
        <p id="aviso-filtro-data" style="color:var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem; display:none;">
          * Filtros de data não se aplicam aos relatórios de "Inadimplência" e "Alunos Ativos e Inativos".
        </p>
      </div>

      <!-- Resumo do Relatório (Cards) -->
      <div id="relatorio-resumo" class="grid-3" style="gap: 1.5rem; margin-bottom: 1.5rem; display:none;">
        <!-- Injetado dinamicamente -->
      </div>

      <!-- Área de Resultados (Tabela) -->
      <div class="card" style="overflow-x:auto;">
        <div id="relatorio-loading" style="text-align:center; padding:3rem 1rem; display:none;">
          <div class="spinner"></div>
          <p style="margin-top:1rem; color:var(--text-muted)">Gerando relatório...</p>
        </div>
        <div id="relatorio-empty" style="text-align:center; padding:3rem 1rem; display:none;">
          <i data-lucide="file-search" style="width:48px; height:48px; color:var(--text-muted); margin-bottom:1rem;"></i>
          <p style="color:var(--text-muted)">Nenhum dado encontrado para o período selecionado.</p>
        </div>
        <div id="relatorio-content" style="display:none;">
          <h3 id="relatorio-titulo-tabela" style="margin-bottom: 1rem; font-size: 1.1rem;" class="print-only-title">Resultados</h3>
          <table class="table" style="width:100%; text-align:left; border-collapse:collapse;">
            <thead id="relatorio-thead">
              <!-- Injetado dinamicamente -->
            </thead>
            <tbody id="relatorio-tbody">
              <!-- Injetado dinamicamente -->
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- CSS especial para impressão -->
      <style>
        @media print {
          .no-print { display: none !important; }
          .sidebar { display: none !important; }
          .topbar { display: none !important; }
          .main-content { margin-left: 0 !important; padding: 0 !important; }
          .card { border: none !important; box-shadow: none !important; }
          body { background: white !important; color: black !important; }
          .print-only-title { display: block !important; }
          .page-header h2 { font-size: 1.5rem; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        }
      </style>
    `;

    if (window.lucide) {
      lucide.createIcons({ nodes: [this.container] });
    }
  },

  bindEvents() {
    const btnGerar = document.getElementById('btn-gerar-relatorio');
    const selectTipo = document.getElementById('filtro-tipo-relatorio');
    const btnImprimir = document.getElementById('btn-imprimir-relatorio');
    const avisoFiltro = document.getElementById('aviso-filtro-data');

    btnGerar.addEventListener('click', () => {
      this.carregarRelatorio(selectTipo.value);
    });

    selectTipo.addEventListener('change', (e) => {
      const tipo = e.target.value;
      if (tipo === 'inadimplencia' || tipo === 'alunos') {
        avisoFiltro.style.display = 'block';
      } else {
        avisoFiltro.style.display = 'none';
      }
      this.carregarRelatorio(tipo);
    });

    btnImprimir.addEventListener('click', () => {
      window.print();
    });
  },

  mostrarLoading() {
    document.getElementById('relatorio-loading').style.display = 'block';
    document.getElementById('relatorio-empty').style.display = 'none';
    document.getElementById('relatorio-content').style.display = 'none';
    document.getElementById('relatorio-resumo').style.display = 'none';
  },

  mostrarVazio() {
    document.getElementById('relatorio-loading').style.display = 'none';
    document.getElementById('relatorio-empty').style.display = 'block';
    document.getElementById('relatorio-content').style.display = 'none';
    document.getElementById('relatorio-resumo').style.display = 'none';
  },

  mostrarTabela() {
    document.getElementById('relatorio-loading').style.display = 'none';
    document.getElementById('relatorio-empty').style.display = 'none';
    document.getElementById('relatorio-content').style.display = 'block';
  },

  renderizarResumo(cardsHtml) {
    const resumoContainer = document.getElementById('relatorio-resumo');
    if (cardsHtml) {
      resumoContainer.innerHTML = cardsHtml;
      resumoContainer.style.display = 'grid';
      if (window.lucide) {
        lucide.createIcons({ nodes: [resumoContainer] });
      }
    } else {
      resumoContainer.style.display = 'none';
    }
  },

  formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  },

  formatDate(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  },

  getStatusBadge(status) {
    const map = {
      active: '<span class="badge badge-success">Ativo</span>',
      inactive: '<span class="badge badge-warning">Inativo</span>',
      blocked: '<span class="badge badge-danger">Bloqueado</span>',
      paid: '<span class="badge badge-success">Pago</span>',
      pending: '<span class="badge badge-warning">Pendente</span>',
      overdue: '<span class="badge badge-danger">Vencido</span>',
      present: '<span class="badge badge-success">Presente</span>',
      cancelled: '<span class="badge badge-danger">Cancelado</span>'
    };
    return map[status] || `<span class="badge">${status}</span>`;
  },

  async carregarRelatorio(tipo) {
    this.mostrarLoading();

    const dataInicio = document.getElementById('filtro-data-inicio').value;
    const dataFim = document.getElementById('filtro-data-fim').value;
    let queryParams = `?startDate=${dataInicio}&endDate=${dataFim}`;

    try {
      if (tipo === 'inadimplencia') {
        await this.carregarInadimplencia();
      } else if (tipo === 'frequencia') {
        await this.carregarFrequencia(queryParams);
      } else if (tipo === 'checkins') {
        await this.carregarCheckins(queryParams);
      } else if (tipo === 'pagamentos') {
        await this.carregarPagamentos(queryParams);
      } else if (tipo === 'alunos') {
        await this.carregarAlunos();
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      Toast.error('Erro ao gerar relatório. Tente novamente.');
      this.mostrarVazio();
    }
  },

  async carregarInadimplencia() {
    const resp = await API.get('/relatorios/inadimplencia');
    const dados = resp.data;

    document.getElementById('relatorio-titulo-tabela').textContent = 'Relatório de Inadimplência';

    if (!dados || dados.length === 0) {
      this.mostrarVazio();
      return;
    }

    const totalDevido = dados.reduce((acc, curr) => acc + curr.totalAtraso, 0);

    const resumo = `
      <div class="kpi-card">
        <div class="kpi-icon red"><i data-lucide="alert-circle"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${dados.length}</div>
          <div class="kpi-label">Alunos Inadimplentes</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon orange"><i data-lucide="dollar-sign"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${this.formatMoney(totalDevido)}</div>
          <div class="kpi-label">Total a Receber</div>
        </div>
      </div>
    `;

    document.getElementById('relatorio-thead').innerHTML = `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <th style="padding:1rem 0.5rem">Aluno / Contato</th>
        <th style="padding:1rem 0.5rem">Plano</th>
        <th style="padding:1rem 0.5rem">Status do Aluno</th>
        <th style="padding:1rem 0.5rem">Mensalidades em Atraso</th>
        <th style="padding:1rem 0.5rem">Total Devido</th>
      </tr>
    `;

    document.getElementById('relatorio-tbody').innerHTML = dados.map(item => `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <td style="padding:1rem 0.5rem">
          <div style="font-weight: 500;">${item.nome}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${item.email || ''}</div>
        </td>
        <td style="padding:1rem 0.5rem">${item.plano || 'Sem plano'}</td>
        <td style="padding:1rem 0.5rem">${this.getStatusBadge(item.status)}</td>
        <td style="padding:1rem 0.5rem">${item.mensalidadesAtrasadas}</td>
        <td style="padding:1rem 0.5rem; font-weight: 600; color: var(--error);">${this.formatMoney(item.totalAtraso)}</td>
      </tr>
    `).join('');

    this.renderizarResumo(resumo);
    this.mostrarTabela();
  },

  async carregarFrequencia(queryParams) {
    const resp = await API.get(`/relatorios/frequencia${queryParams}`);
    const dados = resp.data;

    document.getElementById('relatorio-titulo-tabela').textContent = 'Frequência por Aluno no Período';

    if (!dados || dados.length === 0) {
      this.mostrarVazio();
      return;
    }

    document.getElementById('relatorio-thead').innerHTML = `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <th style="padding:1rem 0.5rem">Ranking</th>
        <th style="padding:1rem 0.5rem">Aluno</th>
        <th style="padding:1rem 0.5rem">Plano</th>
        <th style="padding:1rem 0.5rem">Status</th>
        <th style="padding:1rem 0.5rem; text-align:center;">Total de Check-ins</th>
      </tr>
    `;

    document.getElementById('relatorio-tbody').innerHTML = dados.map((item, index) => `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <td style="padding:1rem 0.5rem">#${index + 1}</td>
        <td style="padding:1rem 0.5rem; font-weight: 500;">${item.nome}</td>
        <td style="padding:1rem 0.5rem">${item.plano || 'Sem plano'}</td>
        <td style="padding:1rem 0.5rem">${this.getStatusBadge(item.statusAluno)}</td>
        <td style="padding:1rem 0.5rem; text-align:center;">
          <span class="badge badge-primary">${item.totalCheckins}</span>
        </td>
      </tr>
    `).join('');

    this.renderizarResumo(null);
    this.mostrarTabela();
  },

  async carregarCheckins(queryParams) {
    const resp = await API.get(`/relatorios/checkins${queryParams}`);
    const dados = resp.data.items;
    const total = resp.data.total;

    document.getElementById('relatorio-titulo-tabela').textContent = 'Check-ins Realizados no Período';

    if (!dados || dados.length === 0) {
      this.mostrarVazio();
      return;
    }

    const resumo = `
      <div class="kpi-card">
        <div class="kpi-icon blue"><i data-lucide="calendar-check"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${total}</div>
          <div class="kpi-label">Total de Presenças</div>
        </div>
      </div>
    `;

    document.getElementById('relatorio-thead').innerHTML = `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <th style="padding:1rem 0.5rem">Data</th>
        <th style="padding:1rem 0.5rem">Horário</th>
        <th style="padding:1rem 0.5rem">Aluno</th>
        <th style="padding:1rem 0.5rem">Status</th>
      </tr>
    `;

    document.getElementById('relatorio-tbody').innerHTML = dados.map(item => {
      const dataStr = item.data ? this.formatDate(item.data) : '—';
      const horaStr = item.hora ? new Date(item.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
      
      return `
        <tr style="border-bottom: 1px solid var(--border-color)">
          <td style="padding:1rem 0.5rem">${dataStr}</td>
          <td style="padding:1rem 0.5rem">${horaStr}</td>
          <td style="padding:1rem 0.5rem; font-weight: 500;">${item.aluno}</td>
          <td style="padding:1rem 0.5rem">${this.getStatusBadge(item.status)}</td>
        </tr>
      `;
    }).join('');

    this.renderizarResumo(resumo);
    this.mostrarTabela();
  },

  async carregarPagamentos(queryParams) {
    const resp = await API.get(`/relatorios/financeiro${queryParams}`);
    const dados = resp.data.items;
    const resumoApi = resp.data.resumo;

    document.getElementById('relatorio-titulo-tabela').textContent = 'Movimentação Financeira no Período';

    if (!dados || dados.length === 0) {
      this.mostrarVazio();
      return;
    }

    const resumo = `
      <div class="kpi-card">
        <div class="kpi-icon green"><i data-lucide="trending-up"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${this.formatMoney(resumoApi.totalReceita)}</div>
          <div class="kpi-label">Receita Confirmada</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon yellow"><i data-lucide="clock"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${this.formatMoney(resumoApi.totalPendente)}</div>
          <div class="kpi-label">Pendentes / A Vencer</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon red"><i data-lucide="alert-circle"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${this.formatMoney(resumoApi.totalVencido)}</div>
          <div class="kpi-label">Atrasados no Período</div>
        </div>
      </div>
    `;

    document.getElementById('relatorio-thead').innerHTML = `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <th style="padding:1rem 0.5rem">Data Pgto</th>
        <th style="padding:1rem 0.5rem">Aluno</th>
        <th style="padding:1rem 0.5rem">Plano</th>
        <th style="padding:1rem 0.5rem">Status</th>
        <th style="padding:1rem 0.5rem">Valor</th>
      </tr>
    `;

    document.getElementById('relatorio-tbody').innerHTML = dados.map(item => `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <td style="padding:1rem 0.5rem">${item.dataPagamento ? this.formatDate(item.dataPagamento) : '—'}</td>
        <td style="padding:1rem 0.5rem; font-weight: 500;">${item.aluno}</td>
        <td style="padding:1rem 0.5rem">${item.plano}</td>
        <td style="padding:1rem 0.5rem">${this.getStatusBadge(item.status)}</td>
        <td style="padding:1rem 0.5rem; font-weight:600;">${this.formatMoney(item.valor)}</td>
      </tr>
    `).join('');

    this.renderizarResumo(resumo);
    this.mostrarTabela();
  },

  async carregarAlunos() {
    const resp = await API.get('/relatorios/alunos');
    const dados = resp.data.items;
    const resumoApi = resp.data.resumo;

    document.getElementById('relatorio-titulo-tabela').textContent = 'Listagem Geral de Alunos';

    if (!dados || dados.length === 0) {
      this.mostrarVazio();
      return;
    }

    const resumo = `
      <div class="kpi-card">
        <div class="kpi-icon green"><i data-lucide="user-check"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${resumoApi.ativos}</div>
          <div class="kpi-label">Alunos Ativos</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon red"><i data-lucide="user-x"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${resumoApi.bloqueados}</div>
          <div class="kpi-label">Alunos Bloqueados</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon yellow"><i data-lucide="user-minus"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${resumoApi.inativos}</div>
          <div class="kpi-label">Alunos Inativos</div>
        </div>
      </div>
    `;

    document.getElementById('relatorio-thead').innerHTML = `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <th style="padding:1rem 0.5rem">Data de Matrícula</th>
        <th style="padding:1rem 0.5rem">Aluno</th>
        <th style="padding:1rem 0.5rem">Email</th>
        <th style="padding:1rem 0.5rem">Plano</th>
        <th style="padding:1rem 0.5rem">Status</th>
      </tr>
    `;

    document.getElementById('relatorio-tbody').innerHTML = dados.map(item => `
      <tr style="border-bottom: 1px solid var(--border-color)">
        <td style="padding:1rem 0.5rem">${this.formatDate(item.dataMatricula)}</td>
        <td style="padding:1rem 0.5rem; font-weight: 500;">${item.nome}</td>
        <td style="padding:1rem 0.5rem">${item.email || '—'}</td>
        <td style="padding:1rem 0.5rem">${item.plano}</td>
        <td style="padding:1rem 0.5rem">${this.getStatusBadge(item.status)}</td>
      </tr>
    `).join('');

    this.renderizarResumo(resumo);
    this.mostrarTabela();
  }
};
