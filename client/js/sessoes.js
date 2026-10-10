'use strict';
// Account identity comes only from Auth.user after the application's /auth/me check.
const SessoesView = {
  store: null, storeIdentity: null, storeRequest: null, accountCleanups: new Map(), userId: null, container: null, workouts: [], summary: null, renderGeneration: 0, syncing: null, renderedSessionKey: null,
  identity() {
    return { userId: Auth.user?.id, role: Auth.user?.role, generation: Auth.generation,
      epoch: typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null };
  },
  sameIdentity(a, b) { return a && b && a.userId === b.userId && a.role === b.role && a.generation === b.generation && a.epoch === b.epoch; },
  ownsIdentity(identity) {
    const sharedEpoch = typeof Auth.getSessionEpoch === 'function' ? Auth.getSessionEpoch() : null;
    return this.sameIdentity(identity, this.identity()) && identity.epoch === sharedEpoch;
  },
  context(store = this.store) { return { store, identity: this.identity(), container: this.container, renderGeneration: this.renderGeneration }; },
  ownsContext(context) {
    return context && context.store === this.store && this.ownsIdentity(context.identity) &&
      context.container === this.container && context.renderGeneration === this.renderGeneration;
  },
  obsolete() { const error = new Error('A sessão mudou. Atualize a tela para continuar.'); error.obsolete = true; return error; },
  async ensureStore() {
    const identity = this.identity();
    if (!identity.userId || identity.role !== 'student') throw new Error('Entre com sua conta de aluno para registrar sessões.');
    // Auth.user still belongs to the observed cookie epoch until the storage
    // event is delivered. Never relabel that account with another tab's epoch.
    if (!this.ownsIdentity(identity)) throw this.obsolete();
    if (this.store && this.sameIdentity(this.storeIdentity, identity)) return this.store;
    if (this.storeRequest && this.sameIdentity(this.storeRequest.identity, identity)) return this.storeRequest.promise;
    const previous = this.store, request = { identity };
    this.storeRequest = request; this.store = null; this.storeIdentity = null; this.userId = null;
    request.promise = (async () => {
      // The logout event is asynchronous. A new instance for this account must
      // not write records that an earlier explicit logout is about to delete.
      const cleanup = this.accountCleanups.get(identity.userId);
      if (cleanup) await cleanup;
      if (previous) await previous.dispose();
      if (this.storeRequest !== request || !this.ownsIdentity(identity)) throw this.obsolete();
      const store = FitFlowTrainingStore.createTrainingStore({ userId: identity.userId,
        send: (path, payload) => API.post(path, payload),
        isCurrentUser: () => this.store === store && this.ownsIdentity(identity),
        onChange: state => { if (this.store === store && this.ownsIdentity(identity) && this.current()) this.updateIndicators(state); },
      });
      this.userId = identity.userId; this.storeIdentity = identity; this.store = store;
      return store;
    })().finally(() => { if (this.storeRequest === request) this.storeRequest = null; });
    return request.promise;
  },
  current() { return this.container?.isConnected && this.container.querySelector('[data-session-page]') && Auth.user?.id === this.userId && Auth.user?.role === 'student' && (!this.storeIdentity || this.ownsIdentity(this.storeIdentity)); },
  escape(value) { return FitFlowSecurity.escapeHtml(value); },
  async render(container) {
    const generation = ++this.renderGeneration, identity = this.identity();
    this.container = container; this.summary = null;
    container.innerHTML = `<section class="sessions-page" data-session-page>
      <header class="sessions-header"><div><p class="sessions-eyebrow">REGISTRO DE TREINO</p><h2>Sessões e séries</h2><p>Registre o que você executou na ficha do instrutor.</p></div><button class="btn btn-secondary" type="button" data-sync>Sincronizar</button></header>
      <p class="sessions-sync" role="status" aria-live="polite" data-sync-status>Carregando a fila deste dispositivo…</p>
      <p class="sessions-message" role="alert" data-session-error hidden></p>
      <div data-active-session></div><div data-workouts></div><div data-week-summary></div><div data-session-history></div>
      <aside class="sessions-evidence"><h3>Como ler seus registros</h3><p>Volume é a soma de carga × repetições das séries registradas. Aquecimentos ficam separados. Com peso corporal, 0 kg representa carga externa declarada; não estima o peso movimentado.</p><p>Séries diretas usam somente o grupo muscular informado na ficha. Finalizar encerra a sessão e pode deixar séries planejadas sem registro.</p><a href="https://pubmed.ncbi.nlm.nih.gov/41843416/" target="_blank" rel="noopener noreferrer">ACSM 2026: ajustar o treinamento ao objetivo</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/38595233/" target="_blank" rel="noopener noreferrer">Divisão e full body com volume igualado</a></aside>
    </section>`;
    container.querySelector('[data-sync]').onclick = () => {
      if (generation === this.renderGeneration && container === this.container && this.ownsIdentity(identity)) return this.refresh();
    };
    try {
      const store = await this.ensureStore();
      const context = this.context(store);
      if (generation !== this.renderGeneration || !this.ownsIdentity(identity) || !this.ownsContext(context)) return;
      const state = await store.state();
      if (!this.ownsContext(context) || !this.current()) return;
      this.workouts = state.workouts || []; this.draw(state);
      await this.refresh();
    } catch (error) { if (generation === this.renderGeneration && this.ownsIdentity(identity) && !error.obsolete) this.error(error.message); }
  },
  error(message) {
    if (!this.current()) return;
    const node = this.container.querySelector('[data-session-error]'); node.textContent = message || ''; node.hidden = !message;
  },
  async refresh() {
    const operation = this.context();
    if (this.syncing && this.ownsContext(this.syncing)) return;
    this.syncing = operation;
    try {
      const store = await this.ensureStore();
      if (!this.ownsIdentity(operation.identity) || operation.container !== this.container || operation.renderGeneration !== this.renderGeneration) return;
      operation.store = store;
      this.error('');
      await store.flush();
      if (!this.ownsContext(operation)) return;
      if (navigator.onLine) {
        const outcomes = await Promise.allSettled([API.get('/treinos/meus'), API.get('/sessoes/mine')]);
        if (!this.ownsContext(operation)) return;
        if (outcomes[0].status === 'fulfilled') {
          await store.cacheWorkouts(outcomes[0].value.data);
          if (!this.ownsContext(operation)) return;
          this.workouts = outcomes[0].value.data;
        }
        else this.error(outcomes[0].reason.message);
        if (outcomes[1].status === 'fulfilled') {
          await store.mergeHistory(outcomes[1].value.data.sessions);
          if (!this.ownsContext(operation)) return;
          this.summary = outcomes[1].value.data.summary7Days;
          await store.flush();
          if (!this.ownsContext(operation)) return;
        } else this.error(outcomes[1].reason.message);
      }
      const state = await store.state();
      if (this.ownsContext(operation) && this.current()) {
        // Keep a typed set form intact during background synchronization.
        if (!this.container.querySelector('[data-set-form]')) this.draw(state);
        else { this.updateIndicators(state); this.drawHistory(state); this.drawRecords(state); }
      }
    } catch (error) { if (this.ownsContext(operation) && !error.obsolete) this.error(error.message); }
    finally { if (this.syncing === operation) this.syncing = null; }
  },
  updateIndicators(state) {
    if (!this.current()) return;
    const active = state.sessions.find(s => ['active', 'completing'].includes(s.status));
    const key = active ? `${active.id}:${active.status}` : null;
    if (key !== this.renderedSessionKey) { this.draw(state); return; }
    const blocked = state.operations.filter(op => op.status === 'blocked'), pending = state.operations.length;
    const status = this.container.querySelector('[data-sync-status]');
    status.textContent = blocked.length ? `${blocked.length} registro(s) precisam de revisão. ${pending} envio(s) continuam salvos neste dispositivo.`
      : state.syncError || (pending ? `${navigator.onLine ? 'Salvo neste dispositivo' : 'Sem conexão — salvo neste dispositivo'} · ${pending} envio(s) aguardando sincronização.` : state.sessions.some(session => session.status === 'abandoned') ? 'Todos os envios ativos estão sincronizados. Há sessões arquivadas somente neste dispositivo.' : 'Todos os registros deste dispositivo estão sincronizados.');
    status.dataset.state = blocked.length ? 'blocked' : pending ? 'pending' : 'saved';
    if (blocked.length) this.error(blocked.map(op => op.error).filter(Boolean).join(' '));
    const recovery = this.container.querySelector('[data-session-recovery]');
    if (recovery) recovery.hidden = !blocked.some(op => op.sessionId === active?.id);
    this.drawRecords(state); this.drawHistory(state);
  },
  draw(state) {
    if (!this.current()) return;
    const context = this.context();
    const active = state.sessions.find(s => ['active', 'completing'].includes(s.status));
    this.renderedSessionKey = active ? `${active.id}:${active.status}` : null;
    const section = this.container.querySelector('[data-active-session]');
    this.container.querySelector('[data-workouts]').innerHTML = active ? '' : `<section class="sessions-panel"><h3>Iniciar uma sessão</h3><div class="sessions-workouts">${this.workouts.length ? this.workouts.map((w, index) => `<button class="sessions-workout" data-start="${index}" type="button"><strong>${this.escape(w.name)}</strong><span>${w.exercises.length} ${w.exercises.length === 1 ? 'exercício' : 'exercícios'} · ficha do instrutor</span><span>Iniciar treino →</span></button>`).join('') : '<p>Nenhuma ficha disponível. Conecte-se para carregar suas fichas ou peça uma ficha ao instrutor.</p>'}</div></section>`;
    if (active) {
      const plan = active.planSnapshot;
      section.innerHTML = `<section class="sessions-panel"><div class="sessions-header"><div><p class="sessions-eyebrow">${active.status === 'completing' ? 'FINALIZAÇÃO NA FILA' : 'SESSÃO ATUAL'}</p><h3>${this.escape(plan.name)}</h3><p>Iniciada em ${this.escape(new Date(active.clientStartedAt).toLocaleString('pt-BR'))}</p></div>${active.status === 'active' ? '<button class="btn btn-secondary" type="button" data-complete>Finalizar sessão</button>' : ''}</div>
        ${active.status === 'active' ? `<form class="sessions-set-form" data-set-form>
          <label class="sessions-exercise-field">Exercício<select name="exerciseId" required>${plan.exercises.map(e => `<option value="${Number(e.id)}">${this.escape(e.name)}</option>`).join('')}</select></label>
          <p class="sessions-prescription" data-prescription></p>
          <label>Tipo de série<select name="kind"><option value="working">Trabalho</option><option value="warmup">Aquecimento</option></select></label>
          <label>Carga externa (kg)<input name="weightKg" type="number" inputmode="decimal" min="0" max="2000" step="0.01" required placeholder="Ex.: 20"></label>
          <label>Repetições realizadas<input name="reps" type="number" inputmode="numeric" min="1" max="1000" step="1" required placeholder="Ex.: 10"></label>
          <label>RIR (opcional)<input name="rir" type="number" inputmode="decimal" min="0" max="10" step="0.5" placeholder="Ex.: 2"><small>Repetições que você estima ainda conseguir realizar.</small></label>
          <label class="sessions-note-field">Nota da série (opcional)<textarea name="notes" rows="2" maxlength="2000" placeholder="Ex.: técnica, desconforto ou ajuda"></textarea></label>
          <button class="btn btn-primary" type="submit">Salvar série</button><p class="sessions-form-feedback" aria-live="polite" data-set-feedback></p>
        </form>` : '<p>A sessão será finalizada no servidor após sincronizar todas as séries. Seus registros permanecem salvos neste dispositivo.</p>'}
        <div data-set-records></div><aside data-session-recovery hidden><h4>Esta sessão tem envios rejeitados</h4><p>Você pode arquivar os envios desta sessão neste dispositivo e iniciar outra ficha. Os registros ficam disponíveis para conferência abaixo; o FitFlow não substitui exercícios nem confirma séries rejeitadas.</p><button class="btn btn-secondary" type="button" data-abandon-session>Revisar arquivamento da sessão</button></aside></section>`;
      const form = section.querySelector('[data-set-form]');
      if (form) {
        const prescription = () => {
          const exercise = plan.exercises.find(e => e.id === Number(form.elements.exerciseId.value));
          section.querySelector('[data-prescription]').textContent = `Ficha: ${exercise.sets} séries · ${exercise.reps} repetições${exercise.restSeconds === null || exercise.restSeconds === undefined ? ' · pausa não informada' : ` · descanso ${exercise.restSeconds}s`}${exercise.suggestedLoad ? ` · carga sugerida ${exercise.suggestedLoad}` : ''}${exercise.notes ? ` · ${exercise.notes}` : ''}`;
        };
        form.elements.exerciseId.onchange = prescription; prescription();
        form.onsubmit = async event => {
          event.preventDefault(); if (!this.ownsContext(context) || !form.reportValidity()) return;
          const button = form.querySelector('[type="submit"]'); button.disabled = true;
          try {
            await context.store.addSet(active.id, { exerciseId: Number(form.elements.exerciseId.value), kind: form.elements.kind.value,
              weightKg: Number(form.elements.weightKg.value), reps: Number(form.elements.reps.value),
              rir: form.elements.rir.value === '' ? null : Number(form.elements.rir.value), notes: form.elements.notes.value });
            if (!this.ownsContext(context) || !this.current()) return;
            section.querySelector('[data-set-feedback]').textContent = 'Série salva neste dispositivo.';
            form.elements.notes.value = ''; await this.refresh();
          } catch (error) { if (this.ownsContext(context)) this.error(error.message); }
          finally { button.disabled = false; }
        };
      }
      const complete = section.querySelector('[data-complete]');
      if (complete) complete.onclick = async () => {
        if (!this.ownsContext(context)) return;
        complete.disabled = true;
        try { await context.store.complete(active.id); await this.afterMutation(context); }
        catch (error) { if (this.ownsContext(context)) this.error(error.message); complete.disabled = false; }
      };
      section.querySelector('[data-abandon-session]').onclick = () => {
        if (!this.ownsContext(context)) return;
        const store = context.store;
        Modal.confirm('Arquivar esta sessão? Todos os seus envios pendentes deixarão de ser enviados, inclusive séries ainda não enviadas. As séries e os motivos da rejeição ficam somente neste dispositivo até você sair da conta ou limpar seus dados. Registros já confirmados no servidor permanecem no histórico; uma sessão iniciada no servidor poderá continuar incompleta. Você poderá iniciar outra sessão.', async () => {
          if (!this.ownsContext(context)) return;
          try { await store.abandonBlocked(active.id, { confirmed: true }); await this.afterMutation(context); }
          catch (error) { if (this.ownsContext(context)) this.error(error.message); }
        }, 'Arquivar envios e liberar nova sessão');
      };
    } else section.innerHTML = '';
    this.container.querySelectorAll('[data-start]').forEach(button => { button.onclick = async () => {
      if (!this.ownsContext(context)) return;
      button.disabled = true;
      try { await context.store.start(this.workouts[Number(button.dataset.start)]); await this.afterMutation(context); }
      catch (error) { if (this.ownsContext(context)) this.error(error.message); button.disabled = false; }
    }; });
    this.updateIndicators(state);
  },
  async afterMutation(context) {
    if (!this.ownsContext(context) || !this.current()) return;
    const state = await context.store.state();
    if (!this.ownsContext(context) || !this.current()) return;
    this.draw(state); await this.refresh();
  },
  drawRecords(state) {
    const slot = this.container?.querySelector('[data-set-records]'); if (!slot) return;
    const active = state.sessions.find(s => ['active', 'completing'].includes(s.status)); if (!active) return;
    slot.innerHTML = `<h4>Séries desta sessão · ${active.sets.length}</h4>${active.sets.length ? `<ol class="sessions-records">${active.sets.map(set => {
      const exercise = active.planSnapshot.exercises.find(e => e.id === set.exerciseId);
      return `<li><div><strong>${this.escape(set.exerciseName || exercise?.name || 'Exercício registrado')}</strong><span>${set.kind === 'warmup' ? 'Aquecimento' : 'Trabalho'} · ${this.escape(set.weightKg)} kg × ${this.escape(set.reps)} reps${set.rir !== null && set.rir !== undefined ? ` · RIR ${this.escape(set.rir)}` : ''}</span>${set.notes ? `<p>${this.escape(set.notes)}</p>` : ''}</div><span class="sessions-set-state">${set.synced ? 'Sincronizada' : 'Salva no dispositivo'}</span></li>`;
    }).join('')}</ol>` : '<p>Registre cada série após executá-la.</p>'}`;
  },
  drawHistory(state) {
    if (!this.current()) return;
    const recent = state.sessions.filter(s => s.status === 'completed').slice().sort((a, b) => new Date(b.clientStartedAt) - new Date(a.clientStartedAt));
    this.container.querySelector('[data-session-history]').innerHTML = `<section class="sessions-panel"><h3>Histórico de sessões</h3>${recent.length ? recent.slice(0, 30).map(s => {
      const summary = s.summary, sets = s.sets;
      const working = sets.filter(x => x.kind === 'working'), warmup = sets.filter(x => x.kind === 'warmup');
      const volume = rows => rows.reduce((sum, x) => sum + Number(x.weightKg) * Number(x.reps), 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
      return `<details class="sessions-history"><summary><strong>${this.escape(s.planSnapshot.name)}</strong><span>${this.escape(new Date(s.clientStartedAt).toLocaleDateString('pt-BR'))} · ${working.length} ${working.length === 1 ? 'série' : 'séries'} de trabalho · ${volume(working)} kg·reps</span></summary><p>${summary ? `${summary.missingPlannedSets} ${summary.missingPlannedSets === 1 ? 'série planejada ficou' : 'séries planejadas ficaram'} sem registro.` : 'Sessão finalizada; contagem baseada nos registros disponíveis.'} Aquecimentos: ${warmup.length} ${warmup.length === 1 ? 'série' : 'séries'} · ${volume(warmup)} kg·reps.</p><ol class="sessions-records">${sets.map(x => `<li><div><strong>${this.escape(x.exerciseName || s.planSnapshot.exercises.find(e => e.id === x.exerciseId)?.name)}</strong><span>${x.kind === 'warmup' ? 'Aquecimento' : 'Trabalho'} · ${this.escape(x.weightKg)} kg × ${x.reps} reps${x.rir !== null && x.rir !== undefined ? ` · RIR ${this.escape(x.rir)}` : ''}</span>${x.notes ? `<p>${this.escape(x.notes)}</p>` : ''}</div></li>`).join('')}</ol></details>`;
    }).join('') : '<p>Sua primeira sessão finalizada aparecerá aqui.</p>'}</section>`;
    const archived = state.sessions.filter(session => session.status === 'abandoned');
    if (archived.length) this.container.querySelector('[data-session-history]').insertAdjacentHTML('beforeend', `<section class="sessions-panel"><h3>Sessões arquivadas neste dispositivo</h3><p>Estes envios foram interrompidos por sua confirmação. Séries sem confirmação não entram no resumo sincronizado. Este arquivo local é apagado ao sair da conta.</p>${archived.map(session => `<details class="sessions-history"><summary><strong>${this.escape(session.recordedPlanSnapshot?.name || session.planSnapshot.name)}</strong><span>${this.escape(new Date(session.clientStartedAt).toLocaleString('pt-BR'))} · ${session.sets.length} ${session.sets.length === 1 ? 'série registrada' : 'séries registradas'}</span></summary><p>${session.synced ? 'Sessão iniciada no servidor; seu encerramento não foi confirmado por este arquivamento.' : 'Início da sessão sem confirmação do servidor.'}</p><ul>${(session.abandonedOperations || []).filter(op => op.status === 'blocked').map(op => `<li>${this.escape(op.error || 'Envio rejeitado.')}</li>`).join('')}</ul><ol class="sessions-records">${session.sets.map(set => `<li><div><strong>${this.escape(set.exerciseName || session.recordedPlanSnapshot?.exercises.find(exercise => exercise.id === set.exerciseId)?.name || 'Exercício registrado')}</strong><span>${this.escape(set.weightKg)} kg × ${this.escape(set.reps)} reps · ${set.synced ? 'Confirmada no servidor' : 'Sem confirmação; não será enviada'}</span>${set.notes ? `<p>${this.escape(set.notes)}</p>` : ''}</div></li>`).join('')}</ol></details>`).join('')}</section>`);
    const week = this.summary;
    this.container.querySelector('[data-week-summary]').innerHTML = week ? `<section class="sessions-panel"><h3>Últimos 7 dias · registros sincronizados</h3><div class="sessions-metrics"><div><strong>${week.workingSets}</strong><span>Séries de trabalho</span></div><div><strong>${Number(week.workingVolumeKg).toLocaleString('pt-BR')} kg·reps</strong><span>Volume de trabalho registrado</span></div><div><strong>${week.warmupSets}</strong><span>Séries de aquecimento</span></div></div><p>Horário de execução informado pelo aluno. Aquecimento: ${Number(week.warmupVolumeKg).toLocaleString('pt-BR')} kg·reps.</p><ul class="sessions-muscles">${Object.entries(week.directSetsByMuscle).map(([muscle, count]) => `<li>${this.escape(muscle)}: ${count} ${count === 1 ? 'série direta' : 'séries diretas'}</li>`).join('')}</ul>${week.unknownMuscleSets ? `<p>${week.unknownMuscleSets} ${week.unknownMuscleSets === 1 ? 'série' : 'séries'} sem grupo muscular conhecido.</p>` : ''}<p>Compare exercícios equivalentes e a mesma técnica. O volume registrado não mede estímulo muscular nem determina uma prescrição individual.</p></section>` : '';
  },
  destroy() { ++this.renderGeneration; this.container = null; this.renderedSessionKey = null; this.syncing = null; },
  clearAccount(userId, store = null) {
    const pending = this.accountCleanups.get(userId);
    if (pending) return pending;
    const cleanup = store ? store.dispose({ clear: true }) : FitFlowTrainingStore.createIndexedDbStorage().clear(userId);
    this.accountCleanups.set(userId, cleanup);
    const settled = () => { if (this.accountCleanups.get(userId) === cleanup) this.accountCleanups.delete(userId); };
    cleanup.then(settled, settled);
    return cleanup;
  },
  async logout(reason, loggedOutUserId) {
    if (!Number.isSafeInteger(loggedOutUserId) || loggedOutUserId < 1) return;
    // Um evento de outra conta nunca pode descartar a fila atualmente aberta.
    if (this.userId !== loggedOutUserId && this.storeRequest?.identity.userId !== loggedOutUserId) {
      if (reason !== 'expired') await this.clearAccount(loggedOutUserId);
      return;
    }
    ++this.renderGeneration;
    const store = this.store; this.store = null; this.storeIdentity = null; this.storeRequest = null; this.syncing = null;
    this.userId = null; this.workouts = []; this.summary = null; this.container = null; this.renderedSessionKey = null;
    if (reason !== 'expired') await this.clearAccount(loggedOutUserId, store);
    else if (store) await store.dispose({ clear: false });
  },
};
window.addEventListener('auth:logout', event => {
  const pending = SessoesView.logout(event.detail?.reason, event.detail?.userId);
  event.detail?.waitUntil?.(pending);
  pending.catch(() => {});
});
window.addEventListener('online', () => { if (SessoesView.store && Auth.user?.id === SessoesView.userId) SessoesView.refresh(); });
window.addEventListener('offline', () => {
  const context = SessoesView.context();
  if (context.store) context.store.state().then(state => {
    if (SessoesView.ownsContext(context)) SessoesView.updateIndicators(state);
  }).catch(() => {});
});
