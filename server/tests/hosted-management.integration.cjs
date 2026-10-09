'use strict';

// Gate com dados sintéticos exclusivos no FitFlow publicado. O owner só prepara
// credenciais temporárias e remove os IDs desta execução; os fluxos usam HTTPS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
const canonical = 'https://fit-flow-indol.vercel.app';
const directHost = 'ep-jolly-grass-b6jl6hjo.c-2.sa-east-1.aws.neon.tech';

function assertHostedTarget(vars, target, nodeEnv = process.env.NODE_ENV) {
  const refuse = () => { throw new Error('Gate restrito ao FitFlow HTTPS e ao novo Neon confirmado.'); };
  if (nodeEnv === 'production' || target !== canonical || vars.DATABASE_PROVIDER !== 'postgresql'
    || vars.NEON_PROJECT_ID !== 'mute-night-99440749' || vars.NEON_BRANCH_ID !== 'br-tiny-king-b6carztp') refuse();
  let direct; let pooled;
  try { direct = new URL(vars.DIRECT_URL); pooled = new URL(vars.DATABASE_URL); } catch { refuse(); }
  for (const [url, hostname] of [[direct, directHost], [pooled, directHost.replace('.c-2.', '-pooler.c-2.')]]) {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== hostname || url.pathname !== '/fitflow'
      || url.username !== 'fitflow_owner' || !url.password || (url.port && url.port !== '5432')
      || url.searchParams.get('sslmode') !== 'require' || url.searchParams.get('sslaccept') !== 'strict') refuse();
  }
}

