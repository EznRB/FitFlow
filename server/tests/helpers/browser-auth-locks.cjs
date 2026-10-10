// FIFO origin lock shared by independent browser VM contexts in auth regressions.
function browserAuthLocks() {
  const states = new Map();
  return { request(name, options, callback) {
    const state = states.get(name) || { active: false, queue: [] };
    states.set(name, state);
    return new Promise((resolve, reject) => {
      const entry = { callback, resolve, reject, started: false };
      const abort = () => {
        if (entry.started) return;
        state.queue = state.queue.filter(item => item !== entry);
        reject(Object.assign(new Error('Lock cancelled'), { name: 'AbortError' }));
      };
      if (options.signal?.aborted) { abort(); return; }
      options.signal?.addEventListener('abort', abort, { once: true });
      entry.run = async () => {
        entry.started = true; options.signal?.removeEventListener('abort', abort);
        try { resolve(await callback()); } catch (error) { reject(error); }
        finally { state.active = false; drain(); }
      };
      function drain() {
        if (state.active || !state.queue.length) return;
        state.active = true;
        queueMicrotask(state.queue.shift().run);
      }
      state.queue.push(entry); drain();
    });
  } };
}
module.exports = { browserAuthLocks };
