(function (root) {
  'use strict';
  let active = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const sameBytes = (a, b) => { const left = new TextEncoder().encode(a), right = new TextEncoder().encode(b); return left.length === right.length && left.every((byte, i) => byte === right[i]); };
  function open() {
    if (!Auth.user || !Number.isSafeInteger(Auth.user.id)) return;
    active?.dispose();
    const owner = { userId: Auth.user.id, generation: Auth.generation, epoch: Auth.sessionEpoch,
      page: typeof App === 'undefined' ? null : App.currentPage };
    Modal.open('Segurança da conta', `<form id="password-change-form" class="password-change-form">
      <div class="password-change-identity"><span>Sua conta</span><strong>${escape(Auth.user.name)}</strong><span>${escape(Auth.user.email)}</span></div>
      <p class="password-change-notice">Ao alterar a senha, as sessões anteriores serão invalidadas. Entre novamente com a nova senha para continuar.</p>
      <div class="form-group"><label for="password-change-current">Senha atual</label><input id="password-change-current" class="form-input" type="password" autocomplete="current-password" required></div>
      <div class="form-group"><label for="password-change-new">Nova senha</label><input id="password-change-new" class="form-input" type="password" autocomplete="new-password" required minlength="8" aria-describedby="password-change-hint"></div>
      <div class="form-group"><label for="password-change-confirm">Confirmar nova senha</label><input id="password-change-confirm" class="form-input" type="password" autocomplete="new-password" required minlength="8"></div>
      <p id="password-change-hint" class="password-change-hint">Use pelo menos 8 caracteres, até 72 bytes. Acentos e emojis podem ocupar mais de um byte.</p>
      <button id="password-change-toggle" class="btn btn-ghost password-change-toggle" type="button" aria-pressed="false" aria-controls="password-change-current password-change-new password-change-confirm">Mostrar senhas</button>
      <p class="password-change-hint">Registros de treino pendentes neste dispositivo continuam guardados para você entrar novamente com a mesma conta.</p>
      <p id="password-change-feedback" class="password-change-feedback" role="status" aria-live="polite"></p>
      <div class="password-change-actions"><button id="password-change-cancel" class="btn btn-secondary" type="button">Cancelar</button><button id="password-change-submit" class="btn btn-primary" type="submit">Alterar senha e entrar novamente</button></div>
    </form>`, []);
    const form = document.getElementById('password-change-form'), body = Modal.bodyEl;
    const fields = ['current', 'new', 'confirm'].map(name => document.getElementById(`password-change-${name}`));
    const submit = document.getElementById('password-change-submit'), cancel = document.getElementById('password-change-cancel');
    const toggle = document.getElementById('password-change-toggle'), feedback = document.getElementById('password-change-feedback');
    const identityCurrent = () => Auth.user?.id === owner.userId && Auth.generation === owner.generation && Auth.sessionEpoch === owner.epoch
      && (typeof Auth.getSessionEpoch !== 'function' || Auth.getSessionEpoch() === owner.epoch);
    const current = () => identityCurrent() && Modal.isOpen() && Modal.bodyEl === body && form?.isConnected !== false
      && document.getElementById('password-change-form') === form && body.contains(form)
      && (typeof App === 'undefined' || App.currentPage === owner.page);
    const clear = () => { fields.forEach(field => { if (field) { field.value = ''; field.type = 'password'; } }); };
    let busy = false, disposed = false, observer;
    const onTransition = () => { if (!current()) dispose(); };
    const onNavigate = () => dispose();
    function dispose() {
      clear(); if (disposed) return; disposed = true;
      observer?.disconnect(); root.removeEventListener('auth:logout', onTransition);
      root.removeEventListener('navigate', onNavigate); root.removeEventListener('storage', onTransition);
      if (active?.form === form) active = null;
    }
    active = { form, dispose };
    observer = new MutationObserver(onTransition);
    observer.observe(body, { childList: true }); observer.observe(Modal.overlay, { attributes: true, attributeFilter: ['style'] });
    root.addEventListener('auth:logout', onTransition); root.addEventListener('navigate', onNavigate); root.addEventListener('storage', onTransition);
    cancel.addEventListener('click', () => { if (current()) { dispose(); Modal.close(); } });
    toggle.addEventListener('click', () => {
      if (!current() || busy) return;
      const visible = toggle.getAttribute('aria-pressed') !== 'true';
      fields.forEach(field => { field.type = visible ? 'text' : 'password'; });
      toggle.setAttribute('aria-pressed', String(visible)); toggle.textContent = visible ? 'Ocultar senhas' : 'Mostrar senhas';
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      if (!current()) { dispose(); return; }
      const [old, next, confirmation] = fields.map(field => field.value);
      const bytes = value => new TextEncoder().encode(value).length;
      if (!old || bytes(old) > 72 || next.length < 8 || !next.trim() || bytes(next) > 72 || next !== confirmation || sameBytes(old, next)) {
        feedback.textContent = 'Confira a senha atual, a confirmação e uma nova senha diferente, com pelo menos 8 caracteres e até 72 bytes.'; return;
      }
      busy = true; submit.disabled = true; cancel.disabled = true; toggle.disabled = true;
      fields.forEach(field => { field.disabled = true; }); form.setAttribute('aria-busy', 'true');
      feedback.textContent = 'Alterando a senha e verificando a sessão…';
      try {
        const result = await Auth.changePassword({ currentPassword: old, newPassword: next },
          { userId: owner.userId, generation: owner.generation, epoch: owner.epoch, isCurrent: current });
        // Auth owns reauthentication messages and cleanup; no stale form affects a new account.
        if (current()) feedback.textContent = result?.changed === true
          ? 'Senha alterada. Entre novamente com a nova senha.' : 'A alteração não foi confirmada. Confira sua sessão.';
      } catch (error) {
        if (current()) feedback.textContent = error.message || 'Não foi possível confirmar a alteração. Confira sua conexão.';
      } finally {
        clear(); busy = false;
        if (current()) { submit.disabled = false; cancel.disabled = false; toggle.disabled = false; fields.forEach(field => { field.disabled = false; });
          toggle.setAttribute('aria-pressed', 'false'); toggle.textContent = 'Mostrar senhas'; form.setAttribute('aria-busy', 'false'); }
      }
    });
  }
  root.PasswordChange = Object.freeze({ open });
})(typeof window !== 'undefined' ? window : globalThis);
