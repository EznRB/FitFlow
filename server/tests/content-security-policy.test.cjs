const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { once } = require('node:events');
const { directives, policy } = require('../src/config/contentSecurityPolicy');
test('HTTP permite SDK oficial e bloqueia handlers inline e eval', async t => {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives } }));
  app.get('/', (req, res) => res.send('<!doctype html><title>Teste</title>'));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(response.headers.get('content-security-policy').replace(/;\s*/g, ';'), policy.replace(/;\s*/g, ';'));
  assert.deepEqual(directives.scriptSrc, ["'self'", 'https://sdk.mercadopago.com', 'https://http2.mlstatic.com']); assert.deepEqual(directives.scriptSrcAttr, ["'none'"]);
  assert.ok(!directives.scriptSrc.includes("'unsafe-inline'")); assert.ok(!directives.scriptSrc.includes("'unsafe-eval'"));
});

test('campos seguros usam frames oficiais sem liberar origens arbitrárias', () => {
  assert.ok(directives.frameSrc.includes('https://secure-fields.mercadopago.com'));
  assert.ok(directives.frameSrc.includes('https://api-static.mercadopago.com'));
  assert.ok(directives.connectSrc.includes('https://api.mercadopago.com'));
  for (const directive of ['scriptSrc', 'connectSrc', 'frameSrc']) {
    assert.ok(!directives[directive].includes('*'));
    assert.ok(!directives[directive].includes('https:'));
  }
  assert.deepEqual(directives.frameAncestors, ["'none'"]);
});
test('Vercel inclui a mesma política nas respostas estáticas antes de encaminhar rotas', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
  assert.equal(config.routes[0].headers['Content-Security-Policy'], policy);
  assert.equal(config.routes[0].continue, true);
  assert.equal(config.routes[1].src, '/api/(.*)');
});
test('fontes do aplicativo não reintroduzem handlers executáveis em atributos HTML', () => {
  const root = path.resolve(__dirname, '../../client');
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'vendor') continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) inspect(file);
      else if (/\.(?:js|html)$/.test(entry.name)) {
        assert.ok(!/\s+on(?:click|input|change|submit|error|load|focus|mouseover)\s*=\s*["']/i.test(fs.readFileSync(file, 'utf8')), `${path.relative(root, file)} contém handler HTML inline.`);
      }
    }
  }
  inspect(root);
});
