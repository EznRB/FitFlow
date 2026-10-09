const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../client/js/api.js'), 'utf8');
function fixture() {
  let reply, epoch = 'first'; const events = [];
  const Auth = { user: { id: 7 }, generation: 1, getSessionEpoch: () => epoch };
  const context = vm.createContext({ Auth, fetch: () => new Promise(resolve => { reply = resolve; }),
    window: { dispatchEvent: event => events.push(event.type) }, CustomEvent: class { constructor(type) { this.type = type; } } });
  vm.runInContext(`${source}\nglobalThis.testAPI = API;`, context);
  return { api: context.testAPI, Auth, events, epoch: value => { epoch = value; },
    reply: (status = 200) => reply(new Response(JSON.stringify({ data: { name: 'Private fixture' } }), { status })) };
}
test('GET antigo após logout ou troca de conta não entrega dados pessoais nem emite 401 antigo', async () => {
  for (const status of [200, 401]) {
    const current = fixture(), request = current.api.get('/alunos/1');
    current.Auth.user = null; current.Auth.generation++; current.epoch('second'); current.reply(status);
    await assert.rejects(request, error => error.status === 409 && error.obsolete === true && !error.data);
    assert.deepEqual(current.events, []);
  }
});
test('retorno à mesma conta e marcador de outra aba descartam GET antigo', async () => {
  for (const sameAccount of [true, false]) {
    const current = fixture(), request = current.api.get('/planos');
    if (sameAccount) current.Auth.generation += 2;
    current.epoch('another-tab'); current.reply();
    await assert.rejects(request, error => error.status === 409 && error.obsolete === true);
  }
});
test('GET da sessão atual retorna dados; resposta de escrita não é convertida em rejeição após commit', async () => {
  const read = fixture(), readRequest = read.api.get('/alunos'); read.reply();
  assert.equal((await readRequest).data.name, 'Private fixture');
  const write = fixture(), writeRequest = write.api.post('/pagamentos', { idempotencyKey: 'fixture' });
  write.Auth.user = null; write.Auth.generation++; write.epoch('another-tab'); write.reply();
  assert.equal((await writeRequest).data.name, 'Private fixture');
});
