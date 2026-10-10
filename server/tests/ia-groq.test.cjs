// Hosted API is replaced here. These tests never send a key or consume inference.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIaService } = require('../src/services/ia.service');
const valid = { explanation: 'Divisões distribuem o trabalho segundo disponibilidade e recuperação, mantendo explícito o volume comparado.', sourceIds: ['split-2024'] };
const upstream = (result = valid, message = {}, reason = 'stop') => new Response(JSON.stringify({
  choices: [{ finish_reason: reason, message: { content: JSON.stringify(result), ...message } }],
}));
const service = options => createIaService({ provider: 'groq', groqApiKey: 'fixture-groq-key',
  groqModel: 'openai/gpt-oss-120b', freeTierConfirmed: true, ...options });

test('Groq exige chave, confirmação Free e modelo permitido, sem fallback para outra credencial', async () => {
  for (const options of [{ groqApiKey: '' }, { freeTierConfirmed: false }, { freeTierConfirmed: 'true' },
    { groqModel: 'llama-3.3-70b-versatile' }, { provider: 'unknown' }]) {
    let called = 0;
    const current = service({ apiKey: 'fixture-gemini-key', ...options, fetchImpl: async () => { called++; return upstream(); } });
    assert.equal(current.enabled, false);
    await assert.rejects(current.explain('divisoes'), error => error.statusCode === 503);
    assert.equal(called, 0, 'não enviar geração com configuração incompleta ou mudar provedor');
  }
});

test('Groq usa endpoint fixo, chave no header e apenas corpus curado com schema estrito', async () => {
  let calls = 0;
  const current = service({ fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer fixture-groq-key');
    assert.equal(options.headers['x-goog-api-key'], undefined);
    assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'openai/gpt-oss-120b'); assert.equal(body.stream, false);
    assert.equal(body.include_reasoning, false); assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.reasoning_format, undefined); assert.equal(body.max_completion_tokens, 2000);
    assert.equal(body.service_tier, 'on_demand'); assert.equal(body.tools, undefined);
    assert.equal(body.response_format.type, 'json_schema');
    const schema = body.response_format.json_schema;
    assert.equal(schema.strict, true); assert.equal(schema.schema.additionalProperties, false);
    assert.deepEqual(schema.schema.required, ['explanation', 'sourceIds']);
    assert.deepEqual(schema.schema.properties.sourceIds.items.enum, ['split-2024', 'acsm-2026']);
    const question = JSON.parse(body.messages[1].content);
    assert.deepEqual(Object.keys(question).sort(), ['question', 'sources']);
    assert.ok(question.sources.every(source => typeof source.id === 'string' && typeof source.summary === 'string'));
    assert.ok(!options.body.includes('fixture-groq-key'));
    return upstream(valid, { reasoning: 'private reasoning fixture', role: 'assistant' });
  } });
  const result = await current.explain('divisoes');
  assert.equal(calls, 1); assert.equal(result.generatedByAI, true);
  assert.equal(result.explanation, valid.explanation);
  assert.equal(result.sources[0].url, 'https://pubmed.ncbi.nlm.nih.gov/38595233/');
  assert.equal(result.reasoning, undefined); assert.equal(JSON.stringify(result).includes('fixture-groq-key'), false);
});

test('Groq respeita seleção explícita de GPT-OSS 20B e rejeita tema livre antes de geração', async () => {
  let model, calls = 0;
  const current = service({ groqModel: 'openai/gpt-oss-20b', fetchImpl: async (_, options) => {
    calls++; model = JSON.parse(options.body).model; return upstream();
  } });
  for (const topic of ['prescreva-dieta', ['divisoes'], {}, null]) {
    await assert.rejects(current.explain(topic), error => error.statusCode === 400);
  }
  assert.equal(calls, 0); await current.explain('divisoes'); assert.equal(model, 'openai/gpt-oss-20b');
});

