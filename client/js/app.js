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

  /**
   * Função de Inicialização (Entry Point):
   * É chamada assim que o documento HTML termina de carregar.
   */
  async init() {
    // Inicializa os ícones do Lucide. O Lucide substitui as tags <i> por SVGs modernos.
    if (window.lucide) lucide.createIcons();

    // Inicializa componentes de feedback visual comuns em sistemas web.
    Toast.init(); // Responsável por alertas flutuantes no canto da tela.
    Modal.init(); // Responsável por janelas de diálogo sobrepostas.

    // Configura os ouvintes de evento (listeners) para o formulário de login.
    this.setupLoginForm();

    // Configura a ação do botão de logout no cabeçalho.
    document.getElementById('btn-logout').addEventListener('click', () => {
      Auth.logout();
    });

    // Escuta eventos de navegação customizados disparados por outros componentes (ex: sidebar).
    window.addEventListener('navigate', (e) => {
      this.navigateTo(e.detail.page);
    });

    // Quando o usuário desloga, forçamos o retorno imediato à tela de login.
    window.addEventListener('auth:logout', () => {
      this.showLogin();
    });

    // Exibe a data atual formatada de forma amigável no topo do sistema.
    this.updateTopbarDate();

    /**
     * LÓGICA DE PERSISTÊNCIA DE LOGIN (TASK 3):
     * Verifica no localStorage ou via API se o usuário já possui um token válido.
     * Se sim, pula o login e vai direto para o sistema protegido.
     */
    const isLoggedIn = await Auth.checkAuth();
    if (isLoggedIn) {
      this.showApp();
    } else {
      this.showLogin();
    }
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
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-password').value;
      const btnLogin = document.getElementById('btn-login');

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
        btnLogin.innerHTML = '<span>→] Entrar</span>';
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
        user.role === 'admin' ? 'Administrador' : 'Aluno';
    }

    // Inicializa a navegação lateral (sidebar) com permissões baseadas no cargo (role).
    Sidebar.init(user ? user.role : 'admin');

    // Determina a página inicial padrão dependendo do tipo de usuário.
    // Admins vão para o Dashboard, Alunos para o Painel do Aluno (TASK 10).
    const defaultPage = user && user.role === 'student' ? 'aluno-painel' : 'dashboard';
    this.navigateTo(defaultPage);
  },

  /**
   * Navegação Interna (SPA):
   * Muda o conteúdo central da tela sem trocar de URL/recarregar.
   */
  navigateTo(page) {
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
  },

  /**
   * Renderização Dinâmica (Switch Case):
   * Injeta o código HTML necessário para cada página selecionada.
   * Atualmente em fase de construção com placeholders (prototipagem).
   */
  renderPage(page) {
    const content = document.getElementById('page-content');

    // Mapeamento de HTML para cada "View".
    const placeholders = {
      dashboard: `
        <div class="dashboard-wrapper" style="display: flex; flex-direction: column; gap: 2rem; animation: fadeIn 0.4s ease-out;">
          
          <div class="dashboard-welcome">
            <h2 style="font-size: 1.8rem; margin-bottom: 0.5rem;">Olá${Auth.user && Auth.user.name ? ', ' + Auth.user.name.split(' ')[0] : ''}! 👋</h2>
            <p style="color: var(--text-muted); font-size: 1.1rem;">Bem-vindo ao FitFlow Caraguá. Aqui está o resumo atual da sua academia.</p>
          </div>
          
          <!-- Grid de KPIs -->
          <div class="grid-3" style="gap: 1.5rem;">
            <div class="kpi-card" onclick="DashboardView.openKpiChart('alunos')" style="cursor: pointer; transition: transform 0.2s ease;">
              <div class="kpi-icon blue"><i data-lucide="users"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-total-alunos">—</div>
                <div class="kpi-label">Total de Alunos</div>
              </div>
            </div>
            <div class="kpi-card" onclick="DashboardView.openKpiChart('ativos')" style="cursor: pointer; transition: transform 0.2s ease;">
              <div class="kpi-icon green"><i data-lucide="user-check"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-alunos-ativos">—</div>
                <div class="kpi-label">Alunos Ativos</div>
              </div>
            </div>
            <div class="kpi-card" onclick="DashboardView.openKpiChart('inadimplentes')" style="cursor: pointer; transition: transform 0.2s ease;">
              <div class="kpi-icon orange"><i data-lucide="user-minus"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-alunos-inadimplentes">—</div>
                <div class="kpi-label">Alunos Inadimplentes</div>
              </div>
            </div>
            <div class="kpi-card" onclick="DashboardView.openKpiChart('checkins')" style="cursor: pointer; transition: transform 0.2s ease;">
              <div class="kpi-icon yellow"><i data-lucide="calendar-check"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-checkins-hoje">—</div>
                <div class="kpi-label">Check-ins Hoje</div>
              </div>
            </div>
            <div class="kpi-card" onclick="DashboardView.openKpiChart('treinos')" style="cursor: pointer; transition: transform 0.2s ease;">
              <div class="kpi-icon purple"><i data-lucide="dumbbell"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-treinos-ativos">—</div>
                <div class="kpi-label">Treinos Ativos</div>
              </div>
            </div>
            <div class="kpi-card" onclick="DashboardView.openKpiChart('receita')" style="cursor: pointer; transition: transform 0.2s ease;">
              <div class="kpi-icon red"><i data-lucide="trending-up"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-receita-estimada">—</div>
                <div class="kpi-label">Receita Estimada</div>
              </div>
            </div>
          </div>

          <!-- Gráfico Principal e Atividades -->
          <div class="dashboard-grid-2">
            <div class="chart-container" style="min-height: 420px; display: flex; flex-direction: column;">
              <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="line-chart" style="width: 20px; color: var(--primary-400)"></i>
                Tendências Diárias de Presença
              </h3>
              <div id="chart-wrapper" style="flex: 1; position: relative; min-height: 300px; width: 100%; background: rgba(0,0,0,0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                <canvas id="tendencias-chart"></canvas>
                <div id="chart-fallback" style="display: none; color: var(--text-muted); text-align: center;">
                  <i data-lucide="alert-circle" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                  <p>Dados de tendências indisponíveis no momento.</p>
                </div>
              </div>
            </div>

            <div class="activities-container">
              <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="clock" style="width: 20px; color: var(--primary-400)"></i>
                Atividade Recente
              </h3>
              <ul class="activities-list" id="atividades-list">
                <div style="text-align:center; padding: 2rem 0;"><div class="spinner"></div></div>
              </ul>
            </div>
          </div>

          <!-- Segunda Linha: Pagamentos -->
          <div class="dashboard-grid-2">
             <div class="activities-container" style="grid-column: 1 / -1;">
                <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                  <i data-lucide="credit-card" style="width: 20px; color: var(--primary-400)"></i>
                  Pagamentos Recentes
                </h3>
                <ul class="activities-list" id="pagamentos-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
                  <div style="text-align:center; padding: 2rem 0;"><div class="spinner"></div></div>
                </ul>
             </div>
          </div>

        </div>
      `,
      alunos: `
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
          <div>
            <h2>Gestão de Alunos</h2>
            <p style="color:var(--text-muted)">Cadastre, inative ou atualize o perfil dos clientes da academia.</p>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center;">
            <div class="form-group input-with-icon" style="margin:0; min-width: 250px;">
              <i data-lucide="search" class="input-icon"></i>
              <input type="text" id="filtro-nome-aluno" placeholder="Buscar aluno..." />
            </div>
            <button id="btn-novo-aluno" class="btn btn-primary">
              <i data-lucide="user-plus"></i>
              <span>Nova Matrícula</span>
            </button>
          </div>
        </div>

        <div class="card" style="overflow-x:auto;">
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
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
          <div>
            <h2>Planos de Academia</h2>
            <p style="color:var(--text-muted)">Crie ou atualize os planos de assinatura disponíveis para os alunos.</p>
          </div>
          <button id="btn-novo-plano" class="btn btn-primary">
            <i data-lucide="tag"></i>
            <span>Novo Plano</span>
          </button>
        </div>

        <div class="grid-3" id="planos-grid" style="gap: 1.5rem;">
          <!-- Renderizado dinamicamente por PlanosView -->
        </div>
      `,

      /**
       * TASK 06 — Página do Catálogo de Exercícios (Admin)
       * Tabela com filtro por grupo muscular e CRUD completo.
       */
      exercicios: `
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
          <div>
            <h2>Catálogo de Exercícios</h2>
            <p style="color:var(--text-muted)">Gerencie os exercícios disponíveis para montar fichas de treino.</p>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center">
            <select id="filtro-grupo-muscular" class="form-select" style="min-width:160px">
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

        <div class="card" style="overflow-x:auto;">
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
          <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
            <div>
              <h2>Fichas de Treino</h2>
              <p style="color:var(--text-muted)">Selecione um aluno para gerenciar suas fichas de treino.</p>
            </div>
            <div style="display:flex; gap:0.75rem; align-items:center">
              <div class="form-group input-with-icon" style="margin:0; min-width: 250px;">
                <i data-lucide="search" class="input-icon"></i>
                <input type="text" id="filtro-busca-aluno" placeholder="Buscar aluno por nome..." oninput="TreinosView.filtrarAlunos(this.value)" />
              </div>
            </div>
          </div>
          <div class="grid-3" id="treinos-alunos-grid" style="gap: 1.5rem;">
            <div style="text-align:center; padding: 2rem; grid-column: 1 / -1;">
              <div class="spinner"></div>
              <p style="color:var(--text-muted); margin-top:1rem;">Carregando alunos...</p>
            </div>
          </div>
        </div>

        <!-- Visão 2: Fichas do Aluno (Detalhes) -->
        <div id="treinos-view-fichas" style="display:none;">
          <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
            <div>
              <button class="btn btn-ghost" onclick="TreinosView.voltarParaPerfis()" style="margin-bottom:0.5rem; padding: 0.25rem 0.5rem; display:flex; align-items:center; gap:0.5rem; color:var(--text-muted); cursor:pointer;">
                <i data-lucide="arrow-left" style="width:16px;height:16px"></i> Voltar
              </button>
              <h2 id="treinos-aluno-nome">Treinos do Aluno</h2>
              <p style="color:var(--text-muted)">Gerencie as fichas de treino deste aluno.</p>
            </div>
            <div style="display:flex; gap:0.75rem; align-items:center">
              <button id="btn-novo-treino" class="btn btn-primary" style="cursor:pointer">
                <i data-lucide="clipboard-plus"></i>
                <span>Novo Treino</span>
              </button>
            </div>
          </div>

          <div class="card" style="overflow-x:auto;">
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
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <h2>Fluxo de Pagamentos</h2>
            <p style="color:var(--text-muted)">Registre pagamentos, acompanhe vencimentos e controle a inadimplência dos alunos.</p>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
            <select id="filtro-status-pagamento" class="form-select" style="min-width:140px">
              <option value="">Todos os status</option>
              <option value="paid">Pagos</option>
              <option value="pending">Pendentes</option>
              <option value="overdue">Vencidos</option>
            </select>
            <div class="form-group input-with-icon" style="margin:0; min-width:200px;">
              <i data-lucide="search" class="input-icon"></i>
              <input type="text" id="filtro-aluno-pagamento" placeholder="Buscar aluno..." />
            </div>
            <button id="btn-ver-inadimplentes" class="btn btn-danger" style="cursor:pointer">
              <i data-lucide="alert-triangle"></i>
              <span>Inadimplentes</span>
            </button>
            <button id="btn-novo-pagamento" class="btn btn-success" style="cursor:pointer">
              <i data-lucide="plus-circle"></i>
              <span>Novo Pagamento</span>
            </button>
          </div>
        </div>

        <div class="card" style="overflow-x:auto;">
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
      'relatorios': `<div id="relatorios-container"></div>`,

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
        const hoje = new Date().toISOString().split('T')[0];
        content.innerHTML = `
          <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
            <div>
              <h2>Registro de Presença</h2>
              <p style="color:var(--text-muted)">Registre check-ins, acompanhe frequência e gerencie a presença dos alunos.</p>
            </div>
            <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
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
          <div class="grid-4" style="margin-bottom:1.5rem;">
            <div class="kpi-card" style="grid-column: span 2;">
              <div class="kpi-icon green"><i data-lucide="calendar-check"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-checkins-total">—</div>
                <div class="kpi-label">Check-ins Hoje</div>
              </div>
            </div>
            <div class="kpi-card" style="grid-column: span 2;">
              <div class="kpi-icon blue"><i data-lucide="clock"></i></div>
              <div class="kpi-content">
                <div class="kpi-value" id="kpi-ultimo-checkin" style="font-size:0.95rem;">—</div>
                <div class="kpi-label">Último Check-in</div>
              </div>
            </div>
          </div>

          <!-- Filtros -->
          <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap;">
            <div class="form-group input-with-icon" style="margin:0; min-width:200px;">
              <i data-lucide="search" class="input-icon"></i>
              <input type="text" id="filtro-aluno-checkin" placeholder="Buscar aluno..." />
            </div>
            <input type="date" id="filtro-data-inicio" class="form-select" value="${hoje}" style="min-width:140px" title="Data início">
            <span style="color:var(--text-muted)">até</span>
            <input type="date" id="filtro-data-fim" class="form-select" value="${hoje}" style="min-width:140px" title="Data fim">
          </div>

          <!-- Tabela de Check-ins -->
          <div class="card" style="overflow-x:auto;">
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
      content.innerHTML = placeholders[page] || placeholders.default;
    }

    if (page === 'dashboard' && typeof DashboardView !== 'undefined') {
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
      if (inadimplentesEl) inadimplentesEl.textContent = stats.alunosInadimplentes || 0;
      if (checkinsEl) checkinsEl.textContent = stats.checkinsHoje || 0;
      if (treinosEl) treinosEl.textContent = stats.treinosAtivos || 0;
      if (receitaEl) {
        receitaEl.textContent = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(stats.receitaEstimada || 0);
      }
      if (stats.tendencias) {
        // Pequeno atraso para garantir que o DOM esteja estável
        setTimeout(() => this.renderChart(stats.tendencias), 100);
      }
      this.renderAtividades(stats.atividades, stats.pagamentosRecentes);
    } catch (error) {
      console.warn('DashboardView.inicializar() [ERR]:', error.message);
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

    const cleanLabels = tendencias.labels || [];
    const cleanData = (tendencias.data || []).map(v => Number(v) || 0);

    this.chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: cleanLabels,
        datasets: [{
          label: 'Check-ins',
          data: cleanData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 10 },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#1f2937',
            titleColor: '#fff',
            bodyColor: '#9ca3af',
            borderColor: '#374151',
            borderWidth: 1,
            padding: 12,
            displayColors: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            min: 0,
            suggestedMax: Math.max(...cleanData, 5) + 1,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af', font: { size: 11 }, precision: 0 }
          },
          x: {
            grid: { display: false },
            ticks: { 
              color: '#9ca3af',
              font: { size: 10, weight: 'bold' }
            }
          }
        }
      }
    });
  },

  /**
   * Drill-down: Abre modal com gráfico detalhado do KPI clicado.
   */
  openKpiChart(type) {
    if (!this.currentStats) return;

    let title = 'Detalhes do Indicador';
    let label = '';
    let data = [];
    let labels = this.currentStats.historico?.labels || [];
    let color = '#3b82f6';

    switch (type) {
      case 'alunos':
        title = 'Crescimento de Alunos';
        label = 'Novos Alunos';
        data = this.currentStats.historico?.alunos || [];
        color = '#3b82f6';
        break;
      case 'ativos':
        title = 'Alunos Ativos (Histórico)';
        label = 'Ativos';
        data = this.currentStats.historico?.alunos || [];
        color = '#10b981';
        break;
      case 'inadimplentes':
        title = 'Evolução de Inadimplência';
        label = 'Bloqueados';
        data = labels.map(() => this.currentStats.alunosInadimplentes);
        color = '#f59e0b';
        break;
      case 'checkins':
        title = 'Tendência de Frequência';
        label = 'Check-ins';
        data = this.currentStats.historico?.checkins || [];
        color = '#eab308';
        break;
      case 'treinos':
        title = 'Engajamento em Treinos';
        label = 'Fichas Ativas';
        data = labels.map(() => this.currentStats.treinosAtivos);
        color = '#8b5cf6';
        break;
      case 'receita':
        title = 'Fluxo de Receita (Estimado)';
        label = 'Receita (R$)';
        data = this.currentStats.historico?.receita || [];
        color = '#ef4444';
        break;
    }

    const bodyHTML = `
      <div style="height: 350px; width: 100%; position: relative;">
        <canvas id="modal-kpi-chart"></canvas>
      </div>
      <div style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-surface); border-radius: 8px;">
        <p style="margin:0; color: var(--text-secondary); font-size: 0.9rem;">
          Exibindo dados agregados dos últimos 7 dias. Para relatórios detalhados, acesse a página de <strong>Relatórios Gerenciais</strong>.
        </p>
      </div>
    `;

    Modal.open(title, bodyHTML, [
      { text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() }
    ]);

    // Inicializa o gráfico após o modal abrir
    setTimeout(() => {
      const canvas = document.getElementById('modal-kpi-chart');
      if (!canvas || typeof Chart === 'undefined') return;
      
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: label,
            data: data,
            backgroundColor: color + '80',
            borderColor: color,
            borderWidth: 2,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { 
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1f2937',
              padding: 10
            }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { grid: { display: false } }
          }
        }
      });
    }, 150);
  },

  renderAtividades(atividades, pagamentos) {
    const list = document.getElementById('atividades-list');
    if (list) {
      list.innerHTML = '';
      if (!atividades || atividades.length === 0) {
        list.innerHTML = '<li style="color:var(--text-muted); text-align:center; margin-top:2rem;">Nenhuma atividade recente</li>';
      } else {
        atividades.forEach(ativ => {
          const isCheckin = ativ.tipo === 'checkin';
          const avatarColor = isCheckin ? 'green' : 'blue';
          const initial = ativ.nome ? ativ.nome.charAt(0).toUpperCase() : '?';
          
          const diff = Math.floor((new Date() - new Date(ativ.data)) / 60000);
          let timeStr = diff < 1 ? 'Agora mesmo' : diff < 60 ? `${diff}m atrás` : `${Math.floor(diff/60)}h atrás`;

          const li = document.createElement('li');
          li.className = 'activity-item';
          li.innerHTML = `
            <div class="activity-avatar ${avatarColor}">${initial}</div>
            <div class="activity-details">
              <div class="activity-name">${ativ.nome}</div>
              <div class="activity-action">${ativ.descricao}</div>
            </div>
            <div class="activity-time">${timeStr}</div>
          `;
          list.appendChild(li);
        });
      }
    }

    const payList = document.getElementById('pagamentos-list');
    if (payList) {
      payList.innerHTML = '';
      if (!pagamentos || pagamentos.length === 0) {
        payList.innerHTML = '<li style="color:var(--text-muted); text-align:center; margin-top:2rem;">Nenhum pagamento recente</li>';
      } else {
        pagamentos.forEach(pag => {
          const initial = pag.nome ? pag.nome.charAt(0).toUpperCase() : '?';
          
          const diff = Math.floor((new Date() - new Date(pag.data)) / 60000);
          let timeStr = diff < 1 ? 'Agora mesmo' : diff < 60 ? `${diff}m atrás` : `${Math.floor(diff/60)}h atrás`;

          const li = document.createElement('li');
          li.className = 'activity-item';
          li.innerHTML = `
            <div class="activity-avatar green">${initial}</div>
            <div class="activity-details">
              <div class="activity-name">${pag.nome}</div>
              <div class="activity-action">${pag.descricao}</div>
            </div>
            <div class="activity-time">${timeStr}</div>
          `;
          payList.appendChild(li);
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
