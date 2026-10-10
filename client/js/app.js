/**
 * ============================================================================
 * FitFlow Caraguá — Lógica Principal do Frontend (SPA)
 * ============================================================================
 * Este é o "cérebro" da interface do usuário. Ele gerencia como a página se
 * comporta sem recarregar o navegador (Single Page Application - SPA).
 * 
 * Funcionalidades principais:
 * 1. Inicialização de componentes globais (Ícones, Toasts, Modais).
 * 2. Gerenciamento do fluxo de Login vs. Dashboard.
 * 3. Navegação dinâmica entre páginas (SPA-like).
 * 4. Renderização de conteúdo dinâmico (KPIs e Placeholders).
 */

const App = {
  // Mantém rastreio da página que está sendo exibida no momento.
  currentPage: null,
  sessionChecking: true,

  /**
   * Função de Inicialização (Entry Point):
   * É chamada assim que o documento HTML termina de carregar.
   */
  async init() {
    this.setSessionChecking(true);
    // Inicializa os ícones do Lucide. O Lucide substitui as tags <i> por SVGs modernos.
    if (window.lucide) lucide.createIcons();

    // Inicializa componentes de feedback visual comuns em sistemas web.
    Toast.init(); // Responsável por alertas flutuantes no canto da tela.
    Modal.init(); // Responsável por janelas de diálogo sobrepostas.

    // Configura os ouvintes de evento (listeners) para o formulário de login.
    this.setupLoginForm();

    // Configura a ação do botão de logout no cabeçalho.
    document.getElementById('btn-logout').addEventListener('click', async () => {
      if (typeof FitFlowPWA !== 'undefined' && !await FitFlowPWA.beforeLogout(Auth.user?.id)) return;
      await Auth.logout();
    });

    // Escuta eventos de navegação customizados disparados por outros componentes (ex: sidebar).
    window.addEventListener('navigate', (e) => {
      this.navigateTo(e.detail.page);
    });
    window.addEventListener('progressao:legacy', () => {
      if (Auth.user?.role !== 'student') return;
      if (this.currentPage !== 'aluno-historico') return;
      if (typeof ProgressaoView !== 'undefined') ProgressaoView.destroy();
      const content = document.getElementById('page-content');
      content.innerHTML = '<div class="legacy-history-header"><button type="button" class="btn btn-secondary" id="btn-session-progress">Voltar à evolução por sessões</button></div><div id="aluno-historico-container"></div>';
      document.getElementById('btn-session-progress').onclick = () => ProgressaoView.render(content);
      AlunoHistoricoView.inicializar();
    });

    // Quando o usuário desloga, forçamos o retorno imediato à tela de login.
    window.addEventListener('auth:logout', () => {
      this.showLogin();
    });

    // Exibe a data atual formatada de forma amigável no topo do sistema.
    this.updateTopbarDate();

    // O formulário permanece bloqueado até o servidor verificar o cookie.
    // Nenhum dado protegido é mostrado usando apenas o cache local.
    let isLoggedIn = false;
    try {
      isLoggedIn = await Auth.checkAuth();
      if (!isLoggedIn && Auth.sessionCheckError) {
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = Auth.sessionCheckError;
        errorEl.style.display = 'flex';
      }
    } catch {
      const errorEl = document.getElementById('login-error');
      errorEl.textContent = 'Não foi possível verificar sua sessão. Entre novamente para continuar.';
      errorEl.style.display = 'flex';
    } finally {
      this.setSessionChecking(false);
    }
    if (isLoggedIn) {
      this.showApp();
    } else {
      this.showLogin();
    }
  },

  setSessionChecking(pending) {
    this.sessionChecking = pending;
    const form = document.getElementById('login-form');
    form.setAttribute('aria-busy', String(pending));
    for (const id of ['login-email', 'login-password', 'btn-toggle-password', 'btn-login']) {
      document.getElementById(id).disabled = pending;
    }
    document.getElementById('login-session-status').hidden = !pending;
  },

  /**
   * Configuração do Formulário de Login:
   * Gerencia a interação do usuário ao tentar entrar no sistema.
   */
  setupLoginForm() {
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');
    const toggleBtn = document.getElementById('btn-toggle-password');
    const passwordInput = document.getElementById('login-password');

    /**
     * Funcionalidade de "Ver Senha":
     * Melhora a UX (User Experience) permitindo que o usuário valide o que digitou.
     */
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      toggleBtn.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
      
      // Atualiza visualmente o ícone conforme o estado (olho aberto ou fechado).
      const icon = toggleBtn.querySelector('i') || toggleBtn.querySelector('svg');
      if (icon) {
        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.lucide) lucide.createIcons({ nodes: [toggleBtn] });
      }
    });

    /**
     * Envio do Formulário (Submit):
     * Captura os dados, envia para validação e trata success/error.
     */
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); // Impede o recarregamento padrão da página do HTML.
      const btnLogin = document.getElementById('btn-login');
      // Também bloqueia Enter e eventos de submit disparados durante a checagem.
      if (this.sessionChecking || btnLogin.disabled) return;
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-password').value;

      // Limpa alertas de erros anteriores.
      errorEl.style.display = 'none';

      // Feedback Visual: Desabilita o botão e mostra um carregamento (spinner).
      // Isso evita que o usuário clique várias vezes enquanto a requisição ocorre.
      btnLogin.disabled = true;
      btnLogin.innerHTML = '<div class="spinner spinner-sm"></div> <span>Entrando...</span>';

      try {
        // Envia requisição assíncrona para a lógica de autenticação.
        await Auth.login(email, senha);
        Toast.success(`Bem-vindo ao FitFlow, ${Auth.user.name}!`);
        
        // Se sucesso, troca para a tela do sistema e reseta o formulário.
        this.showApp();
        form.reset();
      } catch (error) {
        // Se erro, exibe a mensagem retornada pelo servidor (ou erro genérico).
        errorEl.textContent = error.message || 'Erro ao fazer login.';
        errorEl.style.display = 'flex';
      } finally {
        // Restaura o estado original do botão em qualquer cenário.
        btnLogin.disabled = false;
        btnLogin.innerHTML = '<span>Entrar na conta</span><i data-lucide="arrow-right" aria-hidden="true"></i>';
        if (window.lucide) lucide.createIcons({ nodes: [btnLogin] });
      }
    });
  },

  /**
   * Gerenciamento de Telas (Views):
   * O FitFlow possui duas "grandes telas": Login e Aplicação.
   * Manipulamos o estilo `display` para alternar entre elas instantaneamente.
   */
  showLogin() {
    if (typeof Modal !== 'undefined' && typeof Modal.close === 'function') Modal.close();
    if (typeof SessoesView !== 'undefined') SessoesView.destroy();
    if (typeof ProgressaoView !== 'undefined') ProgressaoView.destroy();
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
  },

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';

    // Recupera dados do usuário logado (armazenados em memória ou localStorage).
    const user = Auth.user || Auth.getLocalUser();
    if (user) {
      document.getElementById('sidebar-user-name').textContent = user.name;
      document.getElementById('sidebar-user-role').textContent = 
        ({ admin: 'Administrador', instructor: 'Instrutor', student: 'Aluno' })[user.role] || '';
    }

    // Inicializa a navegação lateral (sidebar) com permissões baseadas no cargo (role).
    Sidebar.init(user ? user.role : 'student');

    // Determina a página inicial padrão dependendo do tipo de usuário.
    // Admins vão para o Dashboard, Alunos para o Painel do Aluno (TASK 10).
    const defaultPage = user?.role === 'student' ? 'aluno-painel' : user?.role === 'instructor' ? 'treinos' : 'dashboard';
    this.navigateTo(defaultPage);
    if (typeof MercadoPagoCheckout !== 'undefined' && user?.role === 'student') MercadoPagoCheckout.verificarRetorno();
  },

  /**
   * Navegação Interna (SPA):
   * Muda o conteúdo central da tela sem trocar de URL/recarregar.
   */
  navigateTo(page) {
    const menus = { admin: Sidebar.adminMenu, instructor: Sidebar.instructorMenu, student: Sidebar.alunoMenu };
    if (!(menus[Auth.user?.role] || []).some(item => item.page === page)) return;
    if (this.currentPage === 'sessoes' && page !== 'sessoes') SessoesView.destroy();
    if (this.currentPage === 'aluno-historico' && page !== 'aluno-historico') ProgressaoView.destroy();
    this.currentPage = page;
    Sidebar.setActive(page); // Marca o item correspondente na sidebar como "ativo".

    // Mapeamento técnico de Nomes Amigáveis para os títulos das páginas.
    const titles = {
      'dashboard':          'Dashboard Geral',
      'alunos':             'Gestão de Alunos',
      'planos':             'Planos de Academia',
      'exercicios':         'Catálogo de Exercícios',
      'treinos':            'Fichas de Treino',
      'pagamentos':         'Fluxo de Pagamentos',
      'checkins':           'Registro de Presença',
      'relatorios':         'Relatórios Gerenciais',
      'meu-treino':         'Meu Treino do Dia',
      'nutricao':           'Nutrição e Macros',
      'sessoes':            'Sessões e séries',
      'evidencias':         'Fundamentos do Treinamento',
      // TASK 10 — Área do Aluno
      'aluno-painel':       'Meu Painel',
      'aluno-treino':       'Meu Treino',
      'aluno-historico':    'Evolução de Cargas',
      'aluno-mensalidade':  'Mensalidade',
      'aluno-checkin':      'Check-in',
    };

    document.getElementById('page-title').textContent = titles[page] || page;

    // Chama a função que troca o HTML central da página.
    this.renderPage(page);
    // Uma nova página começa pelo cabeçalho, incluindo navegação em telas pequenas.
    const main = document.querySelector('.main-content');
    if (main) main.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  /**
   * Renderiza a estrutura da página e inicializa seu módulo de dados.
   * Sessões, progressão e conteúdo educativo possuem renderizadores próprios.
   */
  renderPage(page) {
    const content = document.getElementById('page-content');
    if (page === 'aluno-historico') {
      if (typeof DashboardView !== 'undefined') DashboardView.destroyChart();
      ProgressaoView.render(content);
      return;
    }
    if (page === 'sessoes') {
      if (typeof DashboardView !== 'undefined') DashboardView.destroyChart();
      SessoesView.render(content);
      return;
    }

    // Módulos educativos não dependem de indicadores gerenciais ou de prescrição por IA.
    if (page === 'nutricao' || page === 'evidencias') {
      if (typeof DashboardView !== 'undefined') DashboardView.destroyChart();
      if (page === 'nutricao') NutricaoView.render(content);
      else EvidenciasView.render(content);
      return;
    }

    // Mapeamento de HTML para cada "View".
    const pageTemplates = {
      dashboard: `
        <div class="premium-dashboard">
          
          <div class="dashboard-header">
            <h2 class="dashboard-header-title">Dashboard</h2>
          </div>
          
          <!-- KPI Grid -->
          <div class="kpi-grid">
            <!-- Alunos Ativos -->
            <button type="button" class="premium-kpi-card" data-dashboard-page="alunos">
              <div class="kpi-card-header">
                <div class="kpi-icon-wrapper">
                  <i data-lucide="users"></i>
                </div>
              </div>
              <div class="kpi-card-body">
                <span class="kpi-card-label">Alunos Ativos</span>
                <span class="kpi-card-value" id="kpi-alunos-ativos">—</span>
              </div>
            </button>

            <!-- Receita efetivamente recebida no mês -->
            <button type="button" class="premium-kpi-card" data-dashboard-page="pagamentos">
              <div class="kpi-card-header">
                <div class="kpi-icon-wrapper success">
                  <i data-lucide="credit-card"></i>
                </div>
              </div>
              <div class="kpi-card-body">
                <span class="kpi-card-label">Recebido no mês</span>
                <span class="kpi-card-value" id="kpi-receita-estimada">—</span>
              </div>
            </button>

            <!-- Proporção de matrículas ativas no total atual -->
            <div class="premium-kpi-card">
              <div class="kpi-card-header">
                <div class="kpi-icon-wrapper" style="background: rgba(59, 130, 246, 0.1); color: #60a5fa;">
                  <i data-lucide="bar-chart-3"></i>
                </div>
              </div>
              <div class="kpi-card-body">
                <span class="kpi-card-label">Matrículas ativas (%)</span>
                <span class="kpi-card-value" id="kpi-taxa-retencao">—</span>
              </div>
            </div>

            <!-- Treinos Realizados (Check-ins Hoje) -->
            <button type="button" class="premium-kpi-card" data-dashboard-page="checkins">
              <div class="kpi-card-header">
                <div class="kpi-icon-wrapper" style="background: rgba(245, 158, 11, 0.1); color: #fbbf24;">
                  <i data-lucide="activity"></i>
                </div>
              </div>
              <div class="kpi-card-body">
                <span class="kpi-card-label">Check-ins Hoje</span>
                <span class="kpi-card-value" id="kpi-checkins-hoje">—</span>
              </div>
            </button>
          </div>

          <!-- Layout Principal (Gráfico + Sidebar) -->
          <div class="dashboard-layout-grid">

            <!-- Gráfico de Crescimento -->
            <div class="premium-chart-card">
              <div class="card-header">
                <div class="card-title-group">
                  <h3>Frequência registrada</h3>
                  <p>Check-ins válidos por dia · últimos 7 dias</p>
                </div>
              </div>
              <div class="chart-content" style="flex: 1; min-height: 350px; position: relative;">
                <canvas id="tendencias-chart"></canvas>
              </div>
            </div>

            <!-- Sidebar de Check-ins -->
            <div class="premium-sidebar-card">
              <div class="card-header" style="margin-bottom: var(--space-4);">
                <div class="card-title-group">
                  <h3>Atividade recente</h3>
                  <p>Presenças e matrículas registradas</p>
                </div>
              </div>
              <div class="sidebar-activity-list" id="atividades-list">
                <div style="text-align:center; padding: 2rem 0;"><div class="spinner"></div></div>
              </div>
            </div>

          </div>

          <!-- Linha Inferior (Pagamentos Recentes) -->
          <div class="premium-chart-card">
              <div class="card-header">
                <div class="card-title-group">
                  <h3>Pagamentos Recentes</h3>
                  <p>Últimas transações confirmadas no sistema</p>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" data-dashboard-page="pagamentos">Ver todos</button>
              </div>
              <div class="pagamentos-grid" id="pagamentos-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
                <div style="text-align:center; padding: 2rem 0;"><div class="spinner"></div></div>
              </div>
          </div>

        </div>
      `,
      alunos: `
        <div class="page-header admin-page-header">
          <div>
            <h2>Gestão de Alunos</h2>
            <p style="color:var(--text-muted)">Cadastre, inative ou atualize o perfil dos clientes da academia.</p>
          </div>
          <div class="admin-page-actions">
            <div class="form-group input-with-icon admin-search-field">
              <i data-lucide="search" class="input-icon"></i>
              <input type="search" id="filtro-nome-aluno" aria-label="Buscar aluno por nome" placeholder="Buscar aluno..." />
            </div>
            <button id="btn-novo-aluno" class="btn btn-primary">
              <i data-lucide="user-plus"></i>
              <span>Nova Matrícula</span>
            </button>
          </div>
        </div>

        <div class="card admin-table-scroll" role="region" aria-label="Lista de alunos; deslize para ver todas as colunas" tabindex="0">
          <table class="table" style="width:100%; text-align:left; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border)">
                <th style="padding:1rem 0.5rem">Aluno / E-mail</th>
                <th style="padding:1rem 0.5rem">CPF</th>
                <th style="padding:1rem 0.5rem">Plano Atual</th>
                <th style="padding:1rem 0.5rem">Status</th>
                <th style="padding:1rem 0.5rem">Ações</th>
              </tr>
            </thead>
            <tbody id="alunos-table-body">
              <!-- Renderizado dinamicamente por AlunosView -->
            </tbody>
          </table>
        </div>
      `,
      planos: `
        <div class="page-header admin-page-header">
          <div>
            <h2>Planos de Academia</h2>
            <p style="color:var(--text-muted)">Crie ou atualize os planos de assinatura disponíveis para os alunos.</p>
          </div>
          <button id="btn-novo-plano" class="btn btn-primary">
            <i data-lucide="tag"></i>
            <span>Novo Plano</span>
          </button>
        </div>

        <div class="grid-3 admin-card-grid" id="planos-grid" style="gap: 1.5rem;">
          <!-- Renderizado dinamicamente por PlanosView -->
        </div>
      `,

      /**
       * TASK 06 — Página do Catálogo de Exercícios (Admin)
       * Tabela com filtro por grupo muscular e CRUD completo.
       */
      exercicios: `
        <div class="page-header admin-page-header">
          <div>
            <h2>Catálogo de Exercícios</h2>
            <p style="color:var(--text-muted)">Gerencie os exercícios disponíveis para montar fichas de treino.</p>
          </div>
          <div class="admin-page-actions">
            <select id="filtro-grupo-muscular" class="form-select" aria-label="Filtrar por grupo muscular">
              <option value="">Todos os grupos</option>
            </select>
            <button id="btn-sync-wger" class="btn btn-outline-primary" style="cursor:pointer" title="Sincronizar exercícios via API">
              <i data-lucide="refresh-cw"></i>
              <span>API Sync</span>
            </button>
            <button id="btn-novo-exercicio" class="btn btn-primary" style="cursor:pointer">
              <i data-lucide="plus-circle"></i>
              <span>Novo Exercício</span>
            </button>
          </div>
        </div>

        <div class="card admin-table-scroll" role="region" aria-label="Catálogo de exercícios; deslize para ver todas as colunas" tabindex="0">
          <table class="table" style="width:100%; text-align:left; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color)">
                <th style="padding:1rem 0.5rem">Exercício</th>
                <th style="padding:1rem 0.5rem">Grupo Muscular</th>
                <th style="padding:1rem 0.5rem">Status</th>
                <th style="padding:1rem 0.5rem; width:120px">Ações</th>
              </tr>
            </thead>
            <tbody id="exercicios-table-body">
              <!-- Renderizado por ExerciciosCatalogoView -->
            </tbody>
          </table>
        </div>
      `,

      /**
       * TASK 06 — Página de Gestão de Treinos (Admin)
       * Organizada por aluno: Grade de alunos -> Fichas do aluno
       */
      treinos: `
        <!-- Visão 1: Grade de Alunos -->
        <div id="treinos-view-alunos">
          <div class="page-header admin-page-header">
            <div>
              <h2>Fichas de Treino</h2>
              <p style="color:var(--text-muted)">Selecione um aluno para gerenciar suas fichas de treino.</p>
            </div>
            <div class="admin-page-actions">
              <div class="form-group input-with-icon admin-search-field">
                <i data-lucide="search" class="input-icon"></i>
                <input type="search" id="filtro-busca-aluno" aria-label="Buscar aluno por nome" placeholder="Buscar aluno por nome..." />
              </div>
            </div>
          </div>
          <div class="grid-3 admin-card-grid" id="treinos-alunos-grid" style="gap: 1.5rem;">
            <div style="text-align:center; padding: 2rem; grid-column: 1 / -1;">
              <div class="spinner"></div>
              <p style="color:var(--text-muted); margin-top:1rem;">Carregando alunos...</p>
            </div>
          </div>
        </div>

        <!-- Visão 2: Fichas do Aluno (Detalhes) -->
        <div id="treinos-view-fichas" style="display:none;">
          <div class="page-header admin-page-header">
            <div>
              <button type="button" class="btn btn-ghost" id="btn-voltar-perfis" style="margin-bottom:0.5rem; padding: 0.25rem 0.5rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-muted); cursor:pointer;">
                <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Voltar
              </button>
              <h2 id="treinos-aluno-nome">Treinos do Aluno</h2>
              <p style="color:var(--text-muted)">Gerencie as fichas de treino deste aluno.</p>
            </div>
            <div class="admin-page-actions">
              <button id="btn-novo-treino" class="btn btn-primary" style="cursor:pointer">
                <i data-lucide="clipboard-plus"></i>
                <span>Novo Treino</span>
              </button>
            </div>
          </div>

          <div class="card admin-table-scroll" role="region" aria-label="Fichas de treino; deslize para ver todas as colunas" tabindex="0">
            <table class="table" style="width:100%; text-align:left; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color)">
                  <th style="padding:1rem 0.5rem">Treino</th>
                  <th style="padding:1rem 0.5rem; text-align:center">Exercícios</th>
                  <th style="padding:1rem 0.5rem">Criado em</th>
                  <th style="padding:1rem 0.5rem">Status</th>
                  <th style="padding:1rem 0.5rem; width:140px">Ações</th>
                </tr>
              </thead>
              <tbody id="treinos-table-body">
                <!-- Renderizado por TreinosView -->
              </tbody>
            </table>
          </div>
        </div>
      `,

      /**
       * TASK 06 — Página "Meu Treino" (Visão do Aluno)
       * Exibe treinos ativos do aluno com possibilidade de registrar cargas.
       */
      'meu-treino': `
        <div class="page-header" style="margin-bottom:1.5rem">
          <h2>Meu Treino</h2>
          <p style="color:var(--text-muted)">Visualize seus treinos ativos e registre suas cargas para acompanhar a evolução.</p>
        </div>
        <div id="meu-treino-container">
          <div class="page-loading" style="text-align:center; padding:2rem;">
            <div class="spinner"></div>
            <p>Carregando seus treinos...</p>
          </div>
        </div>
      `,

      /**
       * TASK 07 — Página de Pagamentos e Mensalidades (Admin)
       * Tabela de pagamentos com filtros, registro de novos pagamentos,
       * painel de inadimplentes e resumo financeiro.
       */
      pagamentos: `
        <div class="page-header admin-page-header">
          <div>
            <h2>Fluxo de Pagamentos</h2>
            <p style="color:var(--text-muted)">Registre recebimentos, acompanhe vencimentos e controle a inadimplência dos alunos.</p>
          </div>
          <div class="admin-page-actions">
            <select id="filtro-status-pagamento" class="form-select" aria-label="Filtrar por status do pagamento">
              <option value="">Todos os status</option>
              <option value="paid">Pagos</option>
              <option value="pending">Pendentes</option>
              <option value="overdue">Vencidos</option>
            </select>
            <div class="form-group input-with-icon admin-search-field">
              <i data-lucide="search" class="input-icon"></i>
              <input type="text" id="filtro-aluno-pagamento" aria-label="Filtrar pagamentos por aluno" placeholder="Buscar aluno..." />
            </div>
            <button id="btn-ver-inadimplentes" class="btn btn-danger" style="cursor:pointer">
              <i data-lucide="alert-triangle"></i>
              <span>Inadimplentes</span>
            </button>
            <button id="btn-novo-pagamento" class="btn btn-success" style="cursor:pointer">
              <i data-lucide="plus-circle"></i>
              <span>Registrar recebimento</span>
            </button>
          </div>
        </div>

        <div class="card admin-table-scroll" role="region" aria-label="Histórico de pagamentos; deslize para ver todas as colunas" tabindex="0">
          <table class="table" style="width:100%; text-align:left; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color)">
                <th style="padding:1rem 0.5rem">Aluno / Plano</th>
                <th style="padding:1rem 0.5rem">Valor</th>
                <th style="padding:1rem 0.5rem">Método</th>
                <th style="padding:1rem 0.5rem">Data Pagamento</th>
                <th style="padding:1rem 0.5rem">Vencimento</th>
                <th style="padding:1rem 0.5rem">Status</th>
                <th style="padding:1rem 0.5rem; width:80px">Ações</th>
              </tr>
            </thead>
            <tbody id="pagamentos-table-body">
              <!-- Renderizado por PagamentosView -->
            </tbody>
          </table>
        </div>
      `,

      // TASK 10 — Área do Aluno: 5 views com containers dedicados
      'aluno-painel': `<div id="aluno-painel-container"></div>`,
      'aluno-treino': `<div id="aluno-treino-container"></div>`,
      'aluno-historico': `<div id="aluno-historico-container"></div>`,
      'aluno-mensalidade': `<div id="aluno-mensalidade-container"></div>`,
      'aluno-checkin': `<div id="aluno-checkin-container"></div>`,

      // TASK 12 — Área de Relatórios
      'relatorios': `<div id="relatorios-container" class="admin-report-page"></div>`,

      // Página genérica de "Em Construção" para funcionalidades futuras.
      default: `
        <div class="empty-state">
          <i data-lucide="construction" style="width: 64px; height: 64px; opacity: 0.5"></i>
          <h3>Em Construção</h3>
          <p>Esta funcionalidade está sendo implementada no backend. A estrutura visual já está isolada e pronta para conexão de dados.</p>
        </div>
      `,
    };

    /**
     * TASK 08 — Página de Check-ins.
     * Admin: KPIs + tabela com filtros + registro + cancelamento.
     * Aluno: Self-checkin simplificado.
     */
    const user = Auth.user || Auth.getLocalUser();
    const isAdmin = user && user.role === 'admin';

    if (page === 'checkins') {
      if (isAdmin) {
        // Data de hoje para filtros
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const part = type => parts.find(value => value.type === type).value;
        const hoje = `${part('year')}-${part('month')}-${part('day')}`;
        content.innerHTML = `
          <div class="page-header admin-page-header">
            <div>
              <h2>Registro de Presença</h2>
              <p style="color:var(--text-muted)">Registre check-ins, acompanhe frequência e gerencie a presença dos alunos.</p>
            </div>
            <div class="admin-page-actions">
              <button id="btn-ver-ranking" class="btn btn-primary" style="cursor:pointer">
                <i data-lucide="trophy"></i>
                <span>Ranking</span>
              </button>
              <button id="btn-registrar-checkin" class="btn btn-success" style="cursor:pointer">
                <i data-lucide="user-check"></i>
                <span>Registrar Check-in</span>
              </button>
            </div>
          </div>

          <!-- KPIs do Dia -->
          <div class="admin-checkin-metrics">
            <div class="kpi-card">
              <div class="kpi-icon green"><i data-lucide="calendar-check"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-checkins-total">—</div>
                <div class="kpi-label">Check-ins Hoje</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon blue"><i data-lucide="clock"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-ultimo-checkin" style="font-size:0.95rem;">—</div>
                <div class="kpi-label">Último Check-in</div>
              </div>
            </div>
          </div>

          <!-- Filtros -->
          <div class="admin-filter-bar">
            <div class="form-group input-with-icon admin-search-field">
              <i data-lucide="search" class="input-icon"></i>
              <input type="text" id="filtro-aluno-checkin" aria-label="Filtrar presença por aluno" placeholder="Buscar aluno..." />
            </div>
            <div class="admin-date-range">
              <label class="admin-date-field" for="filtro-data-inicio">Data inicial
                <input type="date" id="filtro-data-inicio" class="form-select" value="${hoje}">
              </label>
              <label class="admin-date-field" for="filtro-data-fim">Data final
                <input type="date" id="filtro-data-fim" class="form-select" value="${hoje}">
              </label>
            </div>
          </div>

          <!-- Tabela de Check-ins -->
          <div class="card admin-table-scroll" role="region" aria-label="Registros de presença; deslize para ver todas as colunas" tabindex="0">
            <table class="table" style="width:100%; text-align:left; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color)">
                  <th style="padding:1rem 0.5rem">Aluno</th>
                  <th style="padding:1rem 0.5rem">Data</th>
                  <th style="padding:1rem 0.5rem">Horário</th>
                  <th style="padding:1rem 0.5rem">Status</th>
                  <th style="padding:1rem 0.5rem; width:80px">Ações</th>
                </tr>
              </thead>
              <tbody id="checkins-table-body">
                <!-- Renderizado por CheckinsView -->
              </tbody>
            </table>
          </div>
        `;
      } else {
        // Visão do aluno: self-checkin simplificado
        content.innerHTML = `
          <div class="page-header" style="margin-bottom:1.5rem">
            <h2>Meu Check-in</h2>
            <p style="color:var(--text-muted)">Registre sua presença na academia.</p>
          </div>
          <div class="card" id="checkins-aluno-container">
            <div style="text-align:center; padding:3rem 1rem;">
              <div class="spinner"></div>
              <p style="margin-top:1rem; color:var(--text-muted)">Verificando...</p>
            </div>
          </div>
        `;
      }
    } else {
      // Limpeza de instâncias de gráficos anteriores para evitar vazamentos de memória e loops de redimensionamento
      if (typeof DashboardView !== 'undefined') DashboardView.destroyChart();
      
      // Injeta o HTML no container principal.
      content.innerHTML = pageTemplates[page] || pageTemplates.default;
    }

    if (page === 'dashboard' && typeof DashboardView !== 'undefined') {
      content.querySelectorAll('[data-dashboard-page]').forEach(button => {
        button.onclick = () => this.navigateTo(button.dataset.dashboardPage);
      });
      DashboardView.inicializar();
    }

    // Dispara a ponte de Inicialização do módulo secundário, se existir
    if (page === 'alunos' && typeof AlunosView !== 'undefined') {
      AlunosView.inicializar();
    }
    
    if (page === 'planos' && typeof PlanosView !== 'undefined') {
      PlanosView.inicializar();
    }

    // TASK 06: Inicializa os módulos de exercícios e treinos
    if (page === 'exercicios' && typeof ExerciciosCatalogoView !== 'undefined') {
      ExerciciosCatalogoView.inicializar();
    }

    if (page === 'treinos' && typeof TreinosView !== 'undefined') {
      document.getElementById('filtro-busca-aluno').oninput = event => TreinosView.filtrarAlunos(event.target.value);
      document.getElementById('btn-voltar-perfis').onclick = () => TreinosView.voltarParaPerfis();
      TreinosView.inicializar();
    }

    if (page === 'meu-treino' && typeof MeuTreinoView !== 'undefined') {
      MeuTreinoView.inicializar();
    }

    // TASK 07: Inicializa o módulo de pagamentos
    if (page === 'pagamentos' && typeof PagamentosView !== 'undefined') {
      PagamentosView.inicializar();
    }

    // TASK 08: Inicializa o módulo de check-ins
    if (page === 'checkins' && typeof CheckinsView !== 'undefined') {
      CheckinsView.inicializar();
    }

    // TASK 12: Inicializa o módulo de relatórios
    if (page === 'relatorios' && typeof RelatoriosView !== 'undefined') {
      RelatoriosView.inicializar();
    }

    // TASK 10: Inicializa os módulos da Área do Aluno
    if (page === 'aluno-painel' && typeof AlunoPainelView !== 'undefined') {
      AlunoPainelView.inicializar();
    }
    if (page === 'aluno-treino' && typeof AlunoTreinoView !== 'undefined') {
      AlunoTreinoView.inicializar();
    }
    if (page === 'aluno-historico' && typeof AlunoHistoricoView !== 'undefined') {
      AlunoHistoricoView.inicializar();
    }
    if (page === 'aluno-mensalidade' && typeof AlunoMensalidadeView !== 'undefined') {
      AlunoMensalidadeView.inicializar();
    }
    if (page === 'aluno-checkin' && typeof AlunoCheckinView !== 'undefined') {
      AlunoCheckinView.inicializar();
    }

    // Recria os ícones do Lucide apenas para o conteúdo novo que foi injetado.
    if (window.lucide) lucide.createIcons({ nodes: [content] });
  },

  /**
   * Auxiliar de Interface:
   * Formata a data atual em texto legível.
   */
  updateTopbarDate() {
    const dateEl = document.getElementById('topbar-date');
    const loginDateEl = document.getElementById('current-date');
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (dateEl) {
      dateEl.textContent = formattedDate;
    }
    if (loginDateEl) {
      loginDateEl.textContent = formattedDate;
    }
  },
};