test('explicação de volume recebe definições do produto separadas das fontes científicas em ambos os provedores', async t => {
  for (const provider of ['groq', 'gemini']) {
    await t.test(provider, async () => {
      let request;
      const result = { explanation: 'Tonelagem e contagem de séries são métricas distintas dos registros informados pelo aluno.', sourceIds: ['acsm-2026'] };
      const current = service({ provider, apiKey: 'fixture-gemini-key', fetchImpl: async (_, options) => {
        request = JSON.parse(options.body);
        return provider === 'groq' ? upstream(result) : new Response(JSON.stringify({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }],
        }));
      } });
      await current.explain('volume');
      const context = JSON.parse(provider === 'groq' ? request.messages[1].content : request.contents[0].parts[0].text);
      const instruction = provider === 'groq' ? request.messages[0].content : request.systemInstruction.parts[0].text;
      assert.deepEqual(context.sources.map(source => source.id), ['acsm-2026']);
      assert.equal(context.productDefinitions?.origin, 'Definições operacionais do FitFlow; não são conclusões científicas.');
      const facts = context.productDefinitions.facts.join(' ');
      assert.match(facts, /tonelagem.*carga externa.*repetições/i);
      assert.match(facts, /séries de trabalho.*contagem.*não equivale.*tonelagem/i);
      assert.match(facts, /auto relatados.*não.*estímulo muscular.*hipertrofia/i);
      assert.match(facts, /planejado.*não.*executado automaticamente/i);
      assert.match(facts, /legados.*não.*sessões completas/i);
      assert.match(facts, /finalizar.*não.*séries planejadas sem registro/i);
      assert.match(facts, /incompletos.*não.*zero.*prescrição/i);
      assert.match(facts, /Compare.*exercício.*equipamento.*técnica.*amplitude/i);
      assert.match(facts, /tonelagem.*não.*trabalho mecânico/i);
      assert.match(facts, /0 kg.*não significa ausência de trabalho ou estímulo.*peso corporal/i);
      assert.match(instruction, /Distingua.*definições operacionais.*resumos científicos/i);
      assert.match(instruction, /Não atribua.*definições do produto.*referências científicas/i);
      assert.ok(!JSON.stringify(context).includes('fixture-gemini-key'));
    });
  }
});

test('Groq recusa truncamento, recusa de segurança, JSON inválido e fonte incompatível', async () => {
  for (const fetchImpl of [async () => upstream(valid, {}, 'length'), async () => upstream(valid, {}, 'content_filter'),
    async () => upstream(valid, { refusal: 'fixture refusal' }), async () => upstream(valid, { content: '{' }),
    async () => new Response('{}'), async () => upstream({ ...valid, sourceIds: ['mifflin-1990'] }),
    async () => upstream({ ...valid, explanation: '<script>fixture</script>' }),
    async () => upstream({ ...valid, explanation: 'Uma conclusão sem suporte disponível em https://fixture.invalid' }),
    async () => upstream({ ...valid, sourceIds: [] }), async () => upstream({ ...valid, explanation: 'x'.repeat(4001) })]) {
    await assert.rejects(service({ fetchImpl }).explain('divisoes'), error => error.statusCode === 502);
  }
});

test('Groq diferencia credencial, quota e timeout sem vazar resposta nem tentar provedor pago', async () => {
  for (const [status, expected] of [[401, 503], [403, 503], [429, 429], [500, 502], [400, 502]]) {
    let calls = 0;
    const current = service({ fetchImpl: async () => { calls++; return new Response('fixture-private-upstream', { status }); } });
    await assert.rejects(current.explain('divisoes'), error => error.statusCode === expected && !error.message.includes('fixture-private'));
    assert.equal(calls, 1);
  }
  await assert.rejects(service({ fetchImpl: async () => { throw Object.assign(new Error('fixture-secret'), { name: 'TimeoutError' }); } }).explain('divisoes'),
    error => error.statusCode === 504 && !error.message.includes('fixture-secret'));
});
