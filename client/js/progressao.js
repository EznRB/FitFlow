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
        if (!groups.has(id)) groups.set(id, { id, name: exercise.name, workoutNames: [], records: [] });
        const group = groups.get(id), planName = session.planSnapshot.name;
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
  function createView() {
    return {
      container: null, generation: 0, ownerId: null, data: null, history: null, chart: null, selectedId: null, loading: false,
      user() { return typeof Auth !== 'undefined' ? Auth.user : null; },
      current(generation = this.generation) { return generation === this.generation && this.user()?.id === this.ownerId && this.user()?.role === 'student' && this.container?.isConnected && this.container.querySelector('[data-progress-page]'); },
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
        container.querySelector('[data-progress-refresh]').onclick = () => this.load();
        container.querySelector('[data-progress-legacy]').onclick = () => window.dispatchEvent(new CustomEvent('progressao:legacy'));
        await this.load();
      },
      async load() {
        if (!this.current() || this.loading) return;
        const generation = this.generation; this.loading = true;
        const status = this.container.querySelector('[data-progress-status]'), button = this.container.querySelector('[data-progress-refresh]');
        button.disabled = true; status.textContent = 'Consultando seus registros no servidor…';
        try {
          const response = await API.get('/sessoes/mine');
          if (!this.current(generation)) return;
          if (!Array.isArray(response?.data?.sessions)) throw new Error('O servidor retornou um histórico inválido.');
          this.data = response.data; this.history = buildExerciseHistory(this.data.sessions);
          const limit = Number.isSafeInteger(this.data.historyLimit) ? this.data.historyLimit : 100;
          status.textContent = `${this.data.sessions.length} sessão(ões) consultada(s). Histórico limitado às ${limit} sessões mais recentes.${this.data.historyMayBeTruncated ? ' Podem existir sessões anteriores fora desta consulta.' : ''} O resumo de 7 dias é calculado no servidor em uma consulta independente.${this.history.ignoredRecords || this.history.duplicateRecords ? ` ${this.history.ignoredRecords} registro(s) sem exercício confirmado e ${this.history.duplicateRecords} duplicado(s) foram excluídos da comparação.` : ''}`;
          this.renderWeek(); this.renderControls();
        } catch (error) {
          if (!this.current(generation)) return;
          status.textContent = `${error.message}${this.data ? ' Exibindo a última consulta desta conta nesta aba; os dados não foram atualizados.' : ' Tente novamente quando a conexão estiver disponível. Nenhum registro foi alterado.'}`;
          if (!this.data) this.container.querySelector('[data-progress-content]').innerHTML = '<section class="progress-panel"><h3>Não foi possível carregar o histórico</h3><p>Se você registrou séries sem conexão, sincronize a fila em Sessões e séries antes de consultar a evolução.</p></section>';
        } finally { if (this.current(generation)) { this.loading = false; button.disabled = false; } }
      },
      renderWeek() {
        const week = this.data.summary7Days, slot = this.container.querySelector('[data-progress-week]');
        if (!week) { slot.innerHTML = ''; return; }
        slot.innerHTML = `<section class="progress-week"><div><span class="progress-kicker">ÚLTIMOS 7 DIAS · SINCRONIZADOS</span><h3>O que foi registrado</h3><p>Horário de execução informado pelo aluno.</p></div><div class="progress-week-stat"><strong>${this.escape(week.workingSets)}</strong><span>Séries de trabalho</span></div><div class="progress-week-stat"><strong>${this.format(week.workingVolumeKg)}</strong><span>kg·reps de trabalho</span></div><div class="progress-week-stat"><strong>${this.escape(week.warmupSets)}</strong><span>Aquecimentos separados</span></div></section>`;
      },
      renderControls() {
        const groups = this.history.exercises, slot = this.container.querySelector('[data-progress-content]');
        if (!groups.length) { this.destroyChart(); slot.innerHTML = '<section class="progress-panel progress-empty"><h3>Seu histórico de séries começa aqui.</h3><p>Inicie uma sessão e registre as séries executadas. Elas aparecerão após a sincronização, com carga e repetições reais.</p></section>'; return; }
        if (!groups.some(group => group.id === this.selectedId)) this.selectedId = groups[0].id;
        slot.innerHTML = `<section class="progress-panel"><div class="progress-filters"><label>Exercício registrado<select data-progress-exercise>${groups.map(group => `<option value="${group.id}" ${group.id === this.selectedId ? 'selected' : ''}>${this.escape(group.name)} · identificação ${group.id}</option>`).join('')}</select></label><label>Repetições por série<input type="number" min="1" max="1000" step="1" inputmode="numeric" placeholder="Todas" data-progress-reps></label><label class="progress-warmup-check"><input type="checkbox" data-progress-warmups>Mostrar aquecimentos no gráfico</label></div><p class="progress-filter-note" data-progress-filter-note></p><div data-progress-series></div></section>`;
        slot.querySelector('[data-progress-exercise]').onchange = event => { this.selectedId = Number(event.target.value); this.renderSeries(); };
        slot.querySelector('[data-progress-reps]').oninput = () => this.renderSeries();
        slot.querySelector('[data-progress-warmups]').onchange = () => this.renderSeries();
        this.renderSeries();
      },
      table(records, label) {
        return records.length ? `<div class="progress-table-scroll"><table class="progress-table"><caption>${label}</caption><thead><tr><th scope="col">Execução</th><th scope="col">Carga externa</th><th scope="col">Repetições</th><th scope="col">RIR</th><th scope="col">Nota</th></tr></thead><tbody>${records.slice().reverse().map(record => `<tr><td>${this.escape(this.date(record))}</td><td>${record.weightKg === null ? 'Não informada' : `${this.format(record.weightKg)} kg`}</td><td>${record.reps === null ? 'Não informadas' : record.reps}</td><td>${record.rir === null ? 'Não informado' : this.format(record.rir)}</td><td>${this.escape(record.notes || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="progress-muted">Nenhuma série registrada neste filtro.</p>';
      },
      renderSeries() {
        if (!this.current()) return;
        const group = this.history.exercises.find(item => item.id === this.selectedId), field = this.container.querySelector('[data-progress-reps]');
        const slot = this.container.querySelector('[data-progress-series]'), note = this.container.querySelector('[data-progress-filter-note]');
        this.destroyChart();
        let series;
        try { series = selectSeries(group, { reps: field.value }); }
        catch (error) { note.textContent = error.message; slot.innerHTML = ''; return; }
        note.textContent = field.value === '' ? 'Todas as repetições registradas. Cargas com números diferentes de repetições não são diretamente equivalentes.' : `Somente séries com ${field.value} repetições. O filtro também se aplica aos aquecimentos mostrados abaixo.`;
        const last = series.workingPoints.at(-1), latest = last ? `${this.format(last.weightKg)} kg × ${last.reps}` : 'Sem registro válido';
        slot.innerHTML = `<div class="progress-series-heading"><div><p class="progress-kicker">${this.escape(group.workoutNames.join(' / '))}</p><h3>${this.escape(group.name)}</h3></div><span class="progress-muted">Identificação ${group.id} · cada ponto é uma série</span></div><div class="progress-metrics"><div><span>Séries de trabalho com carga e reps</span><strong>${series.validWorkingSets}</strong></div><div><span>Volume de trabalho no filtro</span><strong>${this.format(series.workingVolumeKg)} <small>kg·reps</small></strong></div><div><span>Série de trabalho mais recente</span><strong>${latest}</strong></div></div>
          <div class="progress-chart"><canvas data-progress-chart role="img" aria-label="Carga externa das séries registradas por data. Os valores completos estão na tabela abaixo."></canvas><p class="progress-chart-note" data-progress-chart-note></p></div>
          ${series.incomplete.length ? `<p class="progress-incomplete">${series.incomplete.length} registro(s) sem todos os dados necessários para aparecer no gráfico. Volume usa somente carga e repetições conhecidas.</p>` : ''}
          <h4>Séries de trabalho</h4>${this.table(series.working, 'Séries de trabalho registradas')}
          <details class="progress-warmups"><summary>Aquecimentos · ${series.warmup.length} registro(s) · ${this.format(series.warmupVolumeKg)} kg·reps</summary>${this.table(series.warmup, 'Aquecimentos separados das séries de trabalho')}</details>`;
        const showWarmup = this.container.querySelector('[data-progress-warmups]').checked;
        this.renderChart(series, showWarmup);
      },
      renderChart(series, showWarmup) {
        const caption = this.container.querySelector('[data-progress-chart-note]'), canvas = this.container.querySelector('[data-progress-chart]');
        const rows = [...series.workingPoints, ...(showWarmup ? series.warmupPoints : [])];
        if (!rows.length) { canvas.hidden = true; canvas.parentElement?.classList.add('progress-chart-empty'); caption.textContent = 'Não há série com carga, repetições e data válidas neste filtro.'; return; }
        if (typeof Chart === 'undefined') { canvas.hidden = true; canvas.parentElement?.classList.add('progress-chart-empty'); caption.textContent = 'Gráfico indisponível neste navegador. Todos os valores estão na tabela abaixo.'; return; }
        caption.textContent = 'Toque ou passe o cursor sobre um ponto para ver carga, repetições, RIR e data. Pontos coincidentes podem se sobrepor; consulte a tabela.';
        const dataset = (label, records, color, style) => ({ label, data: records.map(record => ({ x: record.timestamp, y: record.weightKg, record })), borderColor: color, backgroundColor: color, pointRadius: 4.5, pointHoverRadius: 7, pointStyle: style, showLine: false });
        const datasets = [dataset('Trabalho', series.workingPoints, '#f97316', 'circle')];
        if (showWarmup) datasets.push(dataset('Aquecimento', series.warmupPoints, '#94a3b8', 'triangle'));
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
        ++this.generation; this.destroyChart(); this.loading = false; this.data = null; this.history = null; this.selectedId = null;
        if (clear && this.container?.querySelector('[data-progress-page]')) this.container.innerHTML = '';
        this.container = null; this.ownerId = null;
      },
    };
  }
  return { buildExerciseHistory, selectSeries, createView };
});
if (typeof window !== 'undefined' && typeof ProgressaoView !== 'undefined') window.addEventListener('auth:logout', () => ProgressaoView.destroy({ clear: true }));
