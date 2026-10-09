/**
 * Matemática verificável compartilhada entre navegador e testes Node.
 * As fórmulas estimam gasto em repouso; parâmetros de dieta não são prescrições.
 */
(function (root, factory) {
  const science = factory();
  if (typeof module === 'object' && module.exports) module.exports = science;
  else root.FitFlowScience = science;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const version = '2026-10-07.1';
  const references = {
    'acsm-2026': { title: 'ACSM — treinamento resistido (2026)', url: 'https://pubmed.ncbi.nlm.nih.gov/41843416/',
      summary: 'Em adultos saudáveis, adequar volume, carga e frequência ao objetivo. Falha muscular não é obrigatória para todos os resultados.' },
    'split-2024': { title: 'Ramos-Campo — split versus full body (2024)', url: 'https://pubmed.ncbi.nlm.nih.gov/38595233/',
      summary: 'A meta-análise encontrou resultados semelhantes entre divisões e full body quando o volume foi igualado; escolher considerando disponibilidade e adesão.' },
    'mifflin-1990': { title: 'Mifflin–St Jeor (1990)', url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
      summary: 'Equação de predição do gasto em repouso com peso, altura, idade e coeficientes por sexo; não mede gasto energético individual.' },
    'harris-1984': { title: 'Roza e Shizgal — Harris–Benedict revisada (1984)', url: 'https://pubmed.ncbi.nlm.nih.gov/6741850/',
      summary: 'Reavaliação da equação de Harris–Benedict; uma estimativa com incerteza, inadequada como prescrição clínica individual automática.' },
    'protein-2018': { title: 'Morton — proteína e treino resistido (2018)', url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/',
      summary: 'Meta-análise em adultos saudáveis encontrou ponto estimado de diminuição de benefício perto de 1,6 g/kg/dia; não é teto rígido universal.' },
    'dri': { title: 'Dietary Reference Intakes — macronutrientes', url: 'https://www.ncbi.nlm.nih.gov/books/NBK208874/',
      summary: 'Faixa populacional adulta de gordura de 20–35% da energia. Proteína, carboidrato e gordura usam fatores gerais de 4, 4 e 9 kcal/g.' },
  };

  // Rejeita coerções ambíguas: null, boolean e campo vazio não são zero válido.
  function number(value, label, min, max) {
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') {
      throw new Error(`Preencha ${label}.`);
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label}: use um valor entre ${min} e ${max}.`);
    return n;
  }

  function calculateNutrition(input) {
    if (!input || input.eligible !== true) throw new Error('Confirme o escopo de adultos saudáveis antes de calcular.');
    const age = number(input.age, 'idade em anos', 19, 78);
    if (!Number.isInteger(age)) throw new Error('Use a idade em anos completos.');
    const weight = number(input.weightKg, 'peso em kg', 30, 300);
    const height = number(input.heightCm, 'altura em cm', 120, 230);
    const activity = number(input.activityFactor, 'fator de atividade', 1.2, 2.4);
    const adjustment = number(input.adjustmentPercent, 'ajuste energético (%)', -20, 15);
    const protein = number(input.proteinPerKg, 'proteína (g/kg)', 1.2, 2.2);
    const fat = number(input.fatPercent, 'gordura (%)', 20, 35);
    if (!['male', 'female'].includes(input.sex)) throw new Error('Selecione um coeficiente da equação publicada.');
    if (!['mifflin', 'harris'].includes(input.formula)) throw new Error('Selecione uma fórmula disponível.');

    // Coeficientes da equação simplificada de 1990 e da revisão de 1984.
    const restingKcal = input.formula === 'mifflin'
      ? 10 * weight + 6.25 * height - 5 * age + (input.sex === 'male' ? 5 : -161)
      : input.sex === 'male'
        ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
        : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
    const estimatedTotalKcal = restingKcal * activity;
    const targetKcal = estimatedTotalKcal * (1 + adjustment / 100);
    const proteinG = weight * protein;
    const fatG = targetKcal * fat / 100 / 9;
    const carbsG = (targetKcal - proteinG * 4 - fatG * 9) / 4;
    if (restingKcal <= 0 || carbsG < 0) throw new Error('Distribuição inviável: não há energia suficiente para esses macros. Revise os parâmetros com um profissional.');
    const assumptions = [
      'Gasto em repouso estimado por equação, sem calorimetria.',
      `Fator ${activity}: hipótese numérica de atividade aplicada ao repouso, não uma medição ou classificação automática.`,
      `Ajuste ${adjustment}% escolhido pelo usuário; não é recomendação automática de déficit ou superávit.`,
      `Proteína ${protein} g/kg e gordura ${fat}% são parâmetros escolhidos; carboidrato usa a energia restante.`,
      'Calibre a estimativa com evolução de peso e desempenho e acompanhamento profissional.',
    ];
    if (weight / ((height / 100) ** 2) >= 30) assumptions.push('Com obesidade, a meta proteica por peso atual requer avaliação individual; a calculadora não ajusta o peso automaticamente.');
    if (targetKcal < restingKcal) assumptions.push('O cenário ficou abaixo do gasto estimado em repouso: não adote como dieta sem avaliação profissional.');
    return { version, formula: input.formula, restingKcal, estimatedTotalKcal, targetKcal, proteinG, fatG, carbsG, assumptions };
  }

  // Cada linha é um registro; histórico legado não comprova séries ou sessões completas.
  function summarizeLogs(logs) {
    let knownVolumeKg = 0, completeRecords = 0, incompleteRecords = 0;
    for (const log of logs || []) {
      const rawWeight = log.weight ?? log.peso;
      const weight = Number(rawWeight);
      const rawReps = log.repsCompleted ?? log.reps;
      const reps = Number(rawReps);
      if (!['number', 'string'].includes(typeof rawWeight) || String(rawWeight).trim() === '' ||
        !['number', 'string'].includes(typeof rawReps) || String(rawReps).trim() === '' ||
        !Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps <= 0) {
        incompleteRecords++;
      } else {
        knownVolumeKg += weight * reps;
        completeRecords++;
      }
    }
    return { knownVolumeKg, completeRecords, incompleteRecords };
  }
  return { version, references, calculateNutrition, summarizeLogs };
});