/**
 * ============================================================================
 * DashboardView: Módulo Gerencial de Indicadores
 * ============================================================================
 */
const DashboardView = {
  chartInstance: null,
  currentStats: null,

  async inicializar() {
    try {
      // Reseta o estado do gráfico
      this.destroyChart();

      const resp = await API.get('/relatorios/dashboard');
      const stats = resp.data;
      this.currentStats = stats;
      const totalEl = document.getElementById('kpi-total-alunos');
      const ativosEl = document.getElementById('kpi-alunos-ativos');
      const inadimplentesEl = document.getElementById('kpi-alunos-inadimplentes');
      const checkinsEl = document.getElementById('kpi-checkins-hoje');
      const treinosEl = document.getElementById('kpi-treinos-ativos');
      const receitaEl = document.getElementById('kpi-receita-estimada');

      if (totalEl) totalEl.textContent = stats.totalAlunos || 0;
      if (ativosEl) ativosEl.textContent = stats.alunosAtivos || 0;
      if (checkinsEl) checkinsEl.textContent = stats.checkinsHoje || 0;
      if (receitaEl) {
        receitaEl.textContent = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          maximumFractionDigits: 1,
          notation: 'compact'
        }).format(stats.receitaEstimada || 0);
      }

      // Proporção atual de matrículas ativas; não representa retenção longitudinal.
      const taxaRetencaoEl = document.getElementById('kpi-taxa-retencao');
      if (taxaRetencaoEl) {
        const taxa = stats.totalAlunos > 0 ? Math.round((stats.alunosAtivos / stats.totalAlunos) * 100) : 0;
        taxaRetencaoEl.textContent = `${taxa}%`;
      }

      if (stats.tendencias) {
        setTimeout(() => this.renderChart(stats.tendencias), 100);
      }
      this.renderAtividades(stats.atividades, stats.pagamentosRecentes);
    } catch (error) {
      console.warn('DashboardView.inicializar() [ERR]:', error.message);
      const content = document.getElementById('page-content');
      if (App.currentPage === 'dashboard' && content) {
        content.innerHTML = '<section class="card" role="alert"><h3>Não foi possível carregar o painel</h3><p id="dashboard-error"></p><button class="btn btn-primary" id="dashboard-retry" type="button">Tentar novamente</button></section>';
        content.querySelector('#dashboard-error').textContent = error.message;
        content.querySelector('#dashboard-retry').onclick = () => App.navigateTo('dashboard');
      }
    }
  },

  destroyChart() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  },




  renderChart(tendencias) {
    const canvas = document.getElementById('tendencias-chart');
    const fallback = document.getElementById('chart-fallback');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      console.error('Chart.js não carregado!');
      if (fallback) fallback.style.display = 'block';
      canvas.style.display = 'none';
      return;
    }

    // Limpa instância anterior para evitar loops de redimensionamento
    this.destroyChart();

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(249, 115, 22, 0.3)');
    gradient.addColorStop(1, 'rgba(249, 115, 22, 0)');

    const cleanLabels = tendencias.labels || [];
    const cleanData = (tendencias.data || []).map(v => Number(v) || 0);

    this.chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: cleanLabels,
        datasets: [{
          label: 'Check-ins',
          data: cleanData,
          borderColor: '#fb923c', // primary-400
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#fb923c',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHitRadius: 20
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#111827',
            titleColor: '#fff',
            bodyColor: '#9ca3af',
            borderColor: '#374151',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => ` ${context.parsed.y} check-ins`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: { color: '#6b7280', font: { size: 11 }, precision: 0, padding: 10 }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#6b7280', font: { size: 11 }, padding: 10 }
          }
        }
      }
    });
  },

  renderAtividades(atividades, pagamentos) {
    const list = document.getElementById('atividades-list');
    if (list) {
      list.innerHTML = '';
      if (!atividades || atividades.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem;">Nenhum acesso recente</div>';
      } else {
        atividades.forEach(ativ => {
          const initials = ativ.nome ? ativ.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
          const diff = Math.floor((new Date() - new Date(ativ.data)) / 60000);
          let timeStr = diff < 1 ? 'Agora' : diff < 60 ? `${diff} min` : `${Math.floor(diff/60)}h atrás`;

          const isBlocked = ativ.descricao && ativ.descricao.toLowerCase().includes('inativo');
          const statusClass = isBlocked ? 'bloqueado' : 'liberado';
          const statusText = ativ.tipo === 'checkin' ? 'Presença' : 'Matrícula';

          const div = document.createElement('div');
          div.className = 'activity-item';
          div.innerHTML = `
            <div class="activity-avatar">${FitFlowSecurity.escapeHtml(initials)}</div>
            <div class="activity-info">
              <span class="student-name">${FitFlowSecurity.escapeHtml(ativ.nome)}</span>
              <span class="plan-name">${FitFlowSecurity.escapeHtml(ativ.descricao || 'Registro de atividade')}</span>
            </div>
            <div class="activity-status-group">
              <span class="status-badge ${statusClass}">${statusText}</span>
              <span class="activity-time">${timeStr}</span>
            </div>
          `;
          list.appendChild(div);
        });
      }
    }

    const payList = document.getElementById('pagamentos-list');
    if (payList) {
      payList.innerHTML = '';
      if (!pagamentos || pagamentos.length === 0) {
        payList.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem; grid-column: 1/-1;">Nenhum pagamento recente</div>';
      } else {
        pagamentos.forEach(pag => {
          const initials = pag.nome ? pag.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
          const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pag.valor ?? 0);

          const div = document.createElement('div');
          div.className = 'activity-item';
          div.style.background = 'rgba(34, 197, 94, 0.05)';
          div.innerHTML = `
            <div class="activity-avatar" style="color: var(--accent-400); border-color: rgba(34, 197, 94, 0.2);">${FitFlowSecurity.escapeHtml(initials)}</div>
            <div class="activity-info">
              <span class="student-name">${FitFlowSecurity.escapeHtml(pag.nome)}</span>
              <span class="plan-name">${FitFlowSecurity.escapeHtml(pag.descricao || 'Mensalidade')}</span>
            </div>
            <div class="activity-status-group">
              <span class="student-name" style="color: var(--accent-400); font-size: 0.9rem;">+ ${valor}</span>
              <span class="activity-time">Confirmado</span>
            </div>
          `;
          payList.appendChild(div);
        });
      }
    }

    if (window.lucide) lucide.createIcons();
  }
};

// Ponto de entrada final: Garantimos que o script só rode quando o navegador terminar de ler todo o HTML.
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
