const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrainingStore } = require('../../client/js/training-store');
function memoryStorage() {
  const records = new Map(); let chain = Promise.resolve();
  return {
    read: async id => structuredClone(records.get(id) || null),
    update(id, fn) { const run = chain.then(() => { const value = fn(structuredClone(records.get(id) || null)); records.set(id, structuredClone(value)); return structuredClone(value); }); chain = run.catch(() => {}); return run; },
    clear: async id => records.delete(id),
  };
}
const workout = { id: 2, name: 'A', exercises: [{ id: 3, name: 'Supino', sets: 3, reps: '8–12' }] };
const entry = { exerciseId: 3, weightKg: 20, reps: 10, rir: null, kind: 'working', notes: '' };
function queue(storage, userId, send, online = () => false, isCurrentUser = () => true) {
  let id = 0;
  return createTrainingStore({ storage, userId, send, isOnline: online, isCurrentUser,
    uuid: () => `7ba13137-8849-48e1-baba-${String(userId * 1000 + id++).padStart(12, '0')}`,
    now: () => new Date('2026-10-07T10:00:00Z') });
}
test('sessão offline persiste ao reiniciar e finalização espera start e todas as séries', async () => {
  const storage = memoryStorage(), calls = [];
  const first = queue(storage, 1, async () => {});
  const session = await first.start(workout);
  await first.addSet(session.id, entry);
  await first.complete(session.id);
  first.dispose();
  const next = queue(storage, 1, async (path, data) => { calls.push([path, data]); return { data: path.endsWith('/start') ? { id: data.id } : data }; }, () => true);
  await next.flush();
  assert.deepEqual(calls.map(x => x[0]), ['/sessoes/start', `/sessoes/${session.id}/sets`, `/sessoes/${session.id}/complete`]);
  assert.equal(calls[2][1].setIds.length, 1);
  assert.equal((await next.state()).operations.length, 0);
  assert.equal((await next.state()).sessions[0].status, 'completed');
});
test('contas isoladas e logout impede continuar envio com credenciais de outra conta', async () => {
  const storage = memoryStorage(), calls = []; let sameAccount = true;
  const a = queue(storage, 1, async () => { calls.push(1); sameAccount = false; }, () => true, () => sameAccount);
  const session = await a.start(workout); await a.addSet(session.id, entry);
  const b = queue(storage, 2, async () => calls.push(2));
  assert.equal((await b.state()).sessions.length, 0);
  await a.flush(); assert.equal(calls.length, 1);
  assert.equal((await a.state()).operations.length, 1);
  await a.dispose({ clear: true });
  assert.equal((await queue(storage, 1, async () => {}).state()).sessions.length, 0);
});
test('erro de rede conserva UUID; conflito bloqueia finalização e não confirma sincronização', async () => {
  const storage = memoryStorage(), calls = []; let failure = 0;
  const q = queue(storage, 1, async (path, data) => { calls.push(data.id); const e = new Error('failure'); e.status = failure; throw e; }, () => true);
  const session = await q.start(workout); await q.addSet(session.id, entry); await q.complete(session.id);
  await q.flush(); await q.flush();
  assert.equal(calls[0], calls[1]);
  assert.equal((await q.state()).operations.length, 3);
  failure = 409; await q.flush(); await q.flush();
  assert.equal(calls.length, 3);
  assert.equal((await q.state()).operations[0].status, 'blocked');
  assert.equal((await q.state()).sessions[0].status, 'completing');
});
test('não aceita novas séries depois que finalização entrou na fila', async () => {
  const q = queue(memoryStorage(), 1, async () => {});
  const session = await q.start(workout); await q.complete(session.id);
  await assert.rejects(() => q.addSet(session.id, entry), /finaliz/i);
});
test('cache de ficha guarda somente plano e exclui dados de pessoas e históricos legados', async () => {
  const q = queue(memoryStorage(), 1, async () => {});
  const source = { ...workout, instructor: { name: 'Nome privado', email: 'private@example.com' }, studentId: 900,
    exercises: [{ ...workout.exercises[0], workoutLogs: [{ weight: 99 }] }] };
  await q.cacheWorkouts([source]); await q.start(source);
  const stored = await q.state();
  for (const plan of [stored.workouts[0], stored.sessions[0].planSnapshot]) {
    assert.equal(plan.instructor, undefined); assert.equal(plan.studentId, undefined);
    assert.equal(plan.exercises[0].workoutLogs, undefined);
    assert.equal(plan.name, 'A');
  }
});