async function runHostedManagement() {
  assert.equal(process.argv[2], '--execute-hosted-fixtures', 'Execução explícita de fixtures HTTPS obrigatória.');
  const vars = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env.remote.local')));
  assertHostedTarget(vars, canonical);
  // Constructor explícito: nunca usa DATABASE_URL/DIRECT_URL herdadas do sistema.
  const { PrismaClient } = require('../generated/postgresql');
  const owner = new PrismaClient({ datasources: { db: { url: vars.DIRECT_URL } }, log: [] });
  const suffix = randomUUID();
  const prefix = `Hosted management ${suffix}`;
  const password = randomBytes(24).toString('base64url');
  const emails = ['admin', 'instructor', 'student', 'second'].map(role => `${role}.${suffix}@example.invalid`);
  const names = { admin: `${prefix} admin`, instructor: `${prefix} instructor`, student: `${prefix} student`, second: `${prefix} second` };
  const planName = `${prefix} plan`;
  const notes = [`${prefix} renewal 1`, `${prefix} renewal 2`];
  const known = { users: [], students: [], plans: [], payments: [], checkins: [] };
  let stage = 'target';
  let loginCount = 0;
  let fixtureScopeConfirmed = false;
  let primaryError;
  const request = async (endpoint, { method = 'GET', cookie, body, expected = 200 } = {}) => {
    if (!endpoint.startsWith('/api/')) throw new Error('Endpoint de teste inválido.');
    const response = await fetch(new URL(endpoint, canonical), {
      method, headers: { Origin: canonical, ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      redirect: 'manual', signal: AbortSignal.timeout(25000),
    });
    assert.equal(response.status, expected, `${stage}: HTTP ${expected} esperado.`);
    const result = await response.json();
    return { response, result, data: result.data };
  };

  try {
    const [identity] = await owner.$queryRaw`SELECT current_database() AS database, current_user AS role`;
    assert.equal(identity.database, 'fitflow'); assert.equal(identity.role, 'fitflow_owner');
    assert.equal(await owner.user.count({ where: { email: { in: emails } } }), 0);
    assert.equal(await owner.plan.count({ where: { name: planName } }), 0);
    fixtureScopeConfirmed = true;
    stage = 'health';
    assert.equal((await request('/api/health')).result.database, 'ready');
    const passwordHash = await require('bcryptjs').hash(password, 10);
    const accounts = {};
    for (const [role, index] of [['admin', 0], ['instructor', 1]]) {
      stage = 'temporary account';
      accounts[role] = await owner.user.create({ data: { name: names[role], email: emails[index], passwordHash, role } });
      known.users.push(accounts[role].id);
    }
    const login = async account => {
      if (++loginCount > 3) throw new Error('Gate limitado a três logins, sem reset de quota.');
      const { response, data, result } = await request('/api/auth/login', { method: 'POST', body: { email: account.email, password } });
      const raw = response.headers.get('set-cookie');
      assert.match(raw || '', /; Secure/i); assert.match(raw || '', /; HttpOnly/i);
      assert.equal(data.user.id, account.id);
      assert.doesNotMatch(JSON.stringify(result), /"(?:token|passwordHash|password)"/);
      return raw.split(';')[0];
    };
    stage = 'admin login';
    const adminCookie = await login(accounts.admin);
    stage = 'plan create';
    const plan = (await request('/api/planos', { method: 'POST', cookie: adminCookie,
      body: { name: planName, price: '73.29', durationDays: 7, description: prefix }, expected: 201 })).data;
    known.plans.push(plan.id);
    stage = 'plan read/update';
    assert.equal((await request(`/api/planos/${plan.id}`, { cookie: adminCookie })).data.name, planName);
    const updated = (await request(`/api/planos/${plan.id}`, { method: 'PUT', cookie: adminCookie,
      body: { name: planName, price: '74.39', durationDays: 7, description: `${prefix} updated` } })).data;
    assert.equal(Number(updated.price), 74.39); assert.equal(updated.durationDays, 7);

    for (const [role, index] of [['student', 2], ['second', 3]]) {
      stage = 'student enrollment';
      const created = (await request('/api/alunos', { method: 'POST', cookie: adminCookie,
        body: { name: names[role], email: emails[index], password, planId: plan.id }, expected: 201 })).data;
      assert.equal(created.role, 'student'); assert.ok(!created.passwordHash);
      accounts[role] = created;
      known.users.push(created.id); known.students.push(created.student.id);
      const read = (await request(`/api/alunos/${created.student.id}`, { cookie: adminCookie })).data;
      assert.equal(read.user.email, emails[index]); assert.equal(read.planId, plan.id);
    }
    const studentId = accounts.student.student.id;
    const secondId = accounts.second.student.id;
    const initialEnd = (await owner.student.findUnique({ where: { id: studentId } })).planEndDate;
    stage = 'remaining profile logins';
    const instructorCookie = await login(accounts.instructor);
    const studentCookie = await login(accounts.student);
    stage = 'financial permissions';
    for (const cookie of [instructorCookie, studentCookie]) {
      await request('/api/pagamentos', { cookie, expected: 403 });
      await request('/api/relatorios/financeiro', { cookie, expected: 403 });
      await request(`/api/alunos/${studentId}`, { cookie, expected: 403 });
    }

    stage = 'nutrition JSONB consent and ownership';
    const nutrition = { formula: 'mifflin', sex: 'male', age: 30, weightKg: '80', heightCm: 180,
      activityFactor: 1.5, adjustmentPercent: 0, proteinPerKg: 1.6, fatPercent: 25, eligible: true };
    await request('/api/nutricao/scenario', { method: 'PUT', cookie: studentCookie, body: { inputs: nutrition }, expected: 400 });
    const saved = (await request('/api/nutricao/scenario', { method: 'PUT', cookie: studentCookie,
      body: { consent: true, inputs: nutrition } })).data;
    assert.equal(saved.scenario.inputs.weightKg, 80);
    assert.equal(saved.scenario.inputs.eligible, undefined);
    assert.equal(saved.requiresScopeConfirmation, true);
    const restored = (await request(`/api/nutricao/scenario?userId=${accounts.admin.id}`, { cookie: studentCookie })).data;
    assert.deepEqual(restored.scenario.inputs, saved.scenario.inputs);
    assert.equal(restored.requiresScopeConfirmation, true);
    assert.equal((await request('/api/nutricao/scenario', { cookie: adminCookie })).data.scenario, null);
    const result = require('../../client/js/science').calculateNutrition({ ...restored.scenario.inputs, eligible: true });
    assert.equal(result.restingKcal, 1780); assert.equal(result.targetKcal, 2670);
    assert.equal(result.proteinG, 128); assert.equal(Number(result.fatG.toFixed(1)), 74.2); assert.equal(Number(result.carbsG.toFixed(1)), 372.6);
    assert.equal((await request('/api/nutricao/scenario', { method: 'DELETE', cookie: studentCookie })).data.deleted, true);
    assert.equal((await request('/api/nutricao/scenario', { cookie: studentCookie })).data.scenario, null);

    stage = 'self checkin';
    const checkin = (await request('/api/checkins', { method: 'POST', cookie: studentCookie, body: {}, expected: 201 })).data;
    known.checkins.push(checkin.id);
    assert.equal(checkin.studentId, studentId); assert.equal(checkin.registeredBy, accounts.student.id);
    assert.match(checkin.checkinDate, /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    await request('/api/checkins', { method: 'POST', cookie: studentCookie, body: {}, expected: 409 });
    await request('/api/checkins', { method: 'POST', cookie: studentCookie, body: { studentId: secondId }, expected: 403 });
    await request(`/api/checkins/${checkin.id}/cancelar`, { method: 'PUT', cookie: studentCookie, body: { motivo: prefix }, expected: 403 });
    stage = 'admin checkin and cancellation audit';
    const adminCheckin = (await request('/api/checkins', { method: 'POST', cookie: adminCookie, body: { studentId: secondId }, expected: 201 })).data;
    known.checkins.push(adminCheckin.id);
    assert.equal(adminCheckin.registeredBy, accounts.admin.id);
    const cancelled = (await request(`/api/checkins/${checkin.id}/cancelar`, { method: 'PUT', cookie: adminCookie, body: { motivo: prefix } })).data;
    assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.cancelledBy, accounts.admin.id);
    assert.equal(cancelled.cancelReason, prefix); assert.ok(cancelled.cancelledAt);
    await request('/api/checkins', { method: 'POST', cookie: studentCookie, body: {}, expected: 409 });
    const history = (await request(`/api/checkins?studentId=${studentId}&incluirCancelados=true`, { cookie: adminCookie })).data;
    assert.equal(history.length, 1); assert.equal(history[0].id, checkin.id); assert.equal(history[0].status, 'cancelled');
    assert.equal((await request(`/api/checkins?studentId=${studentId}&incluirCancelados=false`, { cookie: adminCookie })).data.length, 0);

    stage = 'two concurrent manual renewals';
    // Datas sintéticas futuras evitam somar pagamentos reais ao relatório de hoje.
    const paidDate = '2099-06-15';
    const paymentBodies = notes.map(note => ({ studentId, planId: plan.id, amount: '74.39', paymentMethod: 'pix', paymentDate: paidDate,
      notes: note, idempotencyKey: randomUUID(), expectedActorId: accounts.admin.id }));
    const pendingPayments = await Promise.allSettled(paymentBodies.map(body => request('/api/pagamentos', { method: 'POST', cookie: adminCookie, body, expected: 201 })));
    // Espera ambos os pedidos antes de limpar fixtures, inclusive se um falhar.
    const failure = pendingPayments.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    const payments = pendingPayments.map(result => result.value);
    for (const { data } of payments) {
      known.payments.push(data.id);
      assert.equal(data.studentId, studentId); assert.equal(data.planId, plan.id);
      assert.equal(Number(data.amount), 74.39); assert.equal(data.status, 'paid'); assert.equal(data.paymentMethod, 'pix');
      assert.equal(data.registeredBy, accounts.admin.id); assert.equal(data.paymentDate, `${paidDate}T00:00:00.000Z`);
    }
    const base = new Date(Math.max(initialEnd.getTime(), new Date(`${paidDate}T00:00:00.000Z`).getTime()));
    const firstEnd = new Date(base); firstEnd.setUTCDate(firstEnd.getUTCDate() + 7);
    const finalEnd = new Date(base); finalEnd.setUTCDate(finalEnd.getUTCDate() + 14);
    assert.deepEqual(payments.map(({ data }) => data.dueDate).sort(), [firstEnd.toISOString(), finalEnd.toISOString()].sort());
    const renewed = (await request(`/api/alunos/${studentId}`, { cookie: adminCookie })).data;
    assert.equal(renewed.planEndDate, finalEnd.toISOString());
    assert.equal(renewed.planStartDate, firstEnd.toISOString());
    stage = 'manual receipt replay and conflict';
    const replayResults = await Promise.allSettled([0, 1].map(() => request('/api/pagamentos', {
      method: 'POST', cookie: adminCookie, body: paymentBodies[0], expected: 201 })));
    const replayFailure = replayResults.find(result => result.status === 'rejected');
    if (replayFailure) throw replayFailure.reason;
    assert.ok(replayResults.every(result => result.value.data.id === payments[0].data.id));
    for (const { data } of payments) {
      assert.equal(data.manualRequestId, undefined); assert.equal(data.manualRequestHash, undefined);
    }
    const lookup = (await request(`/api/pagamentos/solicitacoes/${paymentBodies[0].idempotencyKey}`, { cookie: adminCookie })).data;
    assert.equal(lookup.id, payments[0].data.id); assert.equal(lookup.manualRequestHash, undefined);
    await request('/api/pagamentos', { method: 'POST', cookie: adminCookie,
      body: { ...paymentBodies[0], amount: '75.39' }, expected: 409 });
    await request('/api/pagamentos', { method: 'POST', cookie: adminCookie,
      body: { ...paymentBodies[0], expectedActorId: accounts.instructor.id }, expected: 403 });
    assert.equal(await owner.payment.count({ where: { studentId } }), 2);
    assert.equal((await request(`/api/alunos/${studentId}`, { cookie: adminCookie })).data.planEndDate, finalEnd.toISOString());
    stage = 'financial date filters';
    const filtered = (await request(`/api/pagamentos?studentId=${studentId}&startDate=${paidDate}&endDate=${paidDate}`, { cookie: adminCookie })).data;
    assert.deepEqual(filtered.map(row => row.id).sort((a, b) => a - b), known.payments.slice().sort((a, b) => a - b));
    const report = (await request(`/api/relatorios/financeiro?startDate=${paidDate}&endDate=${paidDate}`, { cookie: adminCookie })).data;
    assert.ok(known.payments.every(id => report.items.some(row => row.id === id && row.valor === 74.39)));
    const outside = (await request('/api/relatorios/financeiro?startDate=2099-06-16&endDate=2099-06-16', { cookie: adminCookie })).data;
    assert.ok(!outside.items.some(row => known.payments.includes(row.id)));
    await request('/api/relatorios/financeiro?startDate=2099-06-16&endDate=2099-06-15', { cookie: adminCookie, expected: 400 });
    stage = 'soft deletion of own fixtures';
    await request(`/api/alunos/${secondId}`, { method: 'DELETE', cookie: adminCookie });
    assert.equal((await request(`/api/alunos/${secondId}`, { cookie: adminCookie })).data.user.active, false);
    await request(`/api/planos/${plan.id}`, { method: 'DELETE', cookie: adminCookie });
    assert.equal((await request(`/api/planos/${plan.id}`, { cookie: adminCookie })).data.active, false);
    stage = 'complete';
  } catch (error) { primaryError = error; }
  finally {
    try {
      // Recupera somente nomes/e-mails UUID desta tentativa caso uma resposta
      // HTTP tenha sido perdida. Nenhuma varredura por data, role ou demo ocorre.
      if (fixtureScopeConfirmed) await owner.$transaction(async tx => {
        const users = await tx.user.findMany({ where: { email: { in: emails } } });
        assert.ok(users.every(user => Object.values(names).includes(user.name)));
        const userIds = users.map(user => user.id);
        const students = await tx.student.findMany({ where: { userId: { in: userIds } } });
        const studentIds = students.map(student => student.id);
        const plans = await tx.plan.findMany({ where: { name: planName } });
        assert.ok(plans.length <= 1);
        const ownPayments = await tx.payment.findMany({ where: { studentId: { in: studentIds }, notes: { in: notes } } });
        assert.equal(await tx.payment.count({ where: { studentId: { in: studentIds } } }), ownPayments.length);
        const ownCheckins = await tx.checkin.findMany({ where: { studentId: { in: studentIds }, registeredBy: { in: userIds } } });
        assert.equal(await tx.checkin.count({ where: { studentId: { in: studentIds } } }), ownCheckins.length);
        assert.equal(await tx.workout.count({ where: { studentId: { in: studentIds } } }), 0);
        await tx.payment.deleteMany({ where: { id: { in: ownPayments.map(row => row.id) } } });
        await tx.checkin.deleteMany({ where: { id: { in: ownCheckins.map(row => row.id) } } });
        await tx.nutritionScenario.deleteMany({ where: { userId: { in: userIds } } });
        await tx.student.deleteMany({ where: { id: { in: studentIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
        await tx.plan.deleteMany({ where: { id: { in: plans.map(row => row.id) } } });
      }, { timeout: 25000 });
      if (fixtureScopeConfirmed) console.log('Hosted management: fixtures UUID removidas; quota real preservada.');
    } catch (cleanupError) {
      console.error('Hosted management cleanup falhou; dados sintéticos preservados para revisão:', cleanupError.code || cleanupError.name);
      if (!primaryError) primaryError = cleanupError;
    } finally { await owner.$disconnect(); }
  }
  if (primaryError) {
    console.error('Hosted management FAIL:', stage, primaryError.code || primaryError.name, `logins=${loginCount}`);
    process.exitCode = 1;
  } else console.log('Hosted management HTTPS PASS: planos/alunos, perfis, nutrição JSONB consentida, checkin/auditoria, duas renovações concorrentes, replay manual idempotente, conflitos e filtros civis financeiros; três logins, 4 users/2 students/1 plan/2 payments/2 checkins sintéticos removidos.');
}

if (require.main === module) runHostedManagement().catch(error => {
  console.error('Hosted management recusado antes da execução:', error.code || error.name); process.exitCode = 1;
});
module.exports = { assertHostedTarget };
