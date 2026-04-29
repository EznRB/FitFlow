/**
 * ============================================================================
 * FitFlow Caraguá — Área do Aluno (TASK 10)
 * ============================================================================
 * Módulo SPA com 5 views mobile-first para o aluno:
 * 1. AlunoPainelView    — Dashboard principal
 * 2. AlunoTreinoView    — Treinos e exercícios
 * 3. AlunoHistoricoView — Evolução de cargas
 * 4. AlunoMensalidadeView — Status financeiro
 * 5. AlunoCheckinView   — Check-in e frequência
 *
 * Segurança: Todos os dados vêm do endpoint /api/aluno/* que filtra
 * apenas os dados do aluno logado via JWT.
 */

// ============================================
// 1. PAINEL PRINCIPAL (DASHBOARD)
// ============================================
const AlunoPainelView = {
  dados: null,

  async inicializar() {
    const container = document.getElementById('aluno-painel-container');
    if (!container) return;
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Carregando seu painel...</span></div>';
    try {
      const resp = await API.get('/aluno/painel');
      this.dados = resp.data;
      this.renderizar(container);
    } catch (error) {
      console.error('Erro ao carregar painel:', error);
      container.innerHTML = '<div class="alert alert-error">Erro ao carregar seu painel. Tente novamente.</div>';
    }
  },

  renderizar(container) {
    const d = this.dados;
    const alertasHtml = this._renderAlertas(d.alertas);
    const diasVenc = d.mensalidade.diasRestantes;
    const diasTexto = diasVenc !== null ? (diasVenc > 0 ? diasVenc : 0) : '—';
    const diasCor = diasVenc !== null ? (diasVenc <= 0 ? 'red' : diasVenc <= 5 ? 'yellow' : 'green') : 'blue';

    container.innerHTML = `
      ${alertasHtml}
      <div class="aluno-welcome">
        <h2>Olá, ${d.perfil.nome.split(' ')[0]}! 💪</h2>
        <p>${this._getSaudacao()} — ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div class="aluno-kpi-grid">
        <div class="aluno-kpi-card" onclick="window.App && App.navigateTo('aluno-mensalidade')">
          <div class="aluno-kpi-icon ${diasCor}">
            <i data-lucide="calendar-clock"></i>
          </div>
          <div class="aluno-kpi-info">
            <div class="aluno-kpi-value">${diasTexto}</div>
            <div class="aluno-kpi-label">Dias até vencimento</div>
          </div>
        </div>
        <div class="aluno-kpi-card" onclick="window.App && App.navigateTo('aluno-checkin')">
          <div class="aluno-kpi-icon blue">
            <i data-lucide="calendar-check"></i>
          </div>
          <div class="aluno-kpi-info">
            <div class="aluno-kpi-value">${d.checkins.totalMes}</div>
            <div class="aluno-kpi-label">Check-ins este mês</div>
          </div>
        </div>
        <div class="aluno-kpi-card" onclick="window.App && App.navigateTo('aluno-treino')">
          <div class="aluno-kpi-icon orange">
            <i data-lucide="dumbbell"></i>
          </div>
          <div class="aluno-kpi-info">
            <div class="aluno-kpi-value">${d.treinos.length}</div>
            <div class="aluno-kpi-label">Treinos ativos</div>
          </div>
        </div>
      </div>

      ${this._renderTreinoResumo(d.treinos)}
      ${this._renderCheckinsRecentes(d.checkins.recentes)}
    `;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },

  _renderAlertas(alertas) {
    if (!alertas || alertas.length === 0) return '';
    return alertas.map(a => {
      if (a.severidade === 'critico') {
        return `<div class="aluno-banner-blocked"><i data-lucide="${a.icone}"></i><span class="banner-text">${a.mensagem}</span></div>`;
      }
      const cls = a.severidade === 'aviso' ? 'alert-warning' : a.severidade === 'alerta' ? 'alert-error' : 'alert-info';
      return `<div class="alert ${cls}" style="margin-bottom:var(--space-4)"><i data-lucide="${a.icone}" style="width:18px;height:18px;flex-shrink:0"></i>${a.mensagem}</div>`;
    }).join('');
  },

  _renderTreinoResumo(treinos) {
    if (treinos.length === 0) return `
      <div class="aluno-section">
        <div class="aluno-section-title"><i data-lucide="dumbbell"></i> Meu Treino</div>
        <div class="empty-state" style="padding:2rem"><i data-lucide="clipboard-x" style="width:48px;height:48px;opacity:0.3"></i><h3>Sem treino ativo</h3><p style="color:var(--text-muted)">Fale com seu instrutor para criar sua ficha.</p></div>
      </div>`;
    const t = treinos[0];
    return `
      <div class="aluno-section">
        <div class="aluno-section-title"><i data-lucide="dumbbell"></i> Treino Atual</div>
        <div class="aluno-treino-card" onclick="window.App && App.navigateTo('aluno-treino')" style="cursor:pointer">
          <div class="aluno-treino-header">
            <h3>${t.nome}</h3>
            <div class="treino-meta"><div>Por: ${t.instrutor}</div><div>${t.qtdExercicios} exercícios</div></div>
          </div>
          <div class="aluno-treino-body" style="display:flex;align-items:center;justify-content:space-between">
            <span style="color:var(--text-secondary);font-size:var(--font-size-sm)">${t.descricao || 'Toque para ver exercícios'}</span>
            <i data-lucide="chevron-right" style="width:20px;height:20px;color:var(--text-muted)"></i>
          </div>
        </div>
      </div>`;
  },

  _renderCheckinsRecentes(checkins) {
    if (checkins.length === 0) return '';
    const itens = checkins.slice(0, 3).map(c => {
      const data = new Date(c.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return `<div class="aluno-historico-item"><div class="aluno-historico-icone check"><i data-lucide="check-circle"></i></div><div class="aluno-historico-info"><div class="aluno-historico-titulo">Check-in realizado</div></div><div class="aluno-historico-data">${data}</div></div>`;
    }).join('');
    return `<div class="aluno-section"><div class="aluno-section-title"><i data-lucide="calendar-check"></i> Check-ins Recentes</div><div class="aluno-historico-lista">${itens}</div></div>`;
  },

  _getSaudacao() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }
};

