const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const zlib = require('node:zlib');

test('compressed JSON remains usable after late invalid gzip bytes', { timeout: 10000 }, async (t) => {
  const child = fork(path.join(__dirname, 'fixtures/body-parser-compression-server.cjs'), [], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const exited = once(child, 'exit').then(([code, signal]) => {
    if (code === 0) return new Promise(() => {});
    throw new Error(`Isolated parser exited (${code ?? signal}): ${stderr}`);
  });
  // Race startup and every request against process exit, so an actual crash fails
  // with its diagnostic instead of being hidden behind a socket reset or timeout.
  const { port } = (await Promise.race([once(child, 'message'), exited]))[0];
  const json = { compression: 'ok' };
  const gzip = zlib.gzipSync(JSON.stringify(json));
  let sequence = 0;
  function request(lateBytes) {
    return new Promise((resolve, reject) => {
      const requestId = String(++sequence);
      const first = lateBytes ? Buffer.concat([gzip, Buffer.from([0])]) : gzip;
      const trailing = Buffer.from('invalid');
      const req = http.request({ host: '127.0.0.1', port, path: '/', method: 'POST', agent: false,
        headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', 'x-fixture-id': requestId,
          'content-length': first.length + (lateBytes ? trailing.length : 0) },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', (error) => {
        // Give the child's exit event time to report an uncaught decoder error.
        setTimeout(() => reject(error), 100);
      });
      req.setTimeout(3000, () => req.destroy(new Error('Local parser request timed out')));
      if (lateBytes) {
        // Deliver the tail only after the decoder has completed the valid frame.
        const onParsed = message => {
          if (!message.parsed || message.id !== requestId) return;
          child.off('message', onParsed);
          req.end(trailing);
        };
        child.on('message', onParsed);
        req.once('close', () => child.off('message', onParsed));
        req.write(first);
      } else req.end(first);
    });
  }
  assert.deepEqual(await Promise.race([request(false), exited]), { status: 200, body: JSON.stringify(json) });
  assert.deepEqual(await Promise.race([request(true), exited]), { status: 200, body: JSON.stringify(json) });
  assert.deepEqual(await Promise.race([request(false), exited]), { status: 200, body: JSON.stringify(json) });
  child.send('stop');
  // Shutdown also proves the parser did not leave an active request behind.
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, stderr);
});
