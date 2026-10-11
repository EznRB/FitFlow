/** Registros administrativos de correção/devolução. Nunca executa uma transação no provedor. */
(function (root) {
  'use strict';
  const snapshots = new Map(), rejected = new Map();
  const key = actor => `fitflow_payment_adjustment_v1:${actor}`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const cents = value => {
    const text = String(value ?? '');
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) throw new Error('Informe um valor em reais com até duas casas decimais.');
    const [whole, fraction = ''] = text.split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  };
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
  const civil = value => {
    const text = String(value ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number(text.slice(0, 4)) < 1000) return null;
    const date = new Date(`${text}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
  };
  const displayDate = value => { const date = civil(value); return date ? date.split('-').reverse().join('/') : 'Não informado'; };
  const inputDate = value => { const date = civil(value); return date === value ? date : null; };
  const today = () => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = name => parts.find(item => item.type === name).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  const balance = p => cents(p.amount) - (p.adjustments || []).reduce((total, event) => total + cents(event.amount), 0);
  const activeStudent = p => p.student?.user?.active === true && p.student?.status !== 'inactive';
  const identity = () => {
    if (typeof Auth === 'undefined' || Auth.user?.role !== 'admin' || !Number.isSafeInteger(Auth.user.id)) throw new Error('Entre com uma conta de administrador.');
    return { actor: Auth.user.id, generation: Auth.generation,
      epoch: typeof Auth.getSessionEpoch === 'function' ? Auth.sessionEpoch : null };
  };
  const sameIdentity = captured => typeof Auth !== 'undefined' && Auth.user?.id === captured.actor && Auth.user.role === 'admin'
    && Auth.generation === captured.generation && (typeof Auth.getSessionEpoch !== 'function'
      || (Auth.sessionEpoch === captured.epoch && Auth.getSessionEpoch() === captured.epoch));
  function read(actor) {
    const raw = sessionStorage.getItem(key(actor));
    if (!raw) return null;
    let saved;
    try { saved = JSON.parse(raw); } catch { throw new Error('O envio anterior precisa ser revisado antes de continuar.'); }
    if (!saved || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(saved.id)
      || !/^[a-f0-9]{64}$/.test(saved.fingerprint) || Object.keys(saved).length !== 2)
      throw new Error('O envio anterior precisa ser revisado antes de continuar.');
    return saved;
  }
  function withLock(actor, callback) {
    if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') throw new Error('Este navegador não permite proteger o envio. Use uma versão atual e uma conexão HTTPS.');
    return navigator.locks.request(key(actor), { mode: 'exclusive' }, callback);
  }
  async function fingerprint(paymentId, payload) {
    if (typeof crypto === 'undefined' || !crypto.subtle || typeof crypto.randomUUID !== 'function') throw new Error('Use uma conexão HTTPS para registrar o ajuste.');
    const normalized = ['payment-adjustment-v1', paymentId, payload.expectedActorId, payload.kind, cents(payload.amount), payload.reason,
      payload.effectiveDate, payload.membershipEffect, payload.expectedMembershipRevision ?? null, payload.newPlanEndDate ?? null];
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(normalized)));
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  }
  async function clear(actor, id) {
    await withLock(actor, () => {
      if (read(actor)?.id === id) sessionStorage.removeItem(key(actor));
      if (snapshots.get(actor)?.idempotencyKey === id) snapshots.delete(actor);
      if (rejected.get(actor) === id) rejected.delete(actor);
    });
  }
  function historyHtml(p) {
    const events = p.adjustments || [], original = cents(p.amount), remaining = balance(p);
    return `<section class="payment-adjustments" aria-label="Histórico de ajustes">
      <div class="payment-adjustments-heading"><h3>Ajustes do recebimento</h3><p>O recibo original é preservado. Este registro interno não executa estorno ou devolução de Pix/cartão.</p></div>
      <dl class="payment-adjustments-totals"><div><dt>Recebimento original</dt><dd>${escape(money(original))}</dd></div><div><dt>Ajustes registrados</dt><dd>${escape(money(original - remaining))}</dd></div><div><dt>Saldo do registro</dt><dd>${escape(money(remaining))}</dd></div></dl>
      ${events.length ? `<ol class="payment-adjustments-history">${events.map(event => `<li class="payment-adjustments-event">
        <div class="payment-adjustments-event-heading"><strong>${event.kind === 'correction' ? 'Correção de lançamento' : 'Devolução registrada'}</strong><span>${escape(money(cents(event.amount)))}</span></div>
        <p>${escape(displayDate(event.effectiveDate))} · ${escape(event.actorName || 'Responsável não informado')}</p>
        <p class="payment-adjustments-reason">${escape(event.reason)}</p>
        <p>${event.membershipEffect === 'set_end_date' ? `Vencimento alterado de ${escape(displayDate(event.membershipBefore?.planEndDate))} para ${escape(displayDate(event.membershipAfter?.planEndDate))}.` : 'Vigência preservada.'}</p>
      </li>`).join('')}</ol>` : '<p class="payment-adjustments-empty">Nenhum ajuste registrado para este recebimento.</p>'}
    </section>`;
  }
  function canAdjust(p) {
    try { return p?.status === 'paid' && Number.isSafeInteger(p.id) && balance(p) > 0; } catch { return false; }
  }
  function hasPending() {
    let captured;
    try { captured = identity(); } catch { return false; }
    try { return !!read(captured.actor); } catch { return true; }
  }
  async function open(payment, view) {
    const context = view.contextoModal();
    let captured, pending;
    try { captured = identity(); pending = read(captured.actor); } catch (error) { Toast.error(error.message); return; }
    const current = () => sameIdentity(captured) && view.modalAtual(context);
    if (!current()) return;
    let p;
    try {
      const response = await API.get(`/pagamentos/${payment.id}`, { timeoutMs: 15000 });
      if (!current()) return;
      p = response?.data;
      if (!p || p.id !== payment.id || p.status !== 'paid') throw new Error('Este recebimento não permite ajuste. Atualize a lista.');
      if (!canAdjust(p) && !pending) throw new Error('O valor deste recebimento já foi ajustado integralmente.');
    } catch (error) { if (current()) Toast.error(error.message); return; }
    const remaining = Math.max(0, balance(p)), date = today(), start = civil(p.student?.planStartDate), end = civil(p.student?.planEndDate);
    const membershipAvailable = activeStudent(p) && Number.isSafeInteger(p.student?.membershipRevision);
    Modal.open('Registrar ajuste do recebimento', `<form id="payment-adjustment-form" class="payment-adjustment-form">
      <p class="payment-adjustment-notice">Este registro interno não executa estorno no provedor. Registre uma devolução somente depois de realizá-la por outro meio. O recibo original permanecerá no histórico.</p>
      <dl class="payment-adjustments-totals"><div><dt>Recebimento original</dt><dd>${escape(money(cents(p.amount)))}</dd></div><div><dt>Disponível para ajuste</dt><dd>${escape(money(remaining))}</dd></div></dl>
      <p id="adjustment-pending-notice" role="status" ${pending ? '' : 'hidden'}>Há um envio sem confirmação. Verifique o envio anterior ou preencha exatamente os mesmos dados para tentar novamente. Os campos pessoais não são gravados no navegador.</p>
      <div class="form-group"><label for="adjustment-kind">Tipo de registro</label><select class="form-input" id="adjustment-kind" required>${p.checkout ? '' : '<option value="correction">Correção de lançamento manual</option>'}<option value="refund_recorded">Devolução já realizada</option></select></div>
      <div class="payment-adjustment-fields"><div class="form-group"><label for="adjustment-amount">Valor do ajuste (R$)</label><input class="form-input" id="adjustment-amount" type="text" inputmode="decimal" autocomplete="off" required aria-describedby="adjustment-amount-help"><small id="adjustment-amount-help">Até ${escape(money(remaining))}. Aceita ajuste parcial.</small></div>
      <div class="form-group"><label for="adjustment-date">Data efetiva</label><input class="form-input" id="adjustment-date" type="date" required min="${escape(civil(p.paymentDate) || '')}" max="${escape(date)}" value="${escape(date)}"></div></div>
      <div class="form-group"><label for="adjustment-reason">Motivo e referência da operação</label><textarea class="form-input" id="adjustment-reason" rows="3" required minlength="10" maxlength="1000" aria-describedby="adjustment-reason-help"></textarea><small id="adjustment-reason-help">Descreva o ocorrido em pelo menos 10 caracteres. Não informe dados de cartão ou credenciais.</small></div>
      <div class="form-group"><label for="adjustment-membership">Vigência do aluno</label><select class="form-input" id="adjustment-membership"><option value="preserve">Preservar o vencimento atual</option><option value="set_end_date" ${membershipAvailable ? '' : 'disabled'}>Definir outro vencimento explicitamente</option></select><small>Vencimento atual: ${escape(displayDate(end))}. Nenhum dia é descontado automaticamente.${membershipAvailable ? '' : ' A vigência não pode ser alterada enquanto o cadastro estiver inativo ou indisponível.'}</small></div>
      <div id="adjustment-end-date-group" class="form-group" hidden><label for="adjustment-end-date">Novo vencimento</label><input class="form-input" id="adjustment-end-date" type="date" ${start ? `min="${escape(start)}"` : ''} value="${escape(end || '')}"><small>A alteração será rejeitada se outra operação modificar a vigência durante este envio.</small></div>
      <p id="adjustment-feedback" class="payment-adjustment-feedback" role="status" aria-live="polite"></p>
    </form>`, [
      { text: 'Cancelar', class: 'btn-secondary', action: () => { if (current()) Modal.close(); } },
      { text: 'Verificar envio anterior', class: 'btn-secondary', action: () => verify() },
      { text: 'Registrar ajuste', class: 'btn-primary', action: () => submit() },
    ]);
    view.vincularModal(context);
    const form = document.getElementById('payment-adjustment-form');
    const field = name => document.getElementById(`adjustment-${name}`);
    const live = () => current() && document.getElementById('payment-adjustment-form') === form && form?.isConnected !== false;
    let busy = false;
    const remembered = snapshots.get(captured.actor);
    if (pending && remembered?.idempotencyKey === pending.id && remembered.paymentId === p.id) {
      for (const [name, prop] of Object.entries({ kind: 'kind', amount: 'amount', reason: 'reason', date: 'effectiveDate', membership: 'membershipEffect', 'end-date': 'newPlanEndDate' })) field(name).value = remembered[prop] ?? '';
    }
    const toggleDate = () => { if (!live()) return; field('end-date-group').hidden = field('membership').value !== 'set_end_date'; field('end-date').required = !field('end-date-group').hidden; };
    field('membership').addEventListener('change', toggleDate); toggleDate();
    form.addEventListener('submit', event => { event.preventDefault(); return submit(); });
    function feedback(message, error = false) { if (live()) { field('feedback').textContent = message; if (error) Toast.error(message); } }
    async function confirmed(event, saved, ownedLookup = false) {
      if (event?.id !== saved.id || !Number.isSafeInteger(event.paymentId) || event.paymentId < 1
        || event.actorId !== captured.actor || event.providerRefundPerformed !== false
        || (!ownedLookup && event.paymentId !== p.id))
        throw new Error('Resposta de confirmação inválida. Verifique o envio novamente.');
      if (!live()) return;
      await clear(captured.actor, saved.id);
      if (!live()) return;
      Toast.success(event.paymentId !== undefined && event.paymentId !== p.id ? 'O envio anterior foi confirmado em outro recebimento. Consulte seu histórico antes de iniciar outro ajuste.' : 'Ajuste registrado no histórico.');
      Modal.close(); view.carregarLista();
    }
    async function lookup(saved) {
      try {
        const response = await API.get(`/pagamentos/ajustes/solicitacoes/${saved.id}`, { timeoutMs: 15000 });
        if (!live()) return true;
        await confirmed(response?.data, saved, true); return true;
      } catch (error) { if (error.status === 404) return false; throw error; }
    }
    async function verify() {
      if (!live() || busy) return;
      busy = true;
      try {
        const saved = read(captured.actor);
        if (!saved) { feedback('Não há envio anterior pendente.'); return; }
        if (!await lookup(saved)) feedback('O envio ainda não foi localizado. Preencha os mesmos dados e tente novamente; a chave será preservada.');
      } catch (error) { feedback(error.message, true); } finally { busy = false; }
    }
    async function submit() {
      if (!live() || busy) return;
      busy = true;
      let saved, sent = false;
      try {
        saved = read(captured.actor);
        // Reconciliar primeiro: o commit pode ter acontecido apesar de um erro de rede.
        if (saved && await lookup(saved)) return;
        if (!live()) return;
        const amountText = String(field('amount').value || '').trim().replace(',', '.'), amountCents = cents(amountText);
        if (amountCents <= 0 || amountCents > remaining) throw new Error('O ajuste deve ser positivo e não pode ultrapassar o saldo deste registro.');
        const kind = field('kind').value, reason = String(field('reason').value || '').trim(), effectiveDate = inputDate(field('date').value);
        if (!['correction', 'refund_recorded'].includes(kind) || (p.checkout && kind === 'correction')) throw new Error('Selecione um tipo de ajuste permitido.');
        if (reason.length < 10 || reason.length > 1000) throw new Error('Descreva o motivo em 10 a 1000 caracteres.');
        if (!effectiveDate || effectiveDate > date || effectiveDate < civil(p.paymentDate)) throw new Error('Informe uma data válida entre o recebimento e hoje.');
        const membershipEffect = field('membership').value;
        if (!['preserve', 'set_end_date'].includes(membershipEffect)) throw new Error('Selecione como tratar a vigência.');
        const payload = { expectedActorId: captured.actor, kind, amount: `${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, '0')}`, reason, effectiveDate, membershipEffect };
        if (membershipEffect === 'set_end_date') {
          if (!membershipAvailable) throw new Error('Este cadastro não permite alterar a vigência.');
          const newEnd = inputDate(field('end-date').value);
          if (!newEnd || (start && newEnd < start)) throw new Error('O novo vencimento deve ser válido e não pode anteceder o início da vigência.');
          payload.newPlanEndDate = newEnd;
          payload.expectedMembershipRevision = saved && remembered?.idempotencyKey === saved.id && remembered.paymentId === p.id && rejected.get(captured.actor) !== saved.id
            ? remembered.expectedMembershipRevision ?? p.student.membershipRevision : p.student.membershipRevision;
        }
        const reserved = await withLock(captured.actor, async () => {
          if (!live()) return null;
          const hash = await fingerprint(p.id, payload);
          if (!live()) return null;
          const stored = read(captured.actor);
          if (saved && stored?.id !== saved.id) throw new Error('O envio anterior mudou. Abra novamente o recebimento para continuar.');
          if (stored && stored.fingerprint !== hash && rejected.get(captured.actor) !== stored.id)
            throw new Error('Os dados diferem do envio sem confirmação. Verifique o envio anterior ou preencha exatamente os mesmos dados.');
          const next = { id: stored?.id || crypto.randomUUID(), fingerprint: hash };
          sessionStorage.setItem(key(captured.actor), JSON.stringify(next));
          rejected.delete(captured.actor); return next;
        });
        if (!reserved || !live()) return;
        saved = reserved; payload.idempotencyKey = saved.id;
        snapshots.set(captured.actor, Object.freeze({ ...payload, paymentId: p.id }));
        field('pending-notice').hidden = false;
        feedback('Registrando ajuste… Aguarde a confirmação antes de iniciar outro.');
        sent = true;
        const response = await API.post(`/pagamentos/${p.id}/ajustes`, payload, { timeoutMs: 15000 });
        if (!live()) return;
        await confirmed(response?.data, saved);
      } catch (error) {
        if (!live()) return;
        // Rejeição HTTP explícita permite correção em memória, com a mesma UUID.
        // Recarga sem essa evidência conserva o hash e exige reconciliação.
        if (sent && saved && [400, 409].includes(error.status) && read(captured.actor)?.id === saved.id) rejected.set(captured.actor, saved.id);
        feedback(error.message || 'Envio sem confirmação. Verifique o histórico antes de iniciar outro ajuste.', true);
      } finally { busy = false; }
    }
  }
  if (typeof root.addEventListener === 'function') root.addEventListener('auth:logout', event => {
    snapshots.delete(event.detail?.userId); rejected.delete(event.detail?.userId);
  });
  const api = Object.freeze({ historyHtml, canAdjust, hasPending, open });
  root.PaymentAdjustments = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