// ============================================
// 2. MEU TREINO (EXERCÍCIOS + REGISTRO CARGA)
// ============================================
const AlunoTreinoView = {
  dados: null,
  bloqueado: false,

  async inicializar() {
    const container = document.getElementById('aluno-treino-container');
    if (!container) return;
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Carregando treinos...</span></div>';
    try {
      const resp = await API.get('/aluno/painel');
      this.dados = resp.data;
      this.bloqueado = resp.data.perfil.status === 'blocked';
      this.renderizar(container);
    } catch (error) {
      container.innerHTML = '<div class="alert alert-error">Erro ao carregar treinos.</div>';
    }
  },

  renderizar(container) {
    const d = this.dados;
    const alertaHtml = this.bloqueado ? '<div class="aluno-banner-blocked"><i data-lucide="alert-triangle"></i><span class="banner-text">Matrícula bloqueada. Registro de cargas indisponível.</span></div>' : '';
    
    if (d.treinos.length === 0) {
      container.innerHTML = `${alertaHtml}<div class="empty-state" style="padding:3rem"><i data-lucide="clipboard-x" style="width:64px;height:64px;opacity:0.3;margin-bottom:1rem"></i><h3 style="color:var(--text-primary)">Nenhum treino ativo</h3><p style="color:var(--text-muted)">Seu instrutor ainda não criou uma ficha para você.</p></div>`;
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = alertaHtml + d.treinos.map(t => {
      const exerciciosHtml = t.exercicios.map((ex, i) => this._renderExercicio(ex, i)).join('');
      return `
        <div class="aluno-treino-card">
          <div class="aluno-treino-header">
            <div><h3>${t.nome}</h3>${t.descricao ? `<p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin:4px 0 0">${t.descricao}</p>` : ''}</div>
            <div class="treino-meta"><div>Por: ${t.instrutor}</div><div>${new Date(t.criadoEm).toLocaleDateString('pt-BR')}</div></div>
          </div>
          <div class="aluno-treino-body">${exerciciosHtml}</div>
        </div>`;
    }).join('');
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },

  _renderExercicio(ex, idx) {
    const ultimaCarga = ex.ultimaCarga ? `<span class="aluno-metrica-valor destaque">${ex.ultimaCarga.peso}kg</span>` : '<span class="aluno-metrica-valor">—</span>';
    const btnDisabled = this.bloqueado ? 'disabled' : '';
    return `
      <div class="aluno-exercicio">
        <div class="aluno-exercicio-top">
          <div class="aluno-exercicio-nome"><span class="aluno-exercicio-numero">${idx + 1}</span><strong>${ex.nome}</strong>${ex.grupoMuscular ? `<span class="badge badge-info" style="font-size:0.6rem;margin-left:4px">${ex.grupoMuscular}</span>` : ''}</div>
          <button class="aluno-btn-carga" onclick="AlunoTreinoView.abrirRegistroCarga(${ex.id}, '${ex.nome.replace(/'/g, "\\'")}')" ${btnDisabled}><i data-lucide="plus"></i> Carga</button>
        </div>
        <div class="aluno-metricas-grid">
          <div class="aluno-metrica"><div class="aluno-metrica-label">Séries × Reps</div><div class="aluno-metrica-valor">${ex.series} × ${ex.reps}</div></div>
          <div class="aluno-metrica"><div class="aluno-metrica-label">Sugerido</div><div class="aluno-metrica-valor">${ex.cargaSugerida || '—'}</div></div>
          <div class="aluno-metrica"><div class="aluno-metrica-label">Última</div>${ultimaCarga}</div>
        </div>
        ${ex.notas ? `<div class="aluno-exercicio-notas"><i data-lucide="info"></i>${ex.notas}</div>` : ''}
      </div>`;
  },

  abrirRegistroCarga(exerciseId, nome) {
    if (this.bloqueado) { Toast.error('Registro de cargas indisponível — matrícula bloqueada.'); return; }
    const html = `
      <form id="form-carga-aluno" style="display:flex;flex-direction:column;gap:1rem">
        <p style="color:var(--text-secondary)">Registre a carga executada:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div class="form-group"><label>Carga (kg)</label><input type="number" id="aluno-carga-peso" step="0.5" min="0" placeholder="Ex: 42.5" required style="font-size:var(--font-size-xl);text-align:center;padding:1rem"></div>
          <div class="form-group"><label>Repetições</label><input type="number" id="aluno-carga-reps" min="1" placeholder="Ex: 10" style="font-size:var(--font-size-xl);text-align:center;padding:1rem"></div>
        </div>
        <div class="form-group"><label>Observação (opcional)</label><input type="text" id="aluno-carga-obs" placeholder="Ex: Últimas 2 reps com ajuda"></div>
      </form>`;
    Modal.open(`Registrar Carga: ${nome}`, html, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Salvar', class: 'btn-primary', action: () => this.salvarCarga(exerciseId) },
    ]);
  },

  async salvarCarga(exerciseId) {
    const weight = document.getElementById('aluno-carga-peso').value;
    const repsCompleted = document.getElementById('aluno-carga-reps').value;
    const notes = document.getElementById('aluno-carga-obs').value.trim();
    if (!weight || parseFloat(weight) <= 0) { Toast.warning('Informe a carga utilizada.'); return; }
    try {
      await API.post('/treinos/carga', { exerciseId, weight: parseFloat(weight), repsCompleted: repsCompleted ? parseInt(repsCompleted) : null, notes: notes || null });
      Toast.success('Carga registrada com sucesso!');
      Modal.close();
      await this.inicializar();
    } catch (error) {
      Toast.error(error.message || 'Erro ao registrar carga.');
    }
  }
};

// ============================================
// 3. HISTÓRICO DE CARGAS (EVOLUÇÃO)
// ============================================
const AlunoHistoricoView = {
  async inicializar() {
    const container = document.getElementById('aluno-historico-container');
    if (!container) return;
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Carregando histórico...</span></div>';
    try {
      const resp = await API.get('/aluno/historico-carga');
      this.renderizar(container, resp.data);
    } catch (error) {
      container.innerHTML = '<div class="alert alert-error">Erro ao carregar histórico de cargas.</div>';
    }
  },

  renderizar(container, grupos) {
    if (!grupos || grupos.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:3rem"><i data-lucide="trending-up" style="width:64px;height:64px;opacity:0.3;margin-bottom:1rem"></i><h3 style="color:var(--text-primary)">Sem registros de carga</h3><p style="color:var(--text-muted)">Registre cargas nos seus treinos para ver sua evolução aqui.</p></div>';
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = `<div class="aluno-section-title"><i data-lucide="trending-up"></i> Evolução de Cargas</div>` +
      grupos.map(g => {
        const registros = g.registros.slice(0, 8).map(r => {
          const data = new Date(r.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          return `<div class="aluno-evolucao-reg-item"><span class="aluno-evolucao-reg-peso">${r.peso}kg${r.reps ? ` × ${r.reps}` : ''}</span><span class="aluno-evolucao-reg-data">${data}</span></div>`;
        }).join('');
        return `
          <div class="aluno-evolucao-card">
            <div class="aluno-evolucao-header">
              <span class="aluno-evolucao-nome">${g.exercicioNome}</span>
              ${g.grupoMuscular ? `<span class="aluno-evolucao-grupo">${g.grupoMuscular}</span>` : ''}
            </div>
            <div class="aluno-evolucao-registros">${registros}</div>
          </div>`;
      }).join('');
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  }
};

// ============================================
// 4. MENSALIDADE (STATUS FINANCEIRO)
// ============================================
const AlunoMensalidadeView = {
  async inicializar() {
    const container = document.getElementById('aluno-mensalidade-container');
    if (!container) return;
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Carregando dados financeiros...</span></div>';
    try {
      const resp = await API.get('/aluno/mensalidade');
      this.renderizar(container, resp.data);
    } catch (error) {
      container.innerHTML = '<div class="alert alert-error">Erro ao carregar dados financeiros.</div>';
    }
  },

  renderizar(container, dados) {
    const statusLabels = { em_dia: 'Em dia', vencendo: 'Vencendo em breve', vencido: 'Vencida', bloqueado: 'Bloqueado', indefinido: 'Sem informação' };
    const statusIcons = { em_dia: 'check-circle', vencendo: 'clock', vencido: 'alert-circle', bloqueado: 'x-circle', indefinido: 'help-circle' };
    const s = dados.statusVisual;
    const label = statusLabels[s] || 'Indefinido';
    const icon = statusIcons[s] || 'help-circle';

    const alertaHtml = dados.statusAluno === 'blocked' ? '<div class="aluno-banner-blocked"><i data-lucide="alert-triangle"></i><span class="banner-text">Matrícula bloqueada por inadimplência. Procure a recepção para regularizar.</span></div>' : '';
    const vencimento = dados.vencimento ? new Date(dados.vencimento).toLocaleDateString('pt-BR') : '—';
    const diasRest = dados.diasRestantes !== null ? (dados.diasRestantes > 0 ? `${dados.diasRestantes} dias` : 'Vencida') : '—';

    const pagamentosHtml = (dados.historicoPagamentos || []).map(p => {
      const icone = p.status === 'paid' ? 'pago' : 'pendente';
      const statusBadge = p.status === 'paid' ? '<span class="badge badge-success">Pago</span>' : p.status === 'overdue' ? '<span class="badge badge-error">Atrasado</span>' : '<span class="badge badge-warning">Pendente</span>';
      const data = new Date(p.dataPagamento).toLocaleDateString('pt-BR');
      return `<div class="aluno-historico-item"><div class="aluno-historico-icone ${icone}"><i data-lucide="${p.status === 'paid' ? 'check-circle' : 'clock'}"></i></div><div class="aluno-historico-info"><div class="aluno-historico-titulo">R$ ${parseFloat(p.valor).toFixed(2)} ${statusBadge}</div><div class="aluno-historico-sub">${p.metodo || '—'} · ${p.plano}</div></div><div class="aluno-historico-data">${data}</div></div>`;
    }).join('');

    const btnPagar = s !== 'em_dia' ? `
      <div style="margin-top: 1.5rem;">
        <button class="btn btn-primary btn-block" onclick="AlunoMensalidadeView.abrirCheckout()">
          <i data-lucide="credit-card"></i> Pagar Mensalidade Agora
        </button>
      </div>
    ` : '';

    container.innerHTML = `
      ${alertaHtml}
      <div class="aluno-status-card">
        <div class="aluno-status-badge ${s}"><i data-lucide="${icon}"></i> ${label}</div>
        <div class="aluno-status-body">
          <div class="aluno-status-detalhes">
            <div class="aluno-status-item"><label>Plano</label><span>${dados.plano?.nome || '—'}</span></div>
            <div class="aluno-status-item"><label>Valor</label><span>${dados.plano ? 'R$ ' + parseFloat(dados.plano.preco).toFixed(2) : '—'}</span></div>
            <div class="aluno-status-item"><label>Vencimento</label><span>${vencimento}</span></div>
            <div class="aluno-status-item"><label>Restante</label><span>${diasRest}</span></div>
          </div>
          ${btnPagar}
        </div>
      </div>
      ${pagamentosHtml ? `<div class="aluno-section"><div class="aluno-section-title"><i data-lucide="receipt"></i> Últimos Pagamentos</div><div class="aluno-historico-lista">${pagamentosHtml}</div></div>` : ''}
    `;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },

  abrirCheckout() {
    const html = `
      <div class="checkout-container">
        <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">Escolha a forma de pagamento preferida para renovar sua mensalidade:</p>
        
        <div class="checkout-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
          <button class="btn btn-outline-primary active" id="tab-pix" onclick="AlunoMensalidadeView.mudarTabCheckout('pix')">PIX</button>
          <button class="btn btn-outline-primary" id="tab-card" onclick="AlunoMensalidadeView.mudarTabCheckout('card')">Cartão</button>
          <button class="btn btn-outline-primary" id="tab-boleto" onclick="AlunoMensalidadeView.mudarTabCheckout('boleto')">Boleto</button>
        </div>

        <div id="checkout-content" style="min-height: 200px;">
          ${this._renderPix()}
        </div>
      </div>
    `;

    Modal.open('Checkout FitFlow', html, [
      { text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Confirmar Pagamento', id: 'btn-confirmar-pagamento', class: 'btn-primary', action: () => this.confirmarPagamento() },
    ]);
  },

  mudarTabCheckout(tipo) {
    const content = document.getElementById('checkout-content');
    const tabs = ['pix', 'card', 'boleto'];
    
    tabs.forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.classList.remove('active');
    });

    const activeTab = document.getElementById(`tab-${tipo}`);
    if (activeTab) activeTab.classList.add('active');

    if (tipo === 'pix') content.innerHTML = this._renderPix();
    if (tipo === 'card') content.innerHTML = this._renderCard();
    if (tipo === 'boleto') content.innerHTML = this._renderBoleto();
    
    if (window.lucide) lucide.createIcons({ nodes: [content] });
  },

  _renderPix() {
    return `
      <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        <div style="background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=fitflow-pix-mockup" alt="QR Code PIX" style="display: block;">
        </div>
        <div style="width: 100%;">
          <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">Copia e Cola (Chave Aleatória)</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" value="00020126580014br.gov.bcb.pix0136e2f1b8a-9801-4757-9c81-f97d164964f7" readonly style="flex: 1; font-family: monospace; font-size: 0.75rem;">
            <button class="btn btn-sm btn-outline-secondary" onclick="Toast.info('Chave copiada!')"><i data-lucide="copy" style="width:14px;height:14px"></i></button>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary);"><i data-lucide="info" style="width:14px;height:14px;vertical-align:middle;"></i> Após o pagamento, o sistema identificará automaticamente em alguns segundos.</p>
        <input type="hidden" id="checkout-method" value="Pix">
      </div>
    `;
  },

  _renderCard() {
    return `
      <div class="form-grid" style="gap: 1rem;">
        <div class="form-group" style="grid-column: span 2;">
          <label>Número do Cartão</label>
          <input type="text" placeholder="0000 0000 0000 0000" maxlength="19">
        </div>
        <div class="form-group">
          <label>Validade</label>
          <input type="text" placeholder="MM/AA" maxlength="5">
        </div>
        <div class="form-group">
          <label>CVV</label>
          <input type="text" placeholder="123" maxlength="3">
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label>Nome no Cartão</label>
          <input type="text" placeholder="Como impresso no cartão">
        </div>
        <input type="hidden" id="checkout-method" value="Cartão de Crédito">
      </div>
    `;
  },

  _renderBoleto() {
    return `
      <div style="text-align: center; padding: 1.5rem 0; display: flex; flex-direction: column; gap: 1rem;">
        <i data-lucide="barcode" style="width: 64px; height: 64px; margin: 0 auto; opacity: 0.5;"></i>
        <p>O boleto será gerado e enviado para seu e-mail cadastrado.</p>
        <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border: 1px dashed var(--border-color);">
          <code style="font-size: 0.9rem;">34191.09008 63561.760009 12345.670007 8 95820000015000</code>
        </div>
        <button class="btn btn-outline-secondary btn-sm" onclick="Toast.info('Código de barras copiado!')">Copiar Código</button>
        <input type="hidden" id="checkout-method" value="Boleto">
      </div>
    `;
  },

  async confirmarPagamento() {
    const btn = document.getElementById('btn-confirmar-pagamento');
    const metodo = document.getElementById('checkout-method')?.value || 'Simulado';
    
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner spinner-sm" style="border-top-color:white"></div> Processando...';
    }

    try {
      // Simula delay de processamento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await API.post('/aluno/checkout', { paymentMethod: metodo });
      
      Toast.success('Pagamento confirmado com sucesso! Sua matrícula foi renovada.');
      Modal.close();
      this.inicializar(); // Recarrega tela de mensalidade
      
      // Se estiver no dashboard, recarrega também
      if (typeof AlunoPainelView !== 'undefined' && AlunoPainelView.dados) {
        AlunoPainelView.inicializar();
      }
    } catch (error) {
      Toast.error('Erro ao confirmar pagamento: ' + error.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Confirmar Pagamento';
      }
    }
  }
};

// ============================================
// 5. CHECK-IN E FREQUÊNCIA
// ============================================
const AlunoCheckinView = {
  studentId: null,
  bloqueado: false,

  async inicializar() {
    const container = document.getElementById('aluno-checkin-container');
    if (!container) return;
    container.innerHTML = '<div class="page-loading"><div class="spinner"></div><span>Carregando...</span></div>';
    try {
      // Busca painel para pegar studentId e status
      const painelResp = await API.get('/aluno/painel');
      this.studentId = painelResp.data.perfil.id;
      this.bloqueado = painelResp.data.perfil.status === 'blocked';

      const checkinsResp = await API.get('/aluno/checkins?limit=15');
      this.renderizar(container, checkinsResp.data, painelResp.data);
    } catch (error) {
      container.innerHTML = '<div class="alert alert-error">Erro ao carregar check-ins.</div>';
    }
  },

  renderizar(container, checkinsData, painelData) {
    const alertaHtml = this.bloqueado ? '<div class="aluno-banner-blocked"><i data-lucide="alert-triangle"></i><span class="banner-text">Matrícula bloqueada. Check-in indisponível até regularização.</span></div>' : '';
    const btnDisabled = this.bloqueado ? 'disabled' : '';

    const historicoHtml = (checkinsData.checkins || []).map(c => {
      const data = new Date(c.data).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
      const isCancelled = c.status === 'cancelled';
      const icone = isCancelled ? 'cancel' : 'check';
      const icon = isCancelled ? 'x-circle' : 'check-circle';
      const titulo = isCancelled ? 'Cancelado' : 'Presente';
      return `<div class="aluno-historico-item"><div class="aluno-historico-icone ${icone}"><i data-lucide="${icon}"></i></div><div class="aluno-historico-info"><div class="aluno-historico-titulo">${titulo}</div></div><div class="aluno-historico-data">${data}</div></div>`;
    }).join('');

    container.innerHTML = `
      ${alertaHtml}
      <div class="aluno-checkin-container">
        <div style="text-align:center">
          <div class="aluno-kpi-value" style="font-size:var(--font-size-4xl)">${checkinsData.totalMes || 0}</div>
          <div class="aluno-kpi-label" style="font-size:var(--font-size-sm)">Check-ins este mês</div>
        </div>
        <button class="aluno-checkin-btn" id="btn-aluno-checkin" onclick="AlunoCheckinView.fazerCheckin()" ${btnDisabled}>
          <i data-lucide="calendar-check"></i> Fazer Check-in
        </button>
        <div class="aluno-checkin-feedback" id="checkin-feedback"></div>
      </div>
      ${historicoHtml ? `<div class="aluno-section"><div class="aluno-section-title"><i data-lucide="history"></i> Histórico de Presença</div><div class="aluno-historico-lista">${historicoHtml}</div></div>` : ''}
    `;
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  },

  async fazerCheckin() {
    if (this.bloqueado) { Toast.error('Check-in indisponível — matrícula bloqueada.'); return; }
    const btn = document.getElementById('btn-aluno-checkin');
    const feedback = document.getElementById('checkin-feedback');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm" style="border-top-color:white"></div> Registrando...';

    try {
      await API.post('/checkins', { studentId: this.studentId });
      btn.classList.add('success');
      btn.innerHTML = '<i data-lucide="check"></i> Check-in realizado!';
      feedback.className = 'aluno-checkin-feedback ok';
      feedback.textContent = 'Presença registrada com sucesso!';
      Toast.success('Check-in realizado!');
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
      // Recarrega após 2s
      setTimeout(() => this.inicializar(), 2000);
    } catch (error) {
      btn.classList.add('error');
      btn.innerHTML = '<i data-lucide="x"></i> Erro';
      feedback.className = 'aluno-checkin-feedback fail';
      feedback.textContent = error.message || 'Não foi possível registrar.';
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
      setTimeout(() => {
        btn.classList.remove('error');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="calendar-check"></i> Fazer Check-in';
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
      }, 3000);
    }
  }
};
