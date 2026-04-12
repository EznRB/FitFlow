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
        btnLogin.innerHTML = '<i data-lucide="log-in"></i> <span>Entrar</span>';
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
    // Admins vão para o Dashboard, Alunos vão para o Plano de Treino.
    const defaultPage = user && user.role === 'student' ? 'meu-treino' : 'dashboard';
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
      'dashboard':   'Dashboard Geral',
      'alunos':      'Gestão de Alunos',
      'planos':      'Planos de Academia',
      'exercicios':  'Catálogo de Exercícios',
      'treinos':     'Fichas de Treino',
      'pagamentos':  'Fluxo de Pagamentos',
      'checkins':    'Registro de Presença',
      'relatorios':  'Relatórios Gerenciais',
      'meu-treino':  'Meu Treino do Dia',
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
        <div class="dashboard-welcome" style="animation: slideIn 0.5s ease-out">
          <h2>Olá${Auth.user && Auth.user.name ? ', ' + Auth.user.name.split(' ')[0] : ''}! 👋</h2>
          <p>Bem-vindo ao FitFlow Caraguá. Aqui está o resumo atual da sua academia.</p>
        </div>
        
        <!-- Grid de KPIs (Indicadores Chave de Desempenho) -->
        <div class="grid-4">
          <div class="kpi-card">
            <div class="kpi-icon blue"><i data-lucide="users"></i></div>
            <div class="kpi-content">
              <div class="kpi-value" id="kpi-total-alunos">—</div>
              <div class="kpi-label">Total de Alunos</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon green"><i data-lucide="user-check"></i></div>
            <div class="kpi-content">
              <div class="kpi-value" id="kpi-alunos-ativos">—</div>
              <div class="kpi-label">Alunos Ativos</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon yellow"><i data-lucide="calendar-check"></i></div>
            <div class="kpi-content">
              <div class="kpi-value" id="kpi-checkins-hoje">—</div>
              <div class="kpi-label">Check-ins Hoje</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon red"><i data-lucide="trending-up"></i></div>
            <div class="kpi-content">
              <div class="kpi-value" id="kpi-receita-estimada">—</div>
              <div class="kpi-label">Receita Estimada</div>
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
          <button id="btn-novo-aluno" class="btn btn-primary">
            <i data-lucide="user-plus"></i>
            <span>Nova Matrícula</span>
          </button>
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
       * Tabela com filtro por aluno, CRUD de fichas de treino.
       */
      treinos: `
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
          <div>
            <h2>Fichas de Treino</h2>
            <p style="color:var(--text-muted)">Crie e gerencie fichas de treino personalizadas para cada aluno.</p>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center">
            <select id="filtro-aluno-treino" class="form-select" style="min-width:180px">
              <option value="">Todos os alunos</option>
            </select>
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
                <th style="padding:1rem 0.5rem">Aluno</th>
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

      // Página genérica de "Em Construção" para funcionalidades futuras.
      default: `
        <div class="empty-state">
          <i data-lucide="construction" style="width: 64px; height: 64px; opacity: 0.5"></i>
          <h3>Em Construção</h3>
          <p>Esta funcionalidade está sendo implementada no backend. A estrutura visual já está isolada e pronta para conexão de dados.</p>
        </div>
      `,
    };

    // Injeta o HTML no container principal.
    content.innerHTML = placeholders[page] || placeholders.default;

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

    // Recria os ícones do Lucide apenas para o conteúdo novo que foi injetado.
    if (window.lucide) lucide.createIcons({ nodes: [content] });
  },

  /**
   * Auxiliar de Interface:
   * Formata a data atual em texto legível.
   */
  updateTopbarDate() {
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  },
};

/**
 * ============================================================================
 * DashboardView: Módulo Gerencial de Indicadores
 * ============================================================================
 */
const DashboardView = {
  async inicializar() {
    try {
      const resp = await API.get('/relatorios/dashboard');
      const stats = resp.data;

      const totalEl = document.getElementById('kpi-total-alunos');
      const ativosEl = document.getElementById('kpi-alunos-ativos');
      const checkinsEl = document.getElementById('kpi-checkins-hoje');
      const receitaEl = document.getElementById('kpi-receita-estimada');

      if (totalEl) totalEl.innerText = stats.totalAlunos;
      if (ativosEl) ativosEl.innerText = stats.alunosAtivos;
      if (checkinsEl) checkinsEl.innerText = stats.checkinsHoje;
      if (receitaEl) receitaEl.innerText = `R$ ${stats.receitaEstimada.toFixed(0)}`;

    } catch (error) {
      console.warn('DashboardView.inicializar() [ERR]:', error.message);
    }
  }
};

// Ponto de entrada final: Garantimos que o script só rode quando o navegador terminar de ler todo o HTML.
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
