/** Apoio determinístico ao planejamento; não monta ou prescreve fichas. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./science.js'));
  else root.PlanejamentoCiencia = factory(root.FitFlowScience);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (science) {
  'use strict';
  const equipmentLabels = { bodyweight: 'Peso corporal', dumbbells: 'Halteres', barbell: 'Barra',
    machines: 'Máquinas', cables: 'Cabos', bands: 'Elásticos', kettlebell: 'Kettlebell' };
  function integer(value, label, min, max) {
    if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value).trim())) throw new Error(`Informe ${label} em números inteiros.`);
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${label}: use ${min} a ${max}.`);
    return n;
  }
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function compare(input) {
    if (!input || typeof input !== 'object') throw new Error('Informe o contexto do planejamento.');
    const days = integer(input.days, 'sessões por semana', 1, 6);
    const minutes = integer(input.minutes, 'minutos disponíveis por sessão', 10, 180);
    if (!['general', 'strength', 'hypertrophy'].includes(input.goal)) throw new Error('Selecione um objetivo.');
    if (!['regular', 'variable'].includes(input.consistency)) throw new Error('Selecione a regularidade esperada.');
    if (!Array.isArray(input.equipment) || !input.equipment.length || input.equipment.some(e => !Object.hasOwn(equipmentLabels, e))) throw new Error('Marque os recursos disponíveis.');
    const make = (id, title, cycle, fit, tradeoff) => ({ id, title,
      schedule: Array.from({ length: days }, (_, i) => cycle[i % cycle.length]),
      nextWeek: Array.from({ length: days }, (_, i) => cycle[(i + days) % cycle.length]), fit, tradeoff });
    const options = [
      make('full-body', 'Corpo inteiro com ênfases A/B', ['Corpo inteiro A', 'Corpo inteiro B'],
        'Uma opção para distribuir os movimentos por sessão e variar ênfases sem concentrar toda uma região em um único dia.',
        'Verifique se a quantidade de exercícios, pausas e séries cabe na sessão e permite recuperação entre exposições.'),
      make('upper-lower', 'Superiores / inferiores', ['Superiores', 'Inferiores'],
        'Uma opção para concentrar a atenção em regiões diferentes e continuar a sequência na sessão seguinte.',
        days % 2 ? 'Nesta semana uma região tem uma sessão a mais. A semana seguinte continua a sequência; isso não determina séries ou estímulo iguais.' :
          'O calendário equilibra as sessões das duas regiões. A exposição real de cada músculo depende dos exercícios selecionados.'),
      make('push-pull-legs', 'Empurrar / puxar / pernas', ['Empurrar', 'Puxar', 'Pernas'],
        'Uma opção para separar famílias de movimentos; precisa ser conferida contra os dias que o aluno efetivamente consegue frequentar.',
        days === 3 ? 'Com três sessões, cada bloco aparece uma vez: uma exposição de bloco não define automaticamente a frequência de cada músculo.' :
          'Se a semana não comportar ciclos completos, continue a sequência na próxima. Evite presumir frequência apenas pelo nome da divisão.'),
    ];
    const goals = { general: 'Planeje progressão e regularidade compatíveis com o nível atual.',
      strength: 'Priorize os movimentos de força que serão acompanhados e revise carga, técnica e descanso com o desempenho.',
      hypertrophy: 'Compare séries semanais para os músculos de interesse, recuperação e tolerância antes de ajustar volume.' };
    const considerations = [goals[input.goal],
      `${minutes} minutos declarados por sessão: confirme se execução, transições e pausas cabem no tempo disponível.`,
      input.consistency === 'variable' ? 'Adesão variável: combine uma sequência que possa continuar após faltas e reveja o plano com a frequência realmente realizada.' :
        'Adesão regular: confronte a frequência planejada com as sessões realizadas e revise o plano se a rotina mudar.',
      `Recursos declarados: ${[...new Set(input.equipment)].map(e => equipmentLabels[e]).join(', ')}. Confira disponibilidade e domínio técnico de cada exercício.`,
    ];
    const references = ['acsm-2026', 'split-2024'].map(key => science?.references?.[key]).filter(Boolean);
    return { options, considerations, references,
      interpretation: 'Calendários e critérios práticos são interpretações para organizar a decisão. Não são protocolos validados nem uma escolha automática de dose ou exercícios.' };
  }
  function weeklyVolume(input) {
    return integer(input?.setsPerExposure, 'séries por exposição do mesmo grupo', 0, 1000) *
      integer(input?.exposures, 'exposições semanais desse grupo', 0, 21);
  }
  const genericMuscleGroups = new Set(['multiplos', 'outros', 'nao informado', 'cardio', 'funcional']);
  function directMuscleGroup(value) {
    if (typeof value !== 'string') return null;
    const group = value.trim();
    const key = group.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').toLowerCase();
    return !group || genericMuscleGroups.has(key) ? null : group;
  }
  function summarizeRoutine(exercises) {
    const directSets = Object.create(null);
    let totalSets = 0, unassignedSets = 0, incompleteExercises = 0;
    for (const exercise of exercises || []) {
      let sets;
      try { sets = integer(exercise.sets, 'séries', 1, 100); } catch { incompleteExercises++; continue; }
      totalSets += sets;
      const group = directMuscleGroup(exercise.muscleGroup);
      if (group === null) unassignedSets += sets;
      else directSets[group] = (directSets[group] || 0) + sets;
    }
    return { directSets, totalSets, unassignedSets, incompleteExercises };
  }
  function renderComparison(result) {
    const schedule = entries => entries.map((label, i) => `<li><span>${i + 1}</span>${escape(label)}</li>`).join('');
    const refs = result.references.map(ref => `<p>${escape(ref.summary)}
      <a href="${escape(ref.url)}" target="_blank" rel="noopener noreferrer">${escape(ref.title)}</a></p>`).join('');
    return `<div class="planning-options">${result.options.map(option => `<article class="planning-option">
      <h4>${escape(option.title)}</h4><p>${escape(option.fit)}</p>
      <ol class="planning-sequence" aria-label="Sequência ilustrativa da semana">${schedule(option.schedule)}</ol>
      ${option.schedule.join('|') !== option.nextWeek.join('|') ? `<details><summary>Continuidade na semana seguinte</summary><ol class="planning-sequence">${schedule(option.nextWeek)}</ol></details>` : ''}
      <p>${escape(option.tradeoff)}</p></article>`).join('')}</div>
      <ul class="planning-considerations">${result.considerations.map(item => `<li>${escape(item)}</li>`).join('')}</ul>
      <p class="planning-scope">${escape(result.interpretation)}</p>
      <details class="planning-evidence"><summary>O que a evidência ajuda a decidir</summary>${refs}
        <p>Referências em adultos saudáveis. Situações clínicas, reabilitação e outras populações precisam de avaliação específica.</p></details>`;
  }
  function mount(container) {
    if (!container) return;
    container.innerHTML = `<details class="planning-panel"><summary>Comparar divisões e revisar a seleção de exercícios</summary>
      <p class="planning-scope">Apoio à decisão do profissional. Preencha o contexto e compare opções; a ficha continua sob sua revisão.</p>
      <div class="planning-context">
        <label>Sessões de musculação por semana<select id="planning-days">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Minutos disponíveis por sessão<input id="planning-minutes" type="number" min="10" max="180" value="45"></label>
        <label>Objetivo acompanhado<select id="planning-goal"><option value="general">Condicionamento geral</option><option value="strength">Força</option><option value="hypertrophy">Hipertrofia</option></select></label>
        <label>Regularidade esperada<select id="planning-consistency"><option value="regular">Dias regulares</option><option value="variable">Dias variáveis</option></select></label>
      </div>
      <fieldset class="planning-equipment"><legend>Recursos disponíveis</legend>${Object.entries(equipmentLabels).map(([code, label]) => `<label><input type="checkbox" name="planning-equipment" value="${code}" ${code === 'bodyweight' ? 'checked' : ''}>${label}</label>`).join('')}</fieldset>
      <button type="button" class="btn btn-secondary" id="planning-compare">Comparar sequências</button>
      <div id="planning-result" aria-live="polite"></div>
      <details class="planning-selection"><summary>Revisão da seleção de exercícios</summary>
        <ul><li>Escolha movimentos coerentes com o objetivo, experiência e preferência do aluno.</li>
        <li>Confira equipamentos, tempo de sessão, execução e amplitude tolerada. Ajuste a complexidade à capacidade atual.</li>
        <li>Revise cobertura dos músculos de interesse e sobreposição entre sessões. Nome e categoria de catálogo não confirmam músculos treinados.</li>
        <li>Defina progressão e acompanhe recuperação, conforto e desempenho; reavalie a seleção com essa resposta.</li></ul>
        <p>Checklist prático para revisão profissional; não seleciona exercícios automaticamente.</p>
      </details>
      <details class="planning-volume"><summary>Conferir volume declarado</summary>
        <p>Séries diretas declaradas nesta ficha, sem estimar músculos secundários ou frequência semanal.</p>
        <div id="planning-routine-summary" aria-live="polite">Adicione exercícios e informe as séries.</div>
        <div class="planning-context">
          <label>Séries do mesmo grupo por exposição<input id="planning-sets" type="number" min="0" max="1000" placeholder="Informar"></label>
          <label>Exposições desse grupo por semana<input id="planning-exposures" type="number" min="0" max="21" placeholder="Informar"></label>
        </div><p id="planning-volume-result" aria-live="polite">O total semanal depende das duas informações acima.</p>
        <p class="planning-scope">Soma de séries planejadas; não comprova execução, esforço ou uma dose adequada para o aluno.</p>
      </details></details>`;
    const find = id => container.querySelector(`#${id}`);
    find('planning-compare').addEventListener('click', () => {
      try {
        const context = { days: find('planning-days').value, minutes: find('planning-minutes').value,
          goal: find('planning-goal').value, consistency: find('planning-consistency').value,
          equipment: [...container.querySelectorAll('input[name="planning-equipment"]:checked')].map(item => item.value) };
        find('planning-result').innerHTML = renderComparison(compare(context));
      } catch (error) { find('planning-result').textContent = error.message; }
    });
    const updateVolume = () => {
      try { find('planning-volume-result').textContent = `${weeklyVolume({ setsPerExposure: find('planning-sets').value, exposures: find('planning-exposures').value })} séries diretas planejadas por semana para o grupo informado.`; }
      catch (error) { find('planning-volume-result').textContent = error.message; }
    };
    find('planning-sets').addEventListener('input', updateVolume); find('planning-exposures').addEventListener('input', updateVolume);
  }
  function updateRoutine(container, exercises) {
    const target = container?.querySelector('#planning-routine-summary');
    if (!target) return;
    const summary = summarizeRoutine(exercises);
    const labels = Object.entries(summary.directSets).map(([group, count]) => `${group}: ${count}`).join(' · ');
    target.textContent = `${labels || 'Sem grupo diretamente atribuído.'} Total na ficha: ${summary.totalSets}; sem grupo definido: ${summary.unassignedSets}; exercícios com séries incompletas: ${summary.incompleteExercises}.`;
  }
  return { compare, weeklyVolume, summarizeRoutine, mount, updateRoutine, renderComparison };
});
