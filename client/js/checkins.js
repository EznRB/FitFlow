/**
 * ============================================================================
 * FitFlow Caraguá — Módulo de Check-ins do Frontend (TASK 08)
 * ============================================================================
 * Gerencia a interface de presença e frequência do sistema:
 * - Registro rápido de check-in (admin seleciona aluno / aluno self-checkin)
 * - KPIs do dia (total de check-ins hoje)
 * - Tabela de check-ins com filtros por data e aluno
 * - Modal de cancelamento administrativo com motivo obrigatório
 * - Ranking de frequência dos alunos
 * 
 * Segue o mesmo padrão de PagamentosView (TASK 07).
 */

const CheckinsView = {
  dados: [],
  alunos: [],
  filtroAtual: { studentId: '', startDate: '', endDate: '' },

  /**
   * Ponto de entrada: carrega dados e configura eventos.
   * Chamado pelo App.renderPage('checkins').
   */
  async inicializar() {
    // Detecta se é admin ou aluno
    const user = Auth.user || Auth.getLocalUser();
    this.isAdmin = user && user.role === 'admin';

    if (this.isAdmin) {
      await Promise.all([
        this.carregarKPIs(),
        this.carregarLista(),
        this.carregarAlunos(),
      ]);
      this.configurarEventos();
    } else {
      // Visão do aluno: exibe apenas self-checkin
      await this.renderVisaoAluno();
    }
  },

  // ============================================================================
  // KPIs DO DIA
  // ============================================================================

  /**
   * Carrega e exibe os indicadores do dia atual.
   */
  async carregarKPIs() {
    try {
      const resp = await API.get('/checkins/hoje');
      const resumo = resp.data;

      const totalEl = document.getElementById('kpi-checkins-total');
      if (totalEl) totalEl.textContent = resumo.totalHoje || 0;

      // Último check-in do dia
      const ultimoEl = document.getElementById('kpi-ultimo-checkin');
      if (ultimoEl) {
        if (resumo.checkins && resumo.checkins.length > 0) {
          const ultimo = resumo.checkins[0];
          ultimoEl.textContent = `${ultimo.alunoNome} às ${ultimo.horario}`;
        } else {
          ultimoEl.textContent = 'Nenhum ainda';
        }
      }
    } catch (e) {
      console.warn('CheckinsView: erro ao carregar KPIs', e.message);
    }
  },

  // ============================================================================
  // LISTA PRINCIPAL DE CHECK-INS
  // ============================================================================

  /**
   * Busca a lista de alunos para o select de filtro e formulário.
   */
  async carregarAlunos() {
    try {
      const resp = await API.get('/alunos');
      this.alunos = resp.data || [];
      this.popularFiltroAluno();
    } catch (e) {
      console.warn('CheckinsView: erro ao carregar alunos', e.message);
    }
  },

  /**
   * Inicializa o Autocomplete para filtro de aluno.
   */
  popularFiltroAluno() {
    if (typeof Autocomplete !== 'undefined') {
      const autocompleteData = this.alunos.map(a => ({
        id: a.id,
        label: a.user ? a.user.name : `Aluno #${a.id}`
      }));
      Autocomplete.init('filtro-aluno-checkin', autocompleteData, (selected) => {
        this.filtroAtual.studentId = selected ? selected.id : '';
        this.carregarLista();
      });
    }
  },

  /**
   * Carrega a lista principal de check-ins com filtros.
   */
  async carregarLista() {
    const tbody = document.getElementById('checkins-table-body');
    if (!tbody) return;

    try {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;">
        <div class="spinner spinner-sm" style="margin:0 auto;"></div>
        <p style="margin-top:0.5rem; color:var(--text-muted)">Carregando check-ins...</p>
      </td></tr>`;

      // Monta query string com filtros
      let queryParts = [];
      if (this.filtroAtual.studentId) queryParts.push(`studentId=${this.filtroAtual.studentId}`);
      if (this.filtroAtual.startDate) queryParts.push(`startDate=${this.filtroAtual.startDate}`);
      if (this.filtroAtual.endDate) queryParts.push(`endDate=${this.filtroAtual.endDate}`);
      queryParts.push('incluirCancelados=true'); // Admin vê tudo
      const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const resp = await API.get(`/checkins${query}`);
      this.dados = resp.data || [];

      if (this.dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted)">
          Nenhum check-in encontrado no período selecionado.
        </td></tr>`;
        return;
      }

      tbody.innerHTML = this.dados.map(c => {
        const nomeAluno = c.student?.user?.name || '—';
        const emailAluno = c.student?.user?.email || '';
        const dataCheckin = this.formatarData(c.checkinDate);
        const horaCheckin = c.createdAt
          ? new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '—';
        const statusBadge = this.renderBadgeStatus(c.status);

        // Botão de cancelar (só para check-ins presentes)
        const acoes = c.status === 'present'
          ? `<button class="btn-icon" title="Cancelar check-in" onclick="CheckinsView.abrirModalCancelar(${c.id}, '${nomeAluno.replace(/'/g, "\\'")}')">
               <i data-lucide="x-circle"></i>
             </button>`
          : `<span style="font-size:0.7rem; color:var(--text-muted)" title="Motivo: ${(c.cancelReason || '').replace(/"/g, '&quot;')}">
               <i data-lucide="info" style="width:14px; height:14px;"></i>
             </span>`;

        return `
          <tr style="${c.status === 'cancelled' ? 'opacity:0.5;' : ''}">
            <td>
              <div style="font-weight:600">${nomeAluno}</div>
              <div style="font-size:0.75rem; color:var(--text-muted)">${emailAluno}</div>
            </td>
            <td>${dataCheckin}</td>
            <td>${horaCheckin}</td>
            <td>${statusBadge}</td>
            <td>
              <div class="table-actions">${acoes}</div>
            </td>
          </tr>
        `;
      }).join('');

      // Recria ícones Lucide
      if (window.lucide) lucide.createIcons({ nodes: [tbody] });

    } catch (error) {
      Toast.error('Erro ao carregar check-ins: ' + error.message);
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--error); text-align:center; padding:2rem;">
        Erro ao carregar dados de presença.
      </td></tr>`;
    }
  },

  // ============================================================================
  // EVENTOS
  // ============================================================================

  /**
   * Configura os listeners de clique nos botões da página.
   */
  configurarEventos() {
    // Botão de registrar check-in
    const btnRegistrar = document.getElementById('btn-registrar-checkin');
    if (btnRegistrar) btnRegistrar.onclick = () => this.abrirModalRegistro();

    // Botão de ver ranking
    const btnRanking = document.getElementById('btn-ver-ranking');
    if (btnRanking) btnRanking.onclick = () => this.abrirModalRanking();

    // Filtro de aluno agora é tratado pelo Autocomplete (ver popularFiltroAluno)

    // Filtro de data (início e fim)
    const filtroInicio = document.getElementById('filtro-data-inicio');
    const filtroFim = document.getElementById('filtro-data-fim');
    if (filtroInicio) {
      filtroInicio.onchange = () => {
        this.filtroAtual.startDate = filtroInicio.value;
        if (this.filtroAtual.endDate) this.carregarLista();
      };
    }
    if (filtroFim) {
      filtroFim.onchange = () => {
        this.filtroAtual.endDate = filtroFim.value;
        if (this.filtroAtual.startDate) this.carregarLista();
      };
    }
  },

  // ============================================================================
  // MODAL DE REGISTRO DE CHECK-IN
  // ============================================================================

  /**
   * Abre o modal para registrar um novo check-in (visão admin).
   * Admin seleciona o aluno de uma lista.
   */
  abrirModalRegistro() {
    const opcoesAlunos = this.alunos
      .filter(a => a.status === 'active')
      .map(a => {
        const nome = a.user ? a.user.name : `Aluno #${a.id}`;
        return `<option value="${a.id}">${nome}</option>`;
      }).join('');

    const bodyHTML = `
      <form id="form-checkin" class="form-grid">
        <div class="form-group" style="grid-column: span 2;">
          <label>Selecione o Aluno *</label>
          <select id="input-checkin-aluno" required>
            <option value="">Selecione o aluno</option>
            ${opcoesAlunos}
          </select>
        </div>
      </form>
      <div style="background:var(--bg-elevated); border-radius:var(--radius-md); padding:0.75rem 1rem; margin-top:0.75rem;">
        <p style="font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="info" style="width:16px; height:16px; flex-shrink:0;"></i>
          O check-in será registrado com a data e horário atuais. Se o aluno já tiver check-in hoje, o sistema impedirá a duplicidade.
        </p>
      </div>
    `;

    Modal.open('Registrar Check-in', bodyHTML, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Confirmar Presença', class: 'btn-success', action: () => this.submeterCheckin() },
    ]);

    // Recria ícones no modal
    setTimeout(() => {
      const modalBody = document.getElementById('modal-body');
      if (modalBody && window.lucide) lucide.createIcons({ nodes: [modalBody] });
    }, 100);
  },

  /**
   * Submete o registro de check-in via API.
   */
  async submeterCheckin() {
    const studentId = document.getElementById('input-checkin-aluno')?.value;

    if (!studentId) {
      Toast.error('Selecione o aluno.');
      return;
    }

    try {
      // Feedback visual no botão
      const btns = document.querySelectorAll('#modal-footer .btn-success');
      if (btns.length > 0) {
        btns[0].disabled = true;
        btns[0].innerHTML = '<div class="spinner spinner-sm"></div> Registrando...';
      }

      await API.post('/checkins', { studentId: parseInt(studentId) });
      Toast.success('Check-in registrado com sucesso! ✅');
      Modal.close();

      // Recarrega dados
      this.carregarKPIs();
      this.carregarLista();
    } catch (error) {
      Toast.error(error.message || 'Erro ao registrar check-in.');
    } finally {
      const btns = document.querySelectorAll('#modal-footer .btn-success');
      if (btns.length > 0) {
        btns[0].disabled = false;
        btns[0].innerHTML = 'Confirmar Presença';
      }
    }
  },

  // ============================================================================
  // MODAL DE CANCELAMENTO (FLUXO ADMINISTRATIVO)
  // ============================================================================

  /**
   * Abre o modal para cancelar um check-in com motivo obrigatório.
   * ⚠️ Não deleta — marca como 'cancelled' para preservar histórico.
   */
  abrirModalCancelar(checkinId, nomeAluno) {
    const bodyHTML = `
      <div style="margin-bottom:1rem;">
        <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-md); padding:1rem; margin-bottom:1rem;">
          <p style="color:var(--error); font-weight:600; display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
            <i data-lucide="alert-triangle" style="width:18px; height:18px;"></i>
            Atenção — Cancelamento de Check-in
          </p>
          <p style="font-size:0.85rem; color:var(--text-secondary);">
            Você está cancelando o check-in de <strong>${nomeAluno}</strong>.
            O registro NÃO será deletado — será marcado como cancelado com o motivo informado para fins de auditoria.
          </p>
        </div>
        <div class="form-group">
          <label>Motivo do cancelamento *</label>
          <textarea id="input-cancel-motivo" rows="3" placeholder="Descreva o motivo do cancelamento (mínimo 5 caracteres)..." required></textarea>
        </div>
      </div>
    `;

    Modal.open('Cancelar Check-in', bodyHTML, [
      { text: 'Voltar', class: 'btn-secondary', action: () => Modal.close() },
      { text: 'Confirmar Cancelamento', class: 'btn-danger', action: () => this.submeterCancelamento(checkinId) },
    ]);

    // Recria ícones no modal
    setTimeout(() => {
      const modalBody = document.getElementById('modal-body');
      if (modalBody && window.lucide) lucide.createIcons({ nodes: [modalBody] });
    }, 100);
  },

  /**
   * Submete o cancelamento do check-in via API.
   */
  async submeterCancelamento(checkinId) {
    const motivo = document.getElementById('input-cancel-motivo')?.value?.trim();

    if (!motivo || motivo.length < 5) {
      Toast.error('Informe o motivo do cancelamento (mínimo 5 caracteres).');
      return;
    }

    try {
      const btns = document.querySelectorAll('#modal-footer .btn-danger');
      if (btns.length > 0) {
        btns[0].disabled = true;
        btns[0].innerHTML = 'Processando...';
      }

      await API.put(`/checkins/${checkinId}/cancelar`, { motivo });
      Toast.success('Check-in cancelado com sucesso. Registro preservado para auditoria.');
      Modal.close();

      // Recarrega dados
      this.carregarKPIs();
      this.carregarLista();
    } catch (error) {
      Toast.error(error.message || 'Erro ao cancelar check-in.');
    } finally {
      const btns = document.querySelectorAll('#modal-footer .btn-danger');
      if (btns.length > 0) {
        btns[0].disabled = false;
        btns[0].innerHTML = 'Confirmar Cancelamento';
      }
    }
  },

  // ============================================================================
  // MODAL DE RANKING DE FREQUÊNCIA
  // ============================================================================

  /**
   * Abre modal com ranking de frequência dos alunos.
   */
  async abrirModalRanking() {
    try {
      const resp = await API.get('/checkins/frequencia?dias=30');
      const ranking = resp.data || [];

      let bodyHTML;

      if (ranking.length === 0) {
        bodyHTML = `
          <div class="empty-state" style="padding:2rem;">
            <i data-lucide="calendar-x" style="width:48px; height:48px; opacity:0.5"></i>
            <h3 style="margin-top:1rem;">Nenhum check-in registrado</h3>
            <p style="color:var(--text-muted)">Ainda não há registros de frequência nos últimos 30 dias.</p>
          </div>
        `;
      } else {
        bodyHTML = `
          <p style="color:var(--text-muted); margin-bottom:1rem; font-size:0.85rem;">
            Ranking de presença dos últimos 30 dias (${ranking.length} alunos com check-ins).
          </p>
          <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:400px; overflow-y:auto;">
            ${ranking.map((r, idx) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
              const barWidth = ranking[0] ? Math.round((r.totalCheckins / ranking[0].totalCheckins) * 100) : 0;

              return `
                <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.75rem; background:var(--bg-elevated); border-radius:var(--radius-md);">
                  <span style="font-size:1.1rem; min-width:32px; text-align:center;">${medal}</span>
                  <div style="flex:1;">
                    <div style="font-weight:600; font-size:0.9rem;">${r.nome}</div>
                    <div style="background:var(--bg-secondary); border-radius:4px; height:6px; margin-top:4px; overflow:hidden;">
                      <div style="width:${barWidth}%; height:100%; background: linear-gradient(90deg, var(--primary-400), var(--primary-600)); border-radius:4px; transition: width 0.5s ease;"></div>
                    </div>
                  </div>
                  <span style="font-weight:700; color:var(--primary-400); font-size:0.95rem; min-width:60px; text-align:right;">
                    ${r.totalCheckins} dia${r.totalCheckins !== 1 ? 's' : ''}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      Modal.open('🏆 Ranking de Frequência', bodyHTML, [
        { text: 'Fechar', class: 'btn-secondary', action: () => Modal.close() },
      ]);

      // Recria ícones Lucide no modal
      setTimeout(() => {
        const modalBody = document.getElementById('modal-body');
        if (modalBody && window.lucide) lucide.createIcons({ nodes: [modalBody] });
      }, 50);

    } catch (error) {
      Toast.error('Erro ao carregar ranking: ' + error.message);
    }
  },

  // ============================================================================
  // VISÃO DO ALUNO (SELF-CHECKIN)
  // ============================================================================

  /**
   * Renderiza a interface simplificada para o aluno fazer self-checkin.
   * Exibe status do dia e botão de registrar.
   */
  async renderVisaoAluno() {
    const container = document.getElementById('checkins-aluno-container');
    if (!container) return;

    try {
      // Tenta fazer check-in e verifica o status
      container.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem;">
          <div class="spinner"></div>
          <p style="margin-top:1rem; color:var(--text-muted)">Verificando seu check-in...</p>
        </div>
      `;

      // Tenta buscar resumo (pode falhar se não for admin)
      let jaFezCheckin = false;
      try {
        // Tenta registrar — se 409, já fez
        await API.post('/checkins', {});
        jaFezCheckin = true; // Se passou sem erro, acabou de registrar
        Toast.success('Check-in registrado automaticamente! 🎉');
      } catch (err) {
        if (err.status === 409) {
          jaFezCheckin = true;
        } else if (err.status === 403) {
          // Aluno bloqueado
          container.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem;">
              <i data-lucide="shield-alert" style="width:64px; height:64px; color:var(--error); opacity:0.7;"></i>
              <h3 style="margin-top:1rem; color:var(--error);">Acesso Bloqueado</h3>
              <p style="color:var(--text-muted); margin-top:0.5rem;">
                Seu acesso está bloqueado por pendência financeira.<br>
                Procure a recepção para regularizar sua situação.
              </p>
            </div>
          `;
          if (window.lucide) lucide.createIcons({ nodes: [container] });
          return;
        } else {
          throw err;
        }
      }

      if (jaFezCheckin) {
        container.innerHTML = `
          <div style="text-align:center; padding:3rem 1rem;">
            <div style="width:80px; height:80px; border-radius:50%; background:rgba(34,197,94,0.15); display:flex; align-items:center; justify-content:center; margin:0 auto;">
              <i data-lucide="check-circle" style="width:48px; height:48px; color:var(--success);"></i>
            </div>
            <h3 style="margin-top:1.5rem; color:var(--success);">Presença Confirmada! ✅</h3>
            <p style="color:var(--text-muted); margin-top:0.5rem;">
              Seu check-in de hoje já está registrado.<br>
              Bom treino! 💪
            </p>
          </div>
        `;
      }

      if (window.lucide) lucide.createIcons({ nodes: [container] });

    } catch (error) {
      container.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem; color:var(--error);">
          <i data-lucide="wifi-off" style="width:48px; height:48px; opacity:0.5;"></i>
          <h3 style="margin-top:1rem;">Erro ao verificar check-in</h3>
          <p style="color:var(--text-muted);">${error.message}</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ nodes: [container] });
    }
  },

  // ============================================================================
  // HELPERS DE FORMATAÇÃO
  // ============================================================================

  /**
   * Formata uma data ISO para DD/MM/AAAA.
   */
  formatarData(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  },

  /**
   * Renderiza badge de status do check-in.
   */
  renderBadgeStatus(status) {
    const map = {
      present: '<span class="badge badge-success">Presente</span>',
      cancelled: '<span class="badge badge-error">Cancelado</span>',
    };
    return map[status] || `<span class="badge badge-neutral">${status}</span>`;
  },
};
