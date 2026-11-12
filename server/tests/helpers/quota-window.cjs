'use strict';
module.exports = async function quotaWindow(clock, run, { wait = delay => new Promise(resolve => setTimeout(resolve, delay)) } = {}) {
  const windowMs = 900000, marginMs = 30000;
  const read = async () => {
    const value = await clock();
    if (!Number.isSafeInteger(value) || value < 0) throw Object.assign(new Error('Relógio do banco inválido para o gate de quota.'), { code: 'QUOTA_TEST_CLOCK' });
    return value;
  };
  let before = await read();
  const remaining = windowMs - before % windowMs;
  if (remaining <= marginMs) {
    // Wait before creating any hits; never reset or retry an actual quota.
    await wait(remaining + 50);
    before = await read();
    if (windowMs - before % windowMs <= marginMs) throw Object.assign(new Error('Não foi possível iniciar o gate longe da fronteira de janela.'), { code: 'QUOTA_TEST_WINDOW' });
  }
  const result = await run();
  const after = await read();
  if (after < before || Math.floor(before / windowMs) !== Math.floor(after / windowMs)) throw Object.assign(new Error('Gate atravessou uma janela de quota; resultado inconclusivo, não aprovado.'), { code: 'QUOTA_TEST_WINDOW' });
  return result;
};
