// O provedor externo é substituído por respostas controladas, sem usar chave ou cobrar geração.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIaService } = require('../src/services/ia.service.js');
const valid = { explanation: 'Divisões organizam a distribuição do treino conforme a rotina e o volume.', sourceIds: ['split-2024'] };
function upstream(content = valid) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(content) }] }, finishReason: 'STOP' }] }));
}
test('chave ausente não chama provedor e assunto inválido retorna 400', async () => {
  let called = false;
  const service = createIaService({ apiKey: '', fetchImpl: async () => { called = true; } });
  await assert.rejects(service.explain('divisoes'), e => e.statusCode === 503);
  assert.equal(called, false);
  await assert.rejects(service.explain('prescreva-dieta'), e => e.statusCode === 400);
});
test('tema só aceita string enum e nunca coerções de arrays ou objetos', async () => {
  let called = false;
  const service = createIaService({ apiKey: 'test', fetchImpl: async () => { called = true; return upstream(); } });
  for (const topic of [['divisoes'], { toString: null }, null, {}, 1]) {
    await assert.rejects(service.explain(topic), e => e.statusCode === 400);
  }
  assert.equal(called, false);
});
test('resposta válida recebe fontes do servidor e chave só vai no header', async () => {
  const service = createIaService({ apiKey: 'test-key', fetchImpl: async (url, options) => {
    assert.ok(!url.includes('test-key'));
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.ok(!options.body.includes('weightKg'));
    const config = JSON.parse(options.body).generationConfig;
    assert.equal(config.responseFormat.text.mimeType, 'APPLICATION_JSON');
    assert.equal(config.responseSchema, undefined);
    assert.equal(config.thinkingConfig.thinkingBudget, undefined);
    assert.equal(config.thinkingConfig.thinkingLevel, 'MINIMAL');
    return upstream();
  } });
  const result = await service.explain('divisoes');
  assert.equal(result.generatedByAI, true);
  assert.equal(result.sources[0].url, 'https://pubmed.ncbi.nlm.nih.gov/38595233/');
});
test('fonte inventada, tema incompatível e JSON truncado são recusados', async () => {
  for (const content of [{ ...valid, sourceIds: ['inventada'] }, { ...valid, sourceIds: ['mifflin-1990'] },
    { ...valid, explanation: '' }, { ...valid, explanation: '<script>alert(1)</script>' }]) {
    const service = createIaService({ apiKey: 'test', fetchImpl: async () => upstream(content) });
    await assert.rejects(service.explain('divisoes'), e => e.statusCode === 502);
  }
  const broken = createIaService({ apiKey: 'test', fetchImpl: async () => new Response('{}') });
  await assert.rejects(broken.explain('divisoes'), e => e.statusCode === 502);
});
test('timeout, falha do provedor e bloqueio de conteúdo têm erros seguros', async () => {
  for (const [fetchImpl, status] of [
    [async () => { const e = new Error('secret'); e.name = 'TimeoutError'; throw e; }, 504],
    [async () => new Response('secret', { status: 500 }), 502],
    [async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] })), 502],
  ]) {
    const service = createIaService({ apiKey: 'test', fetchImpl });
    await assert.rejects(service.explain('divisoes'), e => e.statusCode === status && !e.message.includes('secret'));
  }
});
