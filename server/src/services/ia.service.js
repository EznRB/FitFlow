/**
 * Explicações educativas com fontes curadas. Não recebe perfil ou dados do aluno.
 * O modelo não faz cálculos nem publica prescrição; sua resposta ainda exige leitura crítica.
 */
const AppError = require('../utils/AppError');
const { references } = require('../../../client/js/science');
const topics = {
  divisoes: { title: 'Como comparar divisões de treino?', ids: ['split-2024', 'acsm-2026'] },
  volume: { title: 'Como distinguir séries previstas, registros e volume executado?', ids: ['acsm-2026'] },
  nutricao: { title: 'Por que fórmulas de nutrição são estimativas e os parâmetros precisam de revisão?', ids: ['mifflin-1990', 'harris-1984', 'protein-2018', 'dri'] },
};

function createIaService({ apiKey = process.env.GEMINI_API_KEY || '', model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  return {
    enabled: Boolean(apiKey),
    async explain(topic) {
      if (typeof topic !== 'string' || !Object.hasOwn(topics, topic)) throw new AppError('Tema de explicação inválido.', 400);
      if (!apiKey) throw new AppError('IA não configurada. As fórmulas e referências continuam disponíveis.', 503);
      if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new AppError('Configuração do modelo de IA inválida.', 503);
      const selected = topics[topic];
      const context = selected.ids.map(id => ({ id, ...references[id] }));
      try {
        // Chave no header, endpoint fixo e timeout evitam exposição em URLs e espera indefinida.
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: 'Explique em português brasileiro somente os resumos fornecidos. Não invente números, referências ou conclusões. Não prescreva dieta, exercício ou carga. Explicite incerteza e população adulta saudável. Tonelagem não mede hipertrofia; registros legados não representam sessões completas. Responda texto simples, sem HTML, links ou Markdown. Não apresente cálculos. Retorne explanation e sourceIds citados.' }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify({ question: selected.title, sources: context }) }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1200,
              ...(model.startsWith('gemini-3.5-flash-lite') ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } } : {}),
              responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: {
                type: 'object', properties: { explanation: { type: 'string' },
                  sourceIds: { type: 'array', items: { type: 'string', enum: selected.ids } } },
                required: ['explanation', 'sourceIds'],
              } } } },
          }),
        });
        if (!response.ok) throw new AppError('O provedor de IA está indisponível. Tente novamente mais tarde.', 502);
        const payload = await response.json();
        const candidate = payload.candidates?.[0];
        if (candidate?.finishReason !== 'STOP') throw new AppError('A IA não concluiu uma explicação válida.', 502);
        const text = candidate.content?.parts?.map(p => p.text || '').join('') || '';
        const result = JSON.parse(text);
        // A sintaxe estruturada do provedor não dispensa validação semântica no backend.
        if (typeof result.explanation !== 'string' || result.explanation.trim().length < 20 || result.explanation.length > 4000 ||
          /[<>]|https?:\/\//i.test(result.explanation) || !Array.isArray(result.sourceIds) || !result.sourceIds.length ||
          result.sourceIds.length > selected.ids.length || result.sourceIds.some(id => !selected.ids.includes(id))) {
          throw new AppError('A IA retornou uma explicação fora do formato permitido.', 502);
        }
        return { explanation: result.explanation.trim(), generatedByAI: true,
          sources: [...new Set(result.sourceIds)].map(id => ({ id, title: references[id].title, url: references[id].url })) };
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (['AbortError', 'TimeoutError'].includes(error.name)) throw new AppError('A IA demorou a responder. Tente novamente.', 504);
        throw new AppError('Não foi possível obter uma explicação válida da IA.', 502);
      }
    },
  };
}
module.exports = { createIaService };
