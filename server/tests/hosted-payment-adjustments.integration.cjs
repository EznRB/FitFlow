'use strict';
// Owner prepara/remove somente fixtures UUID; todos os ajustes passam pelo HTTPS.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { assertHostedTarget } = require('./hosted-management.integration.cjs');
const { brazilDate } = require('../src/utils/paymentValidation');
const canonical = 'https://fit-flow-indol.vercel.app';

async function runHostedPaymentAdjustments() {
  assert.equal(process.argv[2], '--execute-hosted-fixtures', 'Execução explícita de fixtures HTTPS obrigatória.');
  const vars = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../.env.remote.local')));
  assertHostedTarget(vars, canonical);
  // Credencial owner explícita; jamais utiliza URL de banco herdada do ambiente.
  const { PrismaClient } = require('../generated/postgresql');
  const owner = new PrismaClient({ datasources: { db: { url: vars.DIRECT_URL } }, log: [] });
  const suffix = randomUUID(), prefix = `Hosted adjustment ${suffix}`, planName = `${prefix} plan`;
  const names = { admin: `${prefix} admin`, student: `${prefix} student` };
  const emails = ['admin', 'student'].map(role => `${role}.${suffix}@example.invalid`);
  const password = randomBytes(24).toString('base64url');
  const known = { users: [], student: null, plan: null, receipts: [], receiptRequests: [], adjustmentRequests: [] };
  const notes = [1, 2, 3].map(index => `${prefix} receipt ${index}`);
  const reasons = [1, 2, 3].map(index => `${prefix} adjustment ${index}`);
  let stage = 'target', loginCount = 0, confirmed = false, primaryError;
  const request = async (endpoint, { method = 'GET', cookie, body, expected = 200 } = {}) => {
    assert.ok(endpoint.startsWith('/api/'));
    const response = await fetch(new URL(endpoint, canonical), { method, redirect: 'manual', signal: AbortSignal.timeout(25000),
      headers: { Origin: canonical, ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(response.status, expected, `${stage}: HTTP ${expected} esperado.`);
    const result = await response.json(); return { response, data: result.data, result };
  };
  const key = () => { const value = randomUUID(); known.adjustmentRequests.push(value); return value; };
  try {
    const [identity] = await owner.$queryRaw`SELECT current_database() AS database, current_user AS role`;
    assert.equal(identity.database, 'fitflow'); assert.equal(identity.role, 'fitflow_owner');
    assert.equal(await owner.user.count({ where: { email: { in: emails } } }), 0);
    assert.equal(await owner.plan.count({ where: { name: planName } }), 0);
    confirmed = true;
    stage = 'health'; assert.equal((await request('/api/health')).result.database, 'ready');
    const passwordHash = await require('bcryptjs').hash(password, 10), accounts = {};
    for (const [role, index] of [['admin', 0], ['student', 1]]) {
      accounts[role] = await owner.user.create({ data: { name: names[role], email: emails[index], passwordHash, role } });
      known.users.push(accounts[role].id);
    }
    const plan = await owner.plan.create({ data: { name: planName, price: '100.00', durationDays: 30, description: prefix } });
    known.plan = plan.id;
    const today = brazilDate(), civil = date => date.toISOString().slice(0, 10);
    const student = await owner.student.create({ data: { userId: accounts.student.id, planId: plan.id,
      planStartDate: today, planEndDate: today } }); known.student = student.id;
    const login = async account => {
      if (++loginCount > 2) throw new Error('Gate limitado a dois logins, sem reset de quota.');
      const { response, data, result } = await request('/api/auth/login', { method: 'POST', body: { email: account.email, password } });
      assert.equal(data.user.id, account.id);
      const raw = response.headers.get('set-cookie'); assert.match(raw || '', /; Secure/i); assert.match(raw || '', /; HttpOnly/i);
      assert.doesNotMatch(JSON.stringify(result), /"(?:token|passwordHash|password)"/);
      return raw.split(';')[0];
    };
    stage = 'two profile logins';
    const adminCookie = await login(accounts.admin), studentCookie = await login(accounts.student);
    const receiptBody = index => {
      const requestId = randomUUID(); known.receiptRequests.push(requestId);
      return { studentId: student.id, planId: plan.id, amount: '100.00', paymentMethod: 'pix', paymentDate: civil(today),
        notes: notes[index], idempotencyKey: requestId, expectedActorId: accounts.admin.id };
    };
    const adjustmentBody = (amount, index, extra = {}) => ({ idempotencyKey: key(), expectedActorId: accounts.admin.id,
      kind: 'correction', amount, reason: reasons[index], effectiveDate: civil(today), membershipEffect: 'preserve', ...extra });
    const postAdjustment = (paymentId, body, expected = 201, cookie = adminCookie) => request(`/api/pagamentos/${paymentId}/ajustes`, {
      method: 'POST', cookie, body, expected });
    stage = 'first receipt';
    const receipt = (await request('/api/pagamentos', { method: 'POST', cookie: adminCookie, body: receiptBody(0), expected: 201 })).data;
    known.receipts.push(receipt.id);
    const original = await owner.payment.findUnique({ where: { id: receipt.id } });
    assert.equal(original.membershipGrant.durationDays, 30); assert.equal(original.membershipGrant.applied, true);
    const before = await owner.student.findUnique({ where: { id: student.id } });
    stage = 'partial adjustment preserves access and original receipt';
    const partialBody = adjustmentBody('25.01', 0);
    const partial = (await postAdjustment(receipt.id, partialBody)).data;
    assert.equal(partial.amount, 25.01); assert.equal(partial.providerRefundPerformed, false); assert.equal(partial.requestHash, undefined);
    assert.equal(partial.actorId, accounts.admin.id); assert.equal(partial.actorName, names.admin);
    assert.deepEqual(partial.membershipBefore, partial.membershipAfter);
    assert.equal(partial.membershipBefore.membershipRevision, before.membershipRevision);
    assert.deepEqual(await owner.student.findUnique({ where: { id: student.id } }), before);
    assert.deepEqual(await owner.payment.findUnique({ where: { id: receipt.id } }), original);
    stage = 'replay and UUID lookup';
    assert.equal((await postAdjustment(receipt.id, partialBody)).data.id, partial.id);
    assert.equal(await owner.paymentAdjustment.count({ where: { paymentId: receipt.id } }), 1);
    assert.equal((await request(`/api/pagamentos/ajustes/solicitacoes/${partial.id}`, { cookie: adminCookie })).data.id, partial.id);
    await request(`/api/pagamentos/ajustes/solicitacoes/${key()}`, { cookie: adminCookie, expected: 404 });
    stage = 'forgery, authorization and immutability';
    await postAdjustment(receipt.id, { ...adjustmentBody('1.00', 0), providerRefundPerformed: true }, 400);
    await postAdjustment(receipt.id, { ...adjustmentBody('1.00', 0), membershipBefore: { forged: true } }, 400);
    await postAdjustment(receipt.id, adjustmentBody('1.00', 0), 403, studentCookie);
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      await request(`/api/pagamentos/${receipt.id}`, { method, cookie: adminCookie, body: { amount: '1.00' }, expected: 405 });
      await request(`/api/pagamentos/ajustes/${partial.id}`, { method, cookie: adminCookie, body: {}, expected: 405 });
    }
    const tomorrow = new Date(today.getTime() + 86400000);
    await postAdjustment(receipt.id, adjustmentBody('1.00', 0, { effectiveDate: civil(tomorrow) }), 400);
    stage = 'remaining integral, overbalance and public balances';
    const integral = (await postAdjustment(receipt.id, adjustmentBody('74.99', 1, { kind: 'refund_recorded' }))).data;
    assert.equal(integral.providerRefundPerformed, false); assert.equal(integral.amount, 74.99);
    await postAdjustment(receipt.id, adjustmentBody('0.01', 1), 409);
    const detail = (await request(`/api/pagamentos/${receipt.id}`, { cookie: adminCookie })).data;
    assert.equal(Number(detail.amount), 100); assert.equal(detail.status, 'paid');
    assert.equal(detail.adjustments.length, 2); assert.equal(detail.adjustmentSummary.adjustedAmount, 100);
    assert.equal(detail.adjustmentSummary.remainingAmount, 0);
    assert.equal(detail.adjustmentSummary.correctionAmount, 25.01); assert.equal(detail.adjustmentSummary.refundRecordedAmount, 74.99);
    assert.ok(detail.adjustments.every(event => event.requestHash === undefined && event.providerRefundPerformed === false));
    assert.deepEqual(await owner.payment.findUnique({ where: { id: receipt.id } }), original);

    stage = 'second receipt and renewal races stale membership revision';
    const secondReceipt = (await request('/api/pagamentos', { method: 'POST', cookie: adminCookie, body: receiptBody(1), expected: 201 })).data;
    known.receipts.push(secondReceipt.id);
    const staleRevision = (await request(`/api/alunos/${student.id}`, { cookie: adminCookie })).data.membershipRevision;
    const stale = adjustmentBody('1.00', 2, { membershipEffect: 'set_end_date', expectedMembershipRevision: staleRevision,
      newPlanEndDate: secondReceipt.dueDate.slice(0, 10) });
    const parallel = await Promise.allSettled([
      request('/api/pagamentos', { method: 'POST', cookie: adminCookie, body: receiptBody(2), expected: 201 }),
      postAdjustment(secondReceipt.id, adjustmentBody('0.01', 2)),
    ]);
    const failed = parallel.find(result => result.status === 'rejected'); if (failed) throw failed.reason;
    const renewal = parallel[0].value.data; known.receipts.push(renewal.id);
    const current = (await request(`/api/alunos/${student.id}`, { cookie: adminCookie })).data;
    assert.equal(current.membershipRevision, staleRevision + 1);
    await postAdjustment(secondReceipt.id, stale, 409);
    stage = 'explicit current revision changes only end date';
    const shortened = new Date(new Date(current.planEndDate).getTime() - 86400000);
    assert.ok(shortened >= new Date(current.planStartDate));
    const explicitBody = adjustmentBody('1.00', 2, { membershipEffect: 'set_end_date', expectedMembershipRevision: current.membershipRevision,
      newPlanEndDate: civil(shortened) });
    const explicit = (await postAdjustment(secondReceipt.id, explicitBody)).data;
    assert.equal(explicit.membershipAfter.membershipRevision, current.membershipRevision + 1);
    assert.equal(explicit.membershipAfter.planEndDate, civil(shortened));
    assert.equal(explicit.membershipAfter.planStartDate, explicit.membershipBefore.planStartDate);
    assert.equal(explicit.membershipAfter.status, explicit.membershipBefore.status);
    assert.equal(explicit.membershipAfter.planId, explicit.membershipBefore.planId);
    assert.equal((await postAdjustment(secondReceipt.id, explicitBody)).data.id, explicit.id);
    stage = 'student balances and financial report events';
    const monthly = (await request('/api/aluno/mensalidade', { cookie: studentCookie })).data;
    const studentReceipt = monthly.historicoPagamentos.find(row => row.id === receipt.id);
    assert.equal(studentReceipt.resumoAjustes.adjustedAmount, 100); assert.equal(studentReceipt.resumoAjustes.remainingAmount, 0);
    assert.equal(Number(studentReceipt.valor), 100); assert.equal(studentReceipt.status, 'paid');
    const report = (await request(`/api/relatorios/financeiro?startDate=${civil(today)}&endDate=${civil(today)}`, { cookie: adminCookie })).data;
    assert.ok(known.receipts.every(id => report.items.some(row => row.tipo === 'recebimento' && row.paymentId === id && row.valor === 100)));
    assert.ok(report.items.some(row => row.id === partial.id && row.tipo === 'correction' && row.valor === -25.01));
    assert.ok(report.items.some(row => row.id === integral.id && row.tipo === 'refund_recorded' && row.valor === -74.99 && row.providerRefundPerformed === false));
    assert.ok(report.items.some(row => row.id === explicit.id && row.valor === -1));
    assert.ok(Number.isFinite(report.resumo.totalBruto)); assert.ok(Number.isFinite(report.resumo.totalAjustes));
    stage = 'complete';
  } catch (error) { primaryError = error; }
  finally {
    try {
      if (confirmed) await owner.$transaction(async tx => {
        const ownUsers = await tx.user.findMany({ where: { email: { in: emails } } });
        assert.ok(ownUsers.every(user => Object.values(names).includes(user.name) && (!known.users.length || known.users.includes(user.id))));
        const userIds = ownUsers.map(user => user.id), actorIds = ownUsers.filter(user => user.name === names.admin && user.role === 'admin').map(user => user.id);
        const ownStudents = await tx.student.findMany({ where: { userId: { in: userIds } } });
        assert.ok(ownStudents.length <= 1 && ownStudents.every(row => row.id === known.student));
        const studentIds = ownStudents.map(row => row.id);
        const ownReceipts = await tx.payment.findMany({ where: { studentId: { in: studentIds }, registeredBy: { in: actorIds },
          manualRequestId: { in: known.receiptRequests }, notes: { in: notes } } });
        assert.equal(await tx.payment.count({ where: { studentId: { in: studentIds } } }), ownReceipts.length);
        const paymentIds = ownReceipts.map(row => row.id);
        const ownEvents = await tx.paymentAdjustment.findMany({ where: { paymentId: { in: paymentIds }, actorId: { in: actorIds },
          id: { in: known.adjustmentRequests }, reason: { in: reasons } } });
        assert.equal(await tx.paymentAdjustment.count({ where: { paymentId: { in: paymentIds } } }), ownEvents.length);
        assert.equal(await tx.paymentIntent.count({ where: { studentId: { in: studentIds } } }), 0);
        assert.equal(await tx.workout.count({ where: { studentId: { in: studentIds } } }), 0);
        assert.equal(await tx.checkin.count({ where: { studentId: { in: studentIds } } }), 0);
        assert.equal(await tx.nutritionScenario.count({ where: { userId: { in: userIds } } }), 0);
        const ownPlans = await tx.plan.findMany({ where: { name: planName } });
        assert.ok(ownPlans.length <= 1 && ownPlans.every(row => row.id === known.plan));
        await tx.paymentAdjustment.deleteMany({ where: { id: { in: ownEvents.map(row => row.id) }, paymentId: { in: paymentIds }, actorId: { in: actorIds } } });
        await tx.payment.deleteMany({ where: { id: { in: paymentIds }, studentId: { in: studentIds } } });
        await tx.student.deleteMany({ where: { id: { in: studentIds }, userId: { in: userIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds }, email: { in: emails }, name: { in: Object.values(names) } } });
        await tx.plan.deleteMany({ where: { id: { in: ownPlans.map(row => row.id) }, name: planName } });
      }, { timeout: 25000 });
      if (confirmed) console.log('Hosted adjustments: fixtures UUID próprias removidas; quotas preservadas.');
    } catch (error) {
      console.error('Hosted adjustments cleanup falhou; fixtures sintéticas preservadas para revisão:', error.code || error.name);
      if (!primaryError) primaryError = error;
    } finally { await owner.$disconnect(); }
  }
  if (primaryError) {
    console.error('Hosted adjustments FAIL:', stage, primaryError.code || primaryError.name, `logins=${loginCount}`);
    process.exitCode = 1;
  } else console.log('Hosted adjustments HTTPS PASS: saldo parcial/integral, replay/UUID, forjados/auth, recibos imutáveis, CAS após renovação, vigência explícita, mensalidade e eventos financeiros; dois logins, nenhuma chamada ao PSP.');
}

if (require.main === module) runHostedPaymentAdjustments().catch(error => {
  console.error('Hosted adjustments recusado antes da execução:', error.code || error.name); process.exitCode = 1;
});
module.exports = { runHostedPaymentAdjustments };
