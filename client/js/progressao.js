(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.FitFlowProgressao = api; root.ProgressaoView = api.createView(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function number(value, min, max, integer = false) {
    if (!['number', 'string'].includes(typeof value) || !String(value).trim()) return null;
    const result = Number(value);
    return Number.isFinite(result) && result >= min && result <= max && (!integer || Number.isInteger(result)) ? result : null;
  }
  function timestamp(value) {
    if (typeof value !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/.test(value)) return null;
    const result = new Date(value).getTime(); return Number.isFinite(result) ? result : null;
  }
  function buildExerciseHistory(sessions) {
    const groups = new Map(), seen = new Set(); let ignoredRecords = 0, duplicateRecords = 0;
    for (const session of sessions || []) {
      const snapshots = session.planSnapshot?.exercises;
      if (!Array.isArray(snapshots) || !Array.isArray(session.sets)) { ignoredRecords++; continue; }
      for (const set of session.sets) {
        const id = number(set.exerciseId, 1, 2147483647, true), exercise = snapshots.find(item => item.id === id);
        if (id === null || !exercise) { ignoredRecords++; continue; }
        if (typeof set.id === 'string' && set.id) { if (seen.has(set.id)) { duplicateRecords++; continue; } seen.add(set.id); }
        if (!groups.has(id)) groups.set(id, { id, name: exercise.name, workoutNames: [], contexts: [], records: [] });
        const group = groups.get(id), planName = session.planSnapshot.name;
        const equipment = exercise.catalogSnapshot?.sourceMetadata?.equipment;
        const context = [exercise.notes, Array.isArray(equipment) && equipment.length ? `Equipamento declarado no catálogo: ${equipment.map(item => item?.name).filter(name => typeof name === 'string').join(', ')} (não confirma execução)` : null].filter(value => typeof value === 'string' && value.trim()).join(' · ');
        if (context && !group.contexts.includes(context)) group.contexts.push(context);
        if (typeof planName === 'string' && !group.workoutNames.includes(planName)) group.workoutNames.push(planName);
        const weightKg = number(set.weightKg, 0, 2000), reps = number(set.reps, 1, 1000, true);
        group.records.push({ id: set.id || null, sessionId: session.id, exerciseId: id,
          name: typeof set.exerciseName === 'string' ? set.exerciseName : exercise.name,
          workoutName: planName, weightKg, reps, rir: number(set.rir, 0, 10),
          kind: ['working', 'warmup'].includes(set.kind) ? set.kind : null,
          performedAt: typeof set.performedAt === 'string' ? set.performedAt : null, timestamp: timestamp(set.performedAt),
          notes: typeof set.notes === 'string' ? set.notes : null,
          validMeasurement: weightKg !== null && reps !== null && ['working', 'warmup'].includes(set.kind),
        });
      }
    }
    for (const group of groups.values()) {
      group.records.sort((a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity));
      const latest = group.records.filter(record => record.timestamp !== null).at(-1);
      if (latest?.name) group.name = latest.name;
    }
    return { exercises: [...groups.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR') || a.id - b.id), ignoredRecords, duplicateRecords };
  }
  function selectSeries(exercise, { reps = null } = {}) {
    const filter = reps === null || reps === undefined || reps === '' ? null : number(reps, 1, 1000, true);
    if (reps !== null && reps !== undefined && reps !== '' && filter === null) throw new Error('Filtro de repetições: use um número inteiro entre 1 e 1000.');
    const records = (exercise?.records || []).filter(record => filter === null || record.reps === filter);
    const working = records.filter(record => record.kind === 'working'), warmup = records.filter(record => record.kind === 'warmup');
    const volume = rows => rows.filter(record => record.validMeasurement).reduce((sum, record) => sum + record.weightKg * record.reps, 0);
    const points = rows => rows.filter(record => record.validMeasurement && record.timestamp !== null);
    return { records, working, warmup, workingPoints: points(working), warmupPoints: points(warmup),
      workingVolumeKg: volume(working), warmupVolumeKg: volume(warmup),
      validWorkingSets: working.filter(record => record.validMeasurement).length,
      incomplete: records.filter(record => !record.validMeasurement || record.timestamp === null) };
  }
  function comparisonMarkup(prefix) {
    return `<fieldset class="progress-comparison"><legend>Comparar outro registro · opcional</legend><label>Segundo exercício<select data-progress-compare aria-describedby="${prefix}-comparison"></select></label><label class="progress-comparison-confirm"><input type="checkbox" data-progress-confirm disabled>Revisei os dois registros e considerarei equipamento, técnica, amplitude, assistência e esforço ao comparar.</label><p id="${prefix}-comparison" data-progress-comparison-note role="status" aria-live="polite"></p><p>A escolha não certifica equivalência. Identificações, séries e volumes continuam separados; nenhum histórico é alterado.</p></fieldset>`;
  }
  function createView() {
    return {
      container: null, generation: 0, ownerId: null, scope: null, request: null, controls: null, hasSelection: false,
      data: null, history: null, chart: null, selectedId: null, comparisonId: null, loading: false,
      user() { return typeof Auth !== 'undefined' ? Auth.user : null; },
      current(scope = this.scope) {
        return scope && this.scope === scope && scope.generation === this.generation && scope.container === this.container
          && this.user()?.id === scope.userId && this.user()?.role === 'student' && Auth.generation === scope.authGeneration
          && (typeof Auth.getSessionEpoch !== 'function' || (Auth.sessionEpoch === scope.epoch && Auth.getSessionEpoch() === scope.epoch))
          && scope.container?.isConnected && scope.container.querySelector('[data-progress-page]') === scope.page
          && (!scope.container.id || typeof document === 'undefined' || document.getElementById(scope.container.id) === scope.container);
      },
      currentControls(controls = this.controls) {
        return controls && this.controls === controls && this.current(controls.scope) && controls.slot.isConnected !== false
          && this.container.querySelector('[data-progress-content]') === controls.slot
          && ['select', 'reps', 'warmups', 'note', 'error', 'choice', 'series', 'compare', 'confirm', 'comparisonNote'].every(name => {
            const selectors = { select: 'exercise', reps: 'reps', warmups: 'warmups', note: 'filter-note', error: 'filter-error', choice: 'choice-note', series: 'series', compare: 'compare', confirm: 'confirm', comparisonNote: 'comparison-note' };
            return controls[name]?.isConnected !== false && controls.slot.querySelector(`[data-progress-${selectors[name]}]`) === controls[name];
          });
      },
      currentRequest(operation) {
        return this.request === operation && this.current(operation.scope)
          && [['status', 'status'], ['button', 'refresh'], ['content', 'content'], ['week', 'week']].every(([name, selector]) =>
            operation[name]?.isConnected !== false && this.container.querySelector(`[data-progress-${selector}]`) === operation[name])
          && (!operation.controls || this.currentControls(operation.controls));
      },
      escape(value) { return FitFlowSecurity.escapeHtml(value); },
      format(value) { return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); },
      date(record) { return record.timestamp === null ? 'Data não informada' : new Date(record.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
      async render(container) {
        this.destroy(); this.container = container; this.ownerId = this.user()?.id ?? null;
        if (this.user()?.role !== 'student') { container.innerHTML = '<section class="progress-panel"><h2>Evolução de treino</h2><p>Entre com sua conta de aluno para consultar suas séries.</p></section>'; return; }
        container.innerHTML = `<section class="progress-page" data-progress-page>
          <header class="progress-heading"><div><p class="progress-kicker">SEU ACOMPANHAMENTO / TREINO</p><h2>Registro de evolução<span>.</span></h2><p>Veja a carga, as repetições e o esforço que você registrou em cada exercício.</p></div><button class="btn btn-secondary" type="button" data-progress-refresh>Atualizar registros</button></header>
          <p class="progress-status" role="status" aria-live="polite" data-progress-status>Carregando suas sessões…</p>
          <div data-progress-week></div><div data-progress-content></div>
          <footer class="progress-method"><h3>Uma comparação exige contexto</h3><p>Compare o mesmo exercício, técnica e amplitude semelhantes. Repetições, descanso e RIR podem mudar a interpretação de uma carga. O gráfico mostra registros; não estima 1RM nem diagnostica ganho de força.</p><p>O volume em kg·reps é carga externa × repetições informadas. Com peso corporal, 0 kg registra somente a ausência de carga externa declarada. Exercícios com nomes iguais e identificações diferentes ficam separados.</p><a href="https://pubmed.ncbi.nlm.nih.gov/41843416/" target="_blank" rel="noopener noreferrer">Referência: ACSM 2026</a><button class="btn btn-ghost" type="button" data-progress-legacy>Consultar registros anteriores ao formato de sessões</button></footer>
        </section>`;
        const scope = this.scope = { container, page: container.querySelector('[data-progress-page]'), generation: this.generation,
          userId: this.user()?.id, authGeneration: Auth.generation, epoch: typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null };
        const refreshButton = container.querySelector('[data-progress-refresh]'), legacyButton = container.querySelector('[data-progress-legacy]');
        refreshButton.onclick = () => { if (this.current(scope) && container.querySelector('[data-progress-refresh]') === refreshButton) return this.load(); };
        legacyButton.onclick = () => { if (this.current(scope) && container.querySelector('[data-progress-legacy]') === legacyButton) window.dispatchEvent(new CustomEvent('progressao:legacy')); };
        await this.load();
      },
      load() {
        if (!this.current()) return;
        if (this.request) return this.currentRequest(this.request) ? this.request.promise : undefined;
        const operation = { scope: this.scope, controls: this.controls,
          status: this.container.querySelector('[data-progress-status]'), button: this.container.querySelector('[data-progress-refresh]'),
          content: this.container.querySelector('[data-progress-content]'), week: this.container.querySelector('[data-progress-week]'), promise: null };
        this.request = operation; this.loading = true;
        const { status, button } = operation;
        button.disabled = true; button.setAttribute?.('aria-busy', 'true'); status.textContent = 'Consultando seus registros no servidor…';
        operation.promise = (async () => {
          try {
            const response = await API.get('/sessoes/mine', { timeoutMs: 15000 });
            if (!this.currentRequest(operation)) return;
            if (!Array.isArray(response?.data?.sessions)) throw new Error('O servidor retornou um histórico inválido.');
            this.data = response.data; this.history = buildExerciseHistory(this.data.sessions);
            const limit = Number.isSafeInteger(this.data.historyLimit) ? this.data.historyLimit : 100;
            status.textContent = `${this.data.sessions.length} sessão(ões) consultada(s). Histórico limitado às ${limit} sessões mais recentes.${this.data.historyMayBeTruncated ? ' Podem existir sessões anteriores fora desta consulta.' : ''} O resumo de 7 dias é calculado no servidor em uma consulta independente.${this.history.ignoredRecords || this.history.duplicateRecords ? ` ${this.history.ignoredRecords} registro(s) sem exercício confirmado e ${this.history.duplicateRecords} duplicado(s) foram excluídos da comparação.` : ''}`;
            if (this.controls?.confirm) this.controls.confirm.checked = false;
            this.renderWeek(); this.renderControls();
          } catch (error) {
            if (!this.currentRequest(operation)) return;
            status.textContent = `${error.message}${this.data ? ' Exibindo a última consulta desta conta nesta aba; os dados não foram atualizados.' : ' Tente novamente quando a conexão estiver disponível. Nenhum registro foi alterado.'}`;
            if (!this.data) operation.content.innerHTML = '<section class="progress-panel"><h3>Não foi possível carregar o histórico</h3><p>Se você registrou séries sem conexão, sincronize a fila em Sessões e séries antes de consultar a evolução.</p></section>';
          } finally {
            if (this.request === operation) {
              const current = this.currentRequest(operation); this.request = null; this.loading = false;
              if (current) { button.disabled = false; button.setAttribute?.('aria-busy', 'false'); }
            }
          }
        })();
        return operation.promise;
      },
      renderWeek() {
        const week = this.data.summary7Days, slot = this.container.querySelector('[data-progress-week]');
        if (!week) { slot.innerHTML = ''; return; }
        slot.innerHTML = `<section class="progress-week"><div><span class="progress-kicker">ÚLTIMOS 7 DIAS · SINCRONIZADOS</span><h3>O que foi registrado</h3><p>Horário de execução informado pelo aluno.</p></div><div class="progress-week-stat"><strong>${this.escape(week.workingSets)}</strong><span>Séries de trabalho</span></div><div class="progress-week-stat"><strong>${this.format(week.workingVolumeKg)}</strong><span>kg·reps de trabalho</span></div><div class="progress-week-stat"><strong>${this.escape(week.warmupSets)}</strong><span>Aquecimentos separados</span></div></section>`;
      },
      renderControls() {
        const groups = this.history.exercises, slot = this.container.querySelector('[data-progress-content]');
        if (!groups.length && !this.controls) { this.destroyChart(); slot.innerHTML = '<section class="progress-panel progress-empty"><h3>Seu histórico de séries começa aqui.</h3><p>Inicie uma sessão e registre as séries executadas. Elas aparecerão após a sincronização, com carga e repetições reais.</p></section>'; return; }
        if (this.selectedId !== null && !groups.some(group => group.id === this.selectedId)) this.selectedId = null;
        if (!groups.some(group => group.id === this.comparisonId) || this.comparisonId === this.selectedId) this.comparisonId = null;
        if (!this.hasSelection && groups.length) { this.selectedId = groups[0].id; this.hasSelection = true; }
        if (!this.currentControls()) {
          const prefix = `progress-${this.generation}`;
          slot.innerHTML = `<section class="progress-panel"><div class="progress-filters"><label>Exercício registrado<select data-progress-exercise aria-describedby="${prefix}-choice"></select></label><label>Repetições por série<input type="number" min="1" max="1000" step="1" inputmode="numeric" placeholder="Todas" data-progress-reps aria-describedby="${prefix}-help ${prefix}-error" aria-invalid="false"></label><label class="progress-warmup-check"><input type="checkbox" data-progress-warmups>Mostrar aquecimentos no gráfico</label></div><p id="${prefix}-choice" class="progress-filter-note" data-progress-choice-note role="status" aria-live="polite"></p><p id="${prefix}-help" class="progress-filter-note" data-progress-filter-note></p><p id="${prefix}-error" class="progress-incomplete" data-progress-filter-error role="status" aria-live="polite" aria-atomic="true"></p>${comparisonMarkup(prefix)}<div data-progress-series></div></section>`;
          const controls = this.controls = { scope: this.scope, slot, select: slot.querySelector('[data-progress-exercise]'), reps: slot.querySelector('[data-progress-reps]'),
            warmups: slot.querySelector('[data-progress-warmups]'), note: slot.querySelector('[data-progress-filter-note]'), error: slot.querySelector('[data-progress-filter-error]'),
            choice: slot.querySelector('[data-progress-choice-note]'), series: slot.querySelector('[data-progress-series]') };
          controls.compare = slot.querySelector('[data-progress-compare]');
          controls.confirm = slot.querySelector('[data-progress-confirm]');
          controls.comparisonNote = slot.querySelector('[data-progress-comparison-note]');
          controls.select.onchange = () => {
            if (!this.currentControls(controls)) return;
            const id = Number(controls.select.value);
            this.selectedId = this.history.exercises.some(group => group.id === id) ? id : null;
            controls.confirm.checked = false;
            if (this.comparisonId === this.selectedId) this.comparisonId = null;
            this.renderComparisonOptions(); this.renderSeries();
          };
          controls.compare.onchange = () => {
            if (!this.currentControls(controls)) return;
            const id = Number(controls.compare.value);
            this.comparisonId = this.history.exercises.some(group => group.id === id && id !== this.selectedId) ? id : null;
            controls.confirm.checked = false; this.renderComparisonOptions(); this.renderSeries();
          };
          controls.confirm.onchange = () => { if (this.currentControls(controls)) this.renderSeries(); };
          controls.reps.oninput = () => { if (this.currentControls(controls)) this.renderSeries(); };
          controls.warmups.onchange = () => { if (this.currentControls(controls)) this.renderSeries(); };
        }
        const controls = this.controls;
        controls.select.innerHTML = `<option value="" disabled>Escolha um exercício</option>${groups.map(group => `<option value="${group.id}">${this.escape(group.name)} · identificação ${group.id}</option>`).join('')}`;
        controls.select.value = this.selectedId === null ? '' : String(this.selectedId); controls.select.disabled = !groups.length;
        this.renderComparisonOptions();
        this.renderSeries();
      },
      renderComparisonOptions() {
        const { compare, confirm } = this.controls;
        compare.innerHTML = '<option value="">Sem comparação adicional</option>' + this.history.exercises.filter(group => group.id !== this.selectedId).map(group => `<option value="${group.id}">${this.escape(group.name)} · identificação ${group.id} · ${this.escape(group.workoutNames.join(' / '))}</option>`).join('');
        compare.value = this.comparisonId === null ? '' : String(this.comparisonId);
        confirm.disabled = this.comparisonId === null || this.selectedId === null;
        if (confirm.disabled) confirm.checked = false;
      },
      table(records, label) {
        return records.length ? `<div class="progress-table-scroll" tabindex="0" role="region" aria-label="${this.escape(label)} · tabela com rolagem horizontal"><table class="progress-table"><caption>${label}</caption><thead><tr><th scope="col">Execução</th><th scope="col">Carga externa</th><th scope="col">Repetições</th><th scope="col">RIR</th><th scope="col">Nota</th></tr></thead><tbody>${records.slice().reverse().map(record => `<tr><td>${this.escape(this.date(record))}</td><td>${record.weightKg === null ? 'Não informada' : `${this.format(record.weightKg)} kg`}</td><td>${record.reps === null ? 'Não informadas' : record.reps}</td><td>${record.rir === null ? 'Não informado' : this.format(record.rir)}</td><td>${this.escape(record.notes || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="progress-muted">Nenhuma série registrada neste filtro.</p>';
      },
      renderSeries() {
        if (!this.currentControls()) return;
        const { reps: field, series: slot, note, error, select, choice, warmups } = this.controls;
        const group = this.history.exercises.find(item => item.id === this.selectedId);
        const candidate = this.history.exercises.find(item => item.id === this.comparisonId && item.id !== this.selectedId);
        const comparison = group && candidate && this.controls.confirm.checked ? candidate : null;
        this.controls.comparisonNote.textContent = comparison
          ? `Comparação visual ativa entre as identificações ${group.id} e ${candidate.id}. Séries e volumes permanecem separados; consulte o contexto e as notas junto a cada registro.`
          : candidate ? `Antes de mostrar o segundo registro, confirme a revisão do contexto. Primeiro: identificação ${group?.id ?? 'não selecionada'} · ${group?.workoutNames.join(' / ') || 'sem ficha'} · ${group?.contexts.join(' · ') || 'contexto não estruturado'}. Segundo: identificação ${candidate.id} · ${candidate.workoutNames.join(' / ')} · ${candidate.contexts.join(' · ') || 'contexto não estruturado'}. Considere também as notas das séries.`
            : 'Selecione explicitamente outro exercício para comparar. Nenhuma equivalência é inferida pelo nome ou catálogo.';
        this.destroyChart();
        select.setAttribute?.('aria-invalid', String(!group));
        choice.textContent = group ? '' : `O exercício selecionado não consta nesta consulta. A comparação não foi substituída; escolha explicitamente um exercício.${this.history.exercises.length ? '' : ' Não há exercícios disponíveis nesta consulta.'}`;
        let series, comparisonSeries;
        try {
          if (field.validity?.badInput) throw new Error('Filtro de repetições: use um número inteiro entre 1 e 1000.');
          series = selectSeries(group, { reps: field.value }); field.setAttribute?.('aria-invalid', 'false'); error.textContent = '';
          comparisonSeries = comparison ? selectSeries(comparison, { reps: field.value }) : null;
        } catch (invalid) { field.setAttribute?.('aria-invalid', 'true'); error.textContent = invalid.message; slot.innerHTML = ''; return; }
        note.textContent = field.value === '' ? 'Todas as repetições registradas. Cargas com números diferentes de repetições não são diretamente equivalentes.' : `Somente séries com ${field.value} repetições. O filtro também se aplica aos aquecimentos mostrados abaixo.`;
        if (!group) { slot.innerHTML = ''; return; }
        const last = series.workingPoints.at(-1), latest = last ? `${this.format(last.weightKg)} kg × ${last.reps}` : 'Sem registro válido';
        slot.innerHTML = `<div class="progress-series-heading"><div><p class="progress-kicker">${this.escape(group.workoutNames.join(' / '))}</p><h3>${this.escape(group.name)}</h3></div><span class="progress-muted">Identificação ${group.id} · cada ponto é uma série</span></div><div class="progress-metrics"><div><span>Séries de trabalho com carga e reps</span><strong>${series.validWorkingSets}</strong></div><div><span>Volume de trabalho no filtro</span><strong>${this.format(series.workingVolumeKg)} <small>kg·reps</small></strong></div><div><span>Série de trabalho mais recente</span><strong>${latest}</strong></div></div>
          <div class="progress-chart"><div class="progress-chart-frame"><canvas data-progress-chart role="img" aria-label="Carga externa das séries registradas por data. Os valores completos estão na tabela abaixo."></canvas></div><p class="progress-chart-note" data-progress-chart-note></p></div>
          ${series.incomplete.length ? `<p class="progress-incomplete">${series.incomplete.length} registro(s) sem todos os dados necessários para aparecer no gráfico. Volume usa somente carga e repetições conhecidas.</p>` : ''}
          <h4>Séries de trabalho</h4>${this.table(series.working, 'Séries de trabalho registradas')}
          <details class="progress-warmups"><summary>Aquecimentos · ${series.warmup.length} registro(s) · ${this.format(series.warmupVolumeKg)} kg·reps</summary>${this.table(series.warmup, 'Aquecimentos separados das séries de trabalho')}</details>`;
        if (comparison) {
          const contexts = comparison.contexts.length ? comparison.contexts : ['Contexto de execução não estruturado; consulte as notas de cada série.'];
          slot.innerHTML += `<section class="progress-comparison-result"><h4>Segundo registro · Identificação ${comparison.id}</h4><p>${this.escape(comparison.name)} · ${this.escape(comparison.workoutNames.join(' / '))}</p>${contexts.map(context => `<p>${this.escape(context)}</p>`).join('')}<p>${comparisonSeries.validWorkingSets} ${comparisonSeries.validWorkingSets === 1 ? 'série' : 'séries'} de trabalho no filtro · ${this.format(comparisonSeries.workingVolumeKg)} kg·reps. Volume separado do primeiro registro.</p>${this.table(comparisonSeries.working, `Trabalho · identificação ${comparison.id}`)}<details class="progress-warmups"><summary>Aquecimentos · identificação ${comparison.id} · ${comparisonSeries.warmup.length} ${comparisonSeries.warmup.length === 1 ? 'registro' : 'registros'} · ${this.format(comparisonSeries.warmupVolumeKg)} kg·reps</summary>${this.table(comparisonSeries.warmup, `Aquecimentos · identificação ${comparison.id}`)}</details></section>`;
        }
        const primaryContext = group.contexts.length ? group.contexts : ['Contexto de execução não estruturado; consulte as notas de cada série.'];
        if (comparison) slot.innerHTML += `<p class="progress-context">Primeiro registro · identificação ${group.id}: ${this.escape(primaryContext.join(' · '))}</p>`;
        this.renderChart(series, warmups.checked, comparisonSeries, group, comparison);
      },
      renderChart(series, showWarmup, comparisonSeries = null, primaryGroup = null, comparisonGroup = null) {
        const caption = this.container.querySelector('[data-progress-chart-note]'), canvas = this.container.querySelector('[data-progress-chart]');
        const rows = [...series.workingPoints, ...(showWarmup ? series.warmupPoints : []), ...(comparisonSeries?.workingPoints || []), ...(showWarmup ? comparisonSeries?.warmupPoints || [] : [])];
        if (!rows.length) { canvas.hidden = true; canvas.parentElement?.classList.add('progress-chart-empty'); caption.textContent = 'Não há série com carga, repetições e data válidas neste filtro.'; return; }
        if (typeof Chart === 'undefined') { canvas.hidden = true; canvas.parentElement?.classList.add('progress-chart-empty'); caption.textContent = 'Gráfico indisponível neste navegador. Todos os valores estão na tabela abaixo.'; return; }
        caption.textContent = 'Toque ou passe o cursor sobre um ponto para ver carga, repetições, RIR e data. Pontos coincidentes podem se sobrepor; consulte a tabela.';
        const dataset = (label, records, color, style) => ({ label, data: records.map(record => ({ x: record.timestamp, y: record.weightKg, record })), borderColor: color, backgroundColor: color, pointRadius: 4.5, pointHoverRadius: 7, pointStyle: style, showLine: false });
        const primaryLabel = comparisonGroup ? ` · identificação ${primaryGroup.id}` : '';
        const datasets = [dataset(`Trabalho${primaryLabel}`, series.workingPoints, '#f97316', 'circle')];
        if (showWarmup) datasets.push(dataset(`Aquecimento${primaryLabel}`, series.warmupPoints, '#94a3b8', 'triangle'));
        if (comparisonSeries) {
          datasets.push(dataset(`Trabalho · identificação ${comparisonGroup.id}`, comparisonSeries.workingPoints, '#38bdf8', 'rect'));
          if (showWarmup) datasets.push(dataset(`Aquecimento · identificação ${comparisonGroup.id}`, comparisonSeries.warmupPoints, '#c4b5fd', 'crossRot'));
        }
        let min = Infinity, max = -Infinity;
        for (const record of rows) { min = Math.min(min, record.timestamp); max = Math.max(max, record.timestamp); }
        const shortRange = max - min < 86400000;
        this.chart = new Chart(canvas, { type: 'scatter', data: { datasets }, options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { labels: { color: '#cbd5e1', usePointStyle: true } }, tooltip: { callbacks: {
            title: items => items.length ? this.date(items[0].raw.record) : '',
            label: item => { const record = item.raw.record; return `${item.dataset.label}: ${this.format(record.weightKg)} kg × ${record.reps} reps · RIR ${record.rir === null ? 'não informado' : this.format(record.rir)}`; },
          } } },
          scales: { x: { type: 'linear', min: min - 21600000, max: max + 21600000, grid: { color: '#243041' }, ticks: { color: '#94a3b8', maxTicksLimit: 6, callback: value => shortRange ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }, title: { display: true, text: shortRange ? 'Horário de execução informado' : 'Data de execução informada', color: '#94a3b8' } },
            y: { beginAtZero: true, grid: { color: '#243041' }, ticks: { color: '#94a3b8' }, title: { display: true, text: 'Carga externa registrada (kg)', color: '#94a3b8' } } },
        } });
      },
      destroyChart() { if (this.chart) this.chart.destroy(); this.chart = null; },
      destroy({ clear = false } = {}) {
        ++this.generation; this.destroyChart(); this.loading = false; this.request = null; this.controls = null; this.scope = null; this.hasSelection = false;
        this.data = null; this.history = null; this.selectedId = null; this.comparisonId = null;
        if (clear && this.container?.querySelector('[data-progress-page]')) this.container.innerHTML = '';
        this.container = null; this.ownerId = null;
      },
    };
  }
  return { buildExerciseHistory, selectSeries, createView };
});
if (typeof window !== 'undefined' && typeof ProgressaoView !== 'undefined') window.addEventListener('auth:logout', () => ProgressaoView.destroy({ clear: true }));
