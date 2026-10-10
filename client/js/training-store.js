(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.FitFlowTrainingStore = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function planOnly(workout) {
    return { id: workout.id, name: workout.name, description: workout.description || null, notes: workout.notes || null,
      exercises: workout.exercises.map(e => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup || null,
        sets: e.sets, reps: e.reps, restSeconds: e.restSeconds ?? null, suggestedLoad: e.suggestedLoad || null,
        notes: e.notes || null, orderIndex: e.orderIndex ?? 0 })) };
  }
  function createIndexedDbStorage(indexedDB = globalThis.indexedDB) {
    if (!indexedDB) throw new Error('Este navegador não oferece armazenamento persistente para a fila.');
    let dbPromise;
    function database() {
      if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('fitflow-training-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('accounts', { keyPath: 'userId' });
        request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
        request.onerror = () => { dbPromise = null; reject(new Error('Não foi possível abrir a fila local.')); };
        request.onblocked = () => { dbPromise = null; reject(new Error('Feche outras abas do FitFlow para atualizar a fila local.')); };
      });
      return dbPromise;
    }
    async function transact(userId, mode, transform) {
      const db = await database();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('accounts', mode), store = tx.objectStore('accounts'); let result, failure;
        const request = store.get(userId);
        request.onsuccess = () => {
          try {
            result = transform(request.result || null);
            if (mode === 'readwrite') { if (result === null) store.delete(userId); else store.put(result); }
          } catch (error) { failure = error; tx.abort(); }
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(failure || new Error('Não foi possível salvar a série neste dispositivo. Libere espaço e tente novamente.'));
      });
    }
    return { read: userId => transact(userId, 'readonly', value => value), update: (userId, fn) => transact(userId, 'readwrite', fn), clear: userId => transact(userId, 'readwrite', () => null) };
  }
  function createTrainingStore({ userId, storage = createIndexedDbStorage(), send, isOnline = () => globalThis.navigator.onLine, isCurrentUser = () => true, uuid = () => globalThis.crypto.randomUUID(), now = () => new Date(), onChange = () => {} }) {
    if (!Number.isSafeInteger(userId) || userId < 1 || typeof send !== 'function') throw new Error('Informe um usuário autenticado e um transporte.');
    let disposed = false, running = null;
    const empty = () => ({ userId, workouts: [], sessions: [], operations: [], nextSequence: 1 });
    function active() { if (disposed) throw new Error('A fila desta conta foi encerrada.'); }
    async function mutate(fn, { serverAcknowledgement = false } = {}) {
      active();
      const result = await storage.update(userId, data => {
        // Opening IndexedDB and obtaining the transaction's row are asynchronous.
        // A logout can dispose this instance while that work is still pending.
        active();
        if (!serverAcknowledgement && !isCurrentUser()) throw new Error('A sessão mudou. Entre novamente para registrar neste dispositivo.');
        const state = data || empty(); fn(state); return state;
      });
      if (!disposed) onChange(result);
      return result;
    }
    function operation(state, sessionId, type, path, payload) {
      state.operations.push({ id: uuid(), sessionId, type, path, payload, sequence: state.nextSequence++, status: 'pending', error: null });
    }
    function find(state, id) { const session = state.sessions.find(s => s.id === id); if (!session) throw new Error('Sessão local não encontrada.'); return session; }
    const store = {
      async state() { active(); const result = await storage.read(userId); active(); return result || empty(); },
      async cacheWorkouts(workouts) { return mutate(state => { state.workouts = workouts.map(planOnly); }); },
      async start(workout) {
        if (!workout?.id || !Array.isArray(workout.exercises) || !workout.exercises.length) throw new Error('Escolha uma ficha com exercícios.');
        const id = uuid(), clientStartedAt = now().toISOString();
        const result = await mutate(state => {
          if (state.sessions.some(s => ['active', 'completing'].includes(s.status))) throw new Error('Retome ou finalize sua sessão atual antes de iniciar outra.');
          state.sessions.push({ id, workoutId: workout.id, clientStartedAt, status: 'active', planSnapshot: planOnly(workout), recordedPlanSnapshot: planOnly(workout), sets: [], synced: false });
          operation(state, id, 'start', '/sessoes/start', { id, workoutId: workout.id, clientStartedAt });
        });
        return find(result, id);
      },
      async addSet(sessionId, values) {
        const data = { ...values, id: uuid(), performedAt: now().toISOString() };
        const result = await mutate(state => {
          const session = find(state, sessionId);
          if (session.status !== 'active') throw new Error('Esta sessão já está sendo finalizada.');
          if (!session.planSnapshot.exercises.some(e => e.id === data.exerciseId)) throw new Error('Exercício ausente desta sessão.');
          if (session.sets.length >= 1000) throw new Error('Limite de séries da sessão atingido.');
          const exercise = session.planSnapshot.exercises.find(e => e.id === data.exerciseId);
          session.sets.push({ ...data, exerciseName: exercise.name, muscleGroup: exercise.muscleGroup || null, synced: false });
          operation(state, sessionId, 'set', `/sessoes/${sessionId}/sets`, data);
        });
        return find(result, sessionId);
      },
      async complete(sessionId) {
        const result = await mutate(state => {
          const session = find(state, sessionId);
          if (session.status === 'completing' || session.status === 'completed') return;
          if (session.status !== 'active') throw new Error('Esta sessão foi arquivada neste dispositivo. Inicie outra sessão.');
          session.status = 'completing';
          operation(state, sessionId, 'complete', `/sessoes/${sessionId}/complete`, { setIds: session.sets.map(s => s.id).sort() });
        });
        return find(result, sessionId);
      },
      async abandonBlocked(sessionId, { confirmed = false } = {}) {
        if (confirmed !== true) throw new Error('Confirme o arquivamento dos envios desta sessão.');
        if (running) await running;
        const result = await mutate(state => {
          const session = find(state, sessionId);
          if (session.status === 'abandoned') return;
          const operations = state.operations.filter(op => op.sessionId === sessionId);
          if (!operations.some(op => op.status === 'blocked')) throw new Error('Esta sessão não tem envios rejeitados para arquivar.');
          session.status = 'abandoned'; session.abandonedAt = now().toISOString();
          // Keep the rejected payloads and all recorded sets as local evidence.
          // No completion or exercise substitution is sent to the server.
          session.abandonedOperations = operations;
          state.operations = state.operations.filter(op => op.sessionId !== sessionId);
        });
        return find(result, sessionId);
      },
      async mergeHistory(sessions) {
        return mutate(state => {
          for (const incoming of sessions) {
            const local = state.sessions.find(s => s.id === incoming.id);
            if (!local) state.sessions.push({ ...incoming, synced: true, sets: incoming.sets.map(s => ({ ...s, synced: true })) });
            else {
              local.planSnapshot = incoming.planSnapshot;
              for (const entry of incoming.sets) {
                const existing = local.sets.find(s => s.id === entry.id);
                if (existing) Object.assign(existing, entry, { synced: true });
                else local.sets.push({ ...entry, synced: true });
              }
              if (local.status === 'abandoned') local.serverStatus = incoming.status;
              else if (!state.operations.some(op => op.sessionId === local.id)) Object.assign(local, { status: incoming.status, summary: incoming.summary, synced: true });
            }
          }
          // A blocked completion can be retried after incorporating records saved by another tab.
          for (const op of state.operations) if (op.type === 'complete' && op.status === 'blocked') {
            const session = find(state, op.sessionId);
            if (session.status === 'completing' && session.sets.every(s => s.synced)) {
              op.payload.setIds = session.sets.map(s => s.id).sort(); op.status = 'pending'; op.error = null;
            }
          }
        });
      },
      async flush() {
        active();
        if (running) return running;
        running = (async () => {
          while (!disposed && isCurrentUser() && isOnline()) {
            const state = await store.state(), blocked = new Set();
            const pending = state.operations.slice().sort((a, b) => a.sequence - b.sequence).find(op => {
              if (op.status === 'blocked') { blocked.add(op.sessionId); return false; }
              return !blocked.has(op.sessionId);
            });
            if (!pending) break;
            try {
              if (disposed || !isCurrentUser()) break;
              const response = await send(pending.path, pending.payload);
              if (disposed) break;
              await mutate(current => {
                const session = find(current, pending.sessionId), received = response?.data;
                if (pending.type === 'start') { session.synced = true; if (received?.planSnapshot) session.planSnapshot = received.planSnapshot; }
                if (pending.type === 'set') { const entry = session.sets.find(s => s.id === pending.payload.id); if (entry) entry.synced = true; }
                if (pending.type === 'complete') { session.status = 'completed'; session.summary = received?.summary; }
                current.operations = current.operations.filter(op => op.id !== pending.id);
              }, { serverAcknowledgement: true });
            } catch (error) {
              if (disposed) break;
              if (error.status === 0 || error.status === undefined || error.status >= 500 || error.status === 401 || error.status === 429) {
                onChange({ ...(await store.state()), syncError: error.status === 401 ? 'Entre novamente na mesma conta para sincronizar.' : error.message }); break;
              }
              await mutate(current => {
                const op = current.operations.find(o => o.id === pending.id);
                if (op) { op.status = 'blocked'; op.error = error.message || 'Registro rejeitado pelo servidor. Revise a sessão.'; }
              });
            }
          }
        })().finally(() => { running = null; });
        return running;
      },
      async dispose({ clear = false } = {}) { disposed = true; if (clear) await storage.clear(userId); },
    };
    return store;
  }
  return { createTrainingStore, createIndexedDbStorage };
});
