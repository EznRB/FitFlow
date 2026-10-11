(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.FitFlowExerciseOrigin = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function render(exercise, escape) {
    const origin = exercise?.catalogSnapshot;
    if (!origin || origin.version !== 1 || !Number.isSafeInteger(origin.catalogExerciseId)) return '<p class="exercise-origin-note">Origem não registrada: exercício manual ou ficha anterior.</p>';
    const link = (url, label) => {
      try { const parsed = new URL(url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return `<a href="${escape(parsed.href)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`; } catch {}
      return escape(label);
    };
    const credit = (label, entry) => {
      if (!entry || typeof entry !== 'object') return '';
      const author = entry.author || (Array.isArray(entry.authors) ? entry.authors.join(', ') : '') || 'Autoria não informada';
      const license = entry.license || {};
      return `<div class="exercise-origin-credit"><p><strong>${escape(label)}</strong>: ${escape(author)} · ${link(license.url, license.code || 'Licença não informada')}.</p>
        ${entry.title ? `<p>Título de origem: ${escape(entry.title)}</p>` : ''}
        ${entry.originalUrl ? `<p>${link(entry.originalUrl, 'Conteúdo original')}</p>` : ''}
        ${entry.authorUrl ? `<p>${link(entry.authorUrl, 'Página da autoria')}</p>` : ''}
        ${entry.derivativeSourceUrl ? `<p>${link(entry.derivativeSourceUrl, 'Fonte da adaptação')}</p>` : ''}
        ${Array.isArray(entry.transformations) && entry.transformations.length ? `<p>Transformações registradas: ${escape(entry.transformations.join('; '))}.</p>` : ''}</div>`;
    };
    const meta = origin.sourceMetadata || {}, adapted = exercise.name !== origin.originalName || (exercise.muscleGroup ?? null) !== (origin.originalMuscleGroup ?? null);
    const names = entries => Array.isArray(entries) && entries.length ? entries.map(x => x.name).join(', ') : 'não informado';
    return `<details class="exercise-origin"><summary>Origem e créditos · ${escape(origin.source || 'catálogo')}</summary>
      <p>Nome registrado no catálogo: <strong>${escape(origin.originalName)}</strong>. Grupo: ${escape(origin.originalMuscleGroup || 'não informado')}.</p>
      ${adapted ? '<p>Nome ou grupo adaptado na ficha pelo instrutor; a origem original foi preservada.</p>' : ''}
      <p>${origin.curated ? 'Conteúdo com curadoria local' : 'Dados descritivos da fonte'} · ${escape(origin.locale || 'idioma não informado')}. Equipamento declarado: ${escape(names(meta.equipment))}.</p>
      ${origin.instructions ? `<p class="exercise-origin-instructions">${escape(origin.instructions)}</p>` : ''}
      ${credit('Base do exercício', meta.base)}${credit('Texto', meta.text)}
      ${(Array.isArray(meta.media) ? meta.media : []).map((entry, i) => `<div>${credit(`Mídia ${i + 1}`, entry)}${entry.url ? `<p>${link(entry.url, `Consultar mídia ${i + 1}`)}</p>` : ''}</div>`).join('')}
      ${meta.sourceUrl ? `<p>${link(meta.sourceUrl, 'Consultar registro na fonte')}</p>` : ''}
      <p>Créditos preservados com esta ficha. Descrições do catálogo não são uma prescrição para o aluno.</p></details>`;
  }
  return { render };
});