test('ficha offline alterada: arquivamento confirmado preserva evidência e libera outra sessão', async () => {
  const storage = memoryStorage(), calls = [];
  const revised = { ...workout, exercises: [{ ...workout.exercises[0], id: 40, name: 'Ficha revisada' }] };
  const q = queue(storage, 1, async (path, data) => {
    calls.push(path);
    if (path === '/sessoes/start') return { data: { planSnapshot: revised } };
    throw Object.assign(new Error('Exercício ausente do plano desta sessão.'), { status: 400 });
  }, () => true);
  const first = await q.start(workout); await q.addSet(first.id, entry); await q.complete(first.id); await q.flush();
  assert.deepEqual((await q.state()).operations.map(op => op.status), ['blocked', 'pending']);
  await assert.rejects(() => q.abandonBlocked(first.id), /Confirme/);
  assert.equal((await q.state()).operations.length, 2);
  await q.abandonBlocked(first.id, { confirmed: true });
  const archived = (await q.state()).sessions[0];
  assert.equal(archived.status, 'abandoned'); assert.equal(archived.sets[0].exerciseName, 'Supino');
  assert.equal(archived.recordedPlanSnapshot.exercises[0].id, 3);
  assert.equal(archived.abandonedOperations[0].payload.exerciseId, 3);
  assert.equal(archived.abandonedOperations[0].error, 'Exercício ausente do plano desta sessão.');
  assert.equal(archived.sets[0].synced, false); assert.equal((await q.state()).operations.length, 0);
  await q.flush(); assert.equal(calls.length, 2, 'arquivamento não confirma nem reenvia séries rejeitadas');
  await q.mergeHistory([{ ...first, planSnapshot: revised, sets: [], status: 'active' }]);
  assert.equal((await q.state()).sessions[0].status, 'abandoned', 'histórico remoto não reativa a partida descartada');
  await q.start(revised);
  assert.equal((await q.state()).sessions.filter(session => session.status === 'active').length, 1);
  await assert.rejects(() => q.complete(first.id), /arquivada/);
});

test('partida rejeitada arquiva somente seus envios e mantém isolamento entre contas', async () => {
  const storage = memoryStorage();
  const q = queue(storage, 1, async () => { throw Object.assign(new Error('Ficha inativa.'), { status: 409 }); }, () => true);
  const other = queue(storage, 2, async () => {});
  await other.start(workout);
  const first = await q.start(workout); await q.addSet(first.id, entry); await q.flush();
  await q.abandonBlocked(first.id, { confirmed: true });
  assert.equal((await q.state()).sessions[0].synced, false);
  assert.equal((await q.state()).sessions[0].sets.length, 1);
  assert.equal((await other.state()).sessions[0].status, 'active');
  assert.equal((await other.state()).operations.length, 1);
  const next = await q.start(workout);
  await assert.rejects(() => q.abandonBlocked(next.id, { confirmed: true }), /não tem envios rejeitados/);
  assert.equal((await q.state()).sessions.find(session => session.id === next.id).status, 'active');
});

test('gravação iniciada antes do logout não recria fila explicitamente apagada', async () => {
  for (const operation of ['start', 'cache', 'history']) {
    const storage = memoryStorage();
    const q = queue(storage, 1, async () => {});
    const pending = operation === 'start' ? q.start(workout) : operation === 'cache' ? q.cacheWorkouts([workout]) :
      q.mergeHistory([{ id: 'previous-session', status: 'completed', planSnapshot: workout, sets: [] }]);
    // O callback de uma transação pode aguardar a abertura do banco. O logout
    // encerra a instância antes de esse callback obter seus dados para gravar.
    const rejected = assert.rejects(pending, /fila desta conta foi encerrada/i);
    await q.dispose({ clear: true });
    await rejected;
    assert.equal(await storage.read(1), null, operation);
  }
});

test('expiração preserva fila já salva e rejeita atualização ainda não iniciada no armazenamento', async () => {
  const storage = memoryStorage(), q = queue(storage, 1, async () => {});
  await q.cacheWorkouts([workout]);
  const session = await q.start(workout);
  await q.addSet(session.id, entry);
  const saved = await storage.read(1);
  const pending = q.cacheWorkouts([{ ...workout, name: 'Resposta atrasada' }]);
  const rejected = assert.rejects(pending, /fila desta conta foi encerrada/i);
  await q.dispose();
  await rejected;
  assert.deepEqual(await storage.read(1), saved);
  const restored = queue(storage, 1, async () => {});
  assert.equal((await restored.state()).sessions[0].sets.length, 1);
  assert.equal((await restored.state()).operations.length, 2);
});

test('leitura já iniciada não devolve estado privado de uma instância encerrada', async () => {
  const storage = memoryStorage(), q = queue(storage, 1, async () => {});
  await q.start(workout);
  const pending = q.state();
  const rejected = assert.rejects(pending, /fila desta conta foi encerrada/i);
  await q.dispose();
  await rejected;
  assert.equal((await storage.read(1)).sessions.length, 1, 'expiração conserva os registros para a próxima autenticação');
});

test('callback local de outra aba não recria fila após descarte mesmo antes do evento de logout', async () => {
  const storage = memoryStorage(); let current = true;
  const old = queue(storage, 1, async () => {}, () => false, () => current);
  const pending = old.start(workout);
  // The shared epoch has changed, but the old tab has not received its event.
  current = false; await storage.clear(1);
  const rejected = assert.rejects(pending, /sessão mudou/i);
  await rejected; assert.equal(await storage.read(1), null);
});
