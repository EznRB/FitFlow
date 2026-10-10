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

const systemInstruction = 'Explique em português brasileiro somente os resumos fornecidos. Não invente números, referências ou conclusões. Não prescreva dieta, exercício ou carga. Explicite incerteza e população adulta saudável. Tonelagem não mede hipertrofia; registros legados não representam sessões completas. Responda texto simples, sem HTML, links ou Markdown. Não apresente cálculos. Retorne explanation e sourceIds citados.';
const groqModels = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);

function createIaService({ provider = process.env.IA_PROVIDER || 'gemini',
  apiKey = process.env.GEMINI_API_KEY || '', model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  groqApiKey = process.env.GROQ_API_KEY || '', groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  freeTierConfirmed = process.env.GROQ_FREE_TIER_CONFIRMED === 'true', fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  // A key alone does not establish the account's billing plan. The operator must
  // verify Free in the console before opting in; this app never changes plans.
  const enabled = provider === 'groq' ? Boolean(groqApiKey && freeTierConfirmed === true && groqModels.has(groqModel)) :
    provider === 'gemini' && Boolean(apiKey && /^[a-zA-Z0-9.-]+$/.test(model));
  return {
    enabled,
    provider: ['gemini', 'groq'].includes(provider) ? provider : undefined,
    async explain(topic) {
      if (typeof topic !== 'string' || !Object.hasOwn(topics, topic)) throw new AppError('Tema de explicação inválido.', 400);
      if (!enabled) throw new AppError('IA não configurada. As fórmulas e referências continuam disponíveis.', 503);
      const selected = topics[topic];
      const context = selected.ids.map(id => ({ id, ...references[id] }));
      try {
        let text;
        if (provider === 'groq') {
          const response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({ model: groqModel, stream: false, reasoning_effort: 'low', include_reasoning: false,
              max_completion_tokens: 2000, service_tier: 'on_demand',
              messages: [{ role: 'system', content: systemInstruction },
                { role: 'user', content: JSON.stringify({ question: selected.title, sources: context }) }],
              response_format: { type: 'json_schema', json_schema: { name: 'fitflow_educational_explanation', strict: true,
                schema: { type: 'object', additionalProperties: false,
                  properties: { explanation: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string', enum: selected.ids } } },
                  required: ['explanation', 'sourceIds'],
                } } },
            }),
          });
          if ([401, 403].includes(response.status)) throw new AppError('IA indisponível. A administração precisa verificar o acesso ao provedor.', 503);
          if (response.status === 429) throw new AppError('A quota gratuita da IA foi atingida. Tente novamente mais tarde; as referências continuam disponíveis.', 429);
          if (!response.ok) throw new AppError('O provedor de IA está indisponível. Tente novamente mais tarde.', 502);
          const payload = await response.json(), candidate = payload.choices?.[0];
          if (candidate?.finish_reason !== 'stop' || candidate.message?.refusal || typeof candidate.message?.content !== 'string') {
            throw new AppError('A IA não concluiu uma explicação válida.', 502);
          }
          text = candidate.message.content;
        } else {
          // Chave no header, endpoint fixo e timeout evitam exposição em URLs e espera indefinida.
          const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
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
          text = candidate.content?.parts?.map(p => p.text || '').join('') || '';
        }
        const result = JSON.parse(text);
        // Valida formato e referências permitidas; não comprova cada afirmação gerada.
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
