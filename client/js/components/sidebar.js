/**
 * ============================================
 * FitFlow Caraguá — Sidebar Component
 * ============================================
 * Gerencia a sidebar: navegação por role,
 * toggle mobile, e estado ativo.
 */

const Sidebar = {
  element: null,
  overlay: null,
  navContainer: null,

  /** Itens do menu para ADMIN */
  adminMenu: [
    { section: 'Principal' },
    { id: 'dashboard',   icon: 'layout-dashboard', label: 'Dashboard',    page: 'dashboard' },
    { section: 'Gestão' },
    { id: 'alunos',      icon: 'users',            label: 'Alunos',       page: 'alunos' },
    { id: 'planos',      icon: 'tag',              label: 'Planos',       page: 'planos' },
    { id: 'exercicios',  icon: 'dumbbell',         label: 'Exercícios',   page: 'exercicios' },
    { id: 'treinos',     icon: 'clipboard-list',   label: 'Treinos',      page: 'treinos' },
    // Métodos e nutrição usam cálculos verificáveis em uma área própria.
    { id: 'evidencias', icon: 'book-open', label: 'Fundamentos', page: 'evidencias' },
    { id: 'nutricao', icon: 'apple', label: 'Nutrição', page: 'nutricao' },
    { section: 'Financeiro' },
    { id: 'pagamentos',  icon: 'credit-card',      label: 'Pagamentos',   page: 'pagamentos' },
    { id: 'checkins',    icon: 'calendar-check',   label: 'Check-ins',    page: 'checkins' },
    { section: 'Análise' },
    { id: 'relatorios',  icon: 'bar-chart-3',      label: 'Relatórios',   page: 'relatorios' },
  ],

  /** Itens do menu para ALUNO (TASK 10 — Área do Aluno expandida) */
  instructorMenu: [
    { section: 'Acompanhamento' },
    { id: 'treinos', icon: 'clipboard-list', label: 'Minhas fichas', page: 'treinos' },
    { id: 'evidencias', icon: 'book-open', label: 'Fundamentos', page: 'evidencias' },
    { id: 'nutricao', icon: 'apple', label: 'Nutrição', page: 'nutricao' },
  ],
  alunoMenu: [
    { section: 'Meu Espaço' },
    { id: 'aluno-painel',      icon: 'layout-dashboard', label: 'Meu Painel',   page: 'aluno-painel' },
    { id: 'aluno-treino',      icon: 'dumbbell',         label: 'Meu Treino',   page: 'aluno-treino' },
    { id: 'sessoes', icon: 'list-checks', label: 'Sessões e séries', page: 'sessoes' },
    { id: 'aluno-historico',   icon: 'trending-up',      label: 'Evolução',     page: 'aluno-historico' },
    { id: 'nutricao', icon: 'apple', label: 'Nutrição', page: 'nutricao' },
    { id: 'evidencias', icon: 'book-open', label: 'Fundamentos', page: 'evidencias' },
    { section: 'Financeiro' },
    { id: 'aluno-mensalidade', icon: 'credit-card',      label: 'Mensalidade',  page: 'aluno-mensalidade' },
    { id: 'aluno-checkin',     icon: 'calendar-check',   label: 'Check-in',     page: 'aluno-checkin' },
  ],

  /**
   * Inicializa a sidebar com base na role do usuário.
   * @param {string} role - 'admin' ou 'aluno'
   */
  init(role) {
    this.element = document.getElementById('sidebar');
    this.overlay = document.getElementById('sidebar-overlay');
    this.navContainer = document.getElementById('sidebar-nav');

    const menu = role === 'admin' ? this.adminMenu : role === 'instructor' ? this.instructorMenu : this.alunoMenu;
    this.render(menu);
    this.bindEvents();
  },

  /**
   * Renderiza os itens do menu na sidebar.
   */
  render(menu) {
    this.navContainer.innerHTML = '';

    menu.forEach((item) => {
      if (item.section) {
        // Section title
        const title = document.createElement('div');
        title.className = 'nav-section-title';
        title.textContent = item.section;
        this.navContainer.appendChild(title);
      } else {
        // Nav item
        const navItem = document.createElement('button');
        navItem.type = 'button';
        navItem.className = 'nav-item';
        navItem.dataset.page = item.page;
        navItem.id = `nav-${item.id}`;
        navItem.innerHTML = `
          <i data-lucide="${item.icon}"></i>
          <span>${item.label}</span>
        `;
        navItem.addEventListener('click', () => {
          this.setActive(item.page);
          this.closeMobile();
          // Dispara evento de navegação
          window.dispatchEvent(new CustomEvent('navigate', { detail: { page: item.page } }));
        });
        this.navContainer.appendChild(navItem);
      }
    });

    // Renderiza ícones Lucide
    if (window.lucide) lucide.createIcons({ nodes: [this.navContainer] });
  },

  /**
   * Define o item ativo na sidebar.
   * @param {string} page - ID da página
   */
  setActive(page) {
    const items = this.navContainer.querySelectorAll('.nav-item');
    items.forEach((item) => {
      item.classList.toggle('active', item.dataset.page === page);
      if (item.dataset.page === page) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  },

  /**
   * Bindeia eventos de toggle mobile.
   */
  bindEvents() {
    const openBtn = document.getElementById('btn-open-sidebar');
    const closeBtn = document.getElementById('btn-close-sidebar');

    if (openBtn) openBtn.onclick = () => this.openMobile();
    if (closeBtn) closeBtn.onclick = () => this.closeMobile();
    if (this.overlay) this.overlay.onclick = () => this.closeMobile();
    if (!this.mobileQuery) {
      this.mobileQuery = window.matchMedia('(max-width: 768px)');
      this.mobileQuery.addEventListener('change', () => this.closeMobile(false));
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && this.element?.classList.contains('open')) this.closeMobile();
      });
    }
    this.syncMobile();
  },

  syncMobile() {
    const open = this.mobileQuery.matches && this.element.classList.contains('open');
    this.element.inert = this.mobileQuery.matches && !open;
    const button = document.getElementById('btn-open-sidebar');
    button?.setAttribute('aria-expanded', String(open));
    button?.setAttribute('aria-controls', 'sidebar');
  },

  openMobile() {
    this.element.classList.add('open');
    this.overlay.classList.add('active');
    this.syncMobile();
    document.getElementById('btn-close-sidebar')?.focus();
  },

  closeMobile(restoreFocus = true) {
    const wasOpen = this.element.classList.contains('open');
    this.element.classList.remove('open');
    this.overlay.classList.remove('active');
    this.syncMobile();
    if (wasOpen && restoreFocus) document.getElementById('btn-open-sidebar')?.focus();
  },
};
