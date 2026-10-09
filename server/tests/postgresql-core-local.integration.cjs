// Real PostgreSQL gate, restricted to the dedicated native test database.
// Run: node scripts/with-postgresql-test-env.cjs node tests/postgresql-core-local.integration.cjs
// Creates and removes only this run's synthetic fixtures. No provider calls.
'use strict';
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');

require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();

const { getPrismaClientClass, getDatabaseProvider } = require('../src/config/databaseProvider');
assert.equal(getDatabaseProvider(), 'postgresql');
const PrismaClient = getPrismaClientClass();
const db = new PrismaClient({ log: [] });
globalThis.prisma = db;
const bcrypt = require('bcryptjs');
const { createSessoesService } = require('../src/services/sessoes.service');
const { createSessoesRepository } = require('../src/repositories/sessoes.repository');
const { createCheckinsRepository } = require('../src/repositories/checkins.repository');
const { createPagamentosService } = require('../src/services/pagamentos.service');
const { createCheckoutRepository } = require('../src/repositories/checkout.repository');
const { createCheckoutService } = require('../src/services/checkout.service');

const ownerIds = [], sessionIds = [randomUUID(), randomUUID()];
const quotaKey = randomBytes(32).toString('hex');
let plan, student, workout, exercise, stage = 'creating fixtures';
const rejectsStatus = (fn, status) => assert.rejects(fn, error => error.statusCode === status);
async function allSucceeded(label, promises) {
  const results = await Promise.allSettled(promises);
  const rejected = results.filter(result => result.status === 'rejected');
  if (rejected.length) {
    const error = new Error(label + ' failed');
    error.failureCodes = rejected.map(result => {
      const code = String(result.reason.code || result.reason.statusCode || result.reason.name);
      const databaseCode = String(result.reason.meta?.code || 'none');
      return code + '/db:' + (/^[A-Za-z0-9]+$/.test(databaseCode) ? databaseCode : 'omitted');
    });
    throw error;
  }
  return results.map(result => result.value);
}
async function checkRejects(name, operation) {
  await assert.rejects(operation, error => String(error.message).includes(name), 'Database must enforce ' + name);
}

async function run() {
  try {
    const password = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password, 4);
    assert.ok(await bcrypt.compare(password, passwordHash));
    plan = await db.plan.create({ data: { name: 'PostgreSQL fixture ' + randomUUID(), price: '150.00', durationDays: 30 } });
    const instructor = await db.user.create({ data: { name: 'Instrutor fixture', email: 'pg-instructor-' + randomUUID() + '@example.invalid', passwordHash, role: 'instructor' } });
    ownerIds.push(instructor.id);
    const user = await db.user.create({ data: { name: 'Aluno fixture', email: 'pg-student-' + randomUUID() + '@example.invalid', passwordHash, role: 'student' } });
    ownerIds.push(user.id);
    student = await db.student.create({ data: { userId: user.id, planId: plan.id, planEndDate: new Date('2099-11-01T00:00:00.000Z') } });
    workout = await db.workout.create({ data: { studentId: student.id, instructorId: instructor.id, name: 'Ficha fixture PostgreSQL' } });
    exercise = await db.exercise.create({ data: { workoutId: workout.id, name: 'Exercício fixture', muscleGroup: 'Peito', sets: 2, reps: '8–12', restSeconds: 90 } });

    stage = 'concurrent session start and JSONB roundtrip';
    const sessions = createSessoesService(createSessoesRepository(db));
    const start = { clientStartedAt: new Date().toISOString(), workoutId: workout.id, id: sessionIds[0] };
    await allSucceeded('session start', Array.from({ length: 4 }, () => sessions.start(user.id, start)));
    const storedStart = await db.workoutSession.findUnique({ where: { id: start.id } });
    assert.notDeepEqual(Object.keys(storedStart.startRequest), Object.keys(start), 'Persisted request must accept a client with a different key order');
    const [jsonbRoundtrip] = await db.$queryRaw`SELECT ${JSON.stringify(start)}::jsonb AS request`;
    assert.notDeepEqual(Object.keys(jsonbRoundtrip.request), Object.keys(start), 'PostgreSQL JSONB must normalize this key order independently of service normalization');
    assert.deepEqual(jsonbRoundtrip.request, start);
    assert.deepEqual(storedStart.startRequest, start);
    assert.equal((await sessions.start(user.id, start)).id, start.id);
    await rejectsStatus(() => sessions.start(user.id, { ...start, clientStartedAt: new Date(Date.now() - 1000).toISOString() }), 409);

    stage = 'concurrent series append and completion';
    const entry = { id: randomUUID(), exerciseId: exercise.id, weightKg: 25, reps: 8, rir: 2, kind: 'working', performedAt: new Date().toISOString(), notes: 'Synthetic PostgreSQL roundtrip' };
    await allSucceeded('set retry', Array.from({ length: 4 }, () => sessions.addSet(user.id, start.id, entry)));
    const storedSet = await db.workoutSet.findUnique({ where: { id: entry.id } });
    assert.notDeepEqual(Object.keys(storedSet.payload), Object.keys(entry));
    assert.deepEqual(storedSet.payload, entry);
    await rejectsStatus(() => sessions.addSet(user.id, start.id, { ...entry, reps: 9 }), 409);
    await allSucceeded('completion retry', Array.from({ length: 3 }, () => sessions.complete(user.id, start.id, { setIds: [entry.id] })));
    await rejectsStatus(() => sessions.complete(user.id, start.id, { setIds: [] }), 409);
    assert.equal((await sessions.addSet(user.id, start.id, entry)).id, entry.id);
    const saved = await db.workoutSession.findUnique({ where: { id: start.id }, include: { sets: true } });
    assert.equal(saved.status, 'completed'); assert.equal(saved.sets.length, 1);
    assert.equal(Number(saved.sets[0].weightKg) * saved.sets[0].reps, 200);

    stage = 'append versus completion race';
    await sessions.start(user.id, { ...start, id: sessionIds[1] });
    const firstSet = { ...entry, id: randomUUID() }, racingSet = { ...entry, id: randomUUID() };
    await sessions.addSet(user.id, sessionIds[1], firstSet);
    const [append, complete] = await Promise.allSettled([
      sessions.addSet(user.id, sessionIds[1], racingSet),
      sessions.complete(user.id, sessionIds[1], { setIds: [firstSet.id] }),
    ]);
    if (complete.status === 'fulfilled') {
      assert.equal(append.status, 'rejected'); assert.equal(append.reason.statusCode, 409);
    } else {
      assert.equal(complete.reason.statusCode, 409); assert.equal(append.status, 'fulfilled');
      await sessions.complete(user.id, sessionIds[1], { setIds: [firstSet.id, racingSet.id] });
    }
    assert.equal((await db.workoutSession.findUnique({ where: { id: sessionIds[1] } })).status, 'completed');
    console.log('PASS PostgreSQL sessions: concurrent retries, actual JSONB key normalization, differing payload 409 and append/completion race.');

    stage = 'civil DATE, TIME and instant';
    let instant = new Date('2026-10-01T02:59:59.000Z');
    const checkins = createCheckinsRepository({ db, now: () => instant });
    const firstCheckin = await checkins.create(student.id, user.id);
    assert.equal(firstCheckin.checkinDate.toISOString(), '2026-09-30T00:00:00.000Z');
    assert.equal(firstCheckin.checkinTime.getUTCHours(), 2);
    assert.equal(firstCheckin.checkinTime.getUTCMinutes(), 59);
    assert.equal(firstCheckin.createdAt.toISOString(), instant.toISOString());
    await checkins.cancelCheckin(firstCheckin.id, 'Cancelled test fixture', instructor.id);
    await rejectsStatus(() => checkins.create(student.id, user.id), 409);
    assert.equal((await checkins.findAll({ studentId: student.id, incluirCancelados: 'false' })).length, 0);
    instant = new Date('2026-10-01T03:00:00.000Z');
    assert.equal(await checkins.hasCheckedInToday(student.id), null);
    assert.equal((await checkins.create(student.id, user.id)).checkinDate.toISOString(), '2026-10-01T00:00:00.000Z');
    console.log('PASS PostgreSQL dates: civil DATE, UTC TIME, TIMESTAMPTZ instant, cancelled daily uniqueness and BRT midnight.');

    stage = 'concurrent financial renewal';
    const manual = createPagamentosService({ db });
    const payload = { studentId: student.id, planId: plan.id, amount: '150.00', paymentDate: '2099-10-08', paymentMethod: 'pix' };
    await allSucceeded('manual renewal', [manual.registrar(payload, instructor.id), manual.registrar(payload, instructor.id)]);
    assert.equal((await db.student.findUnique({ where: { id: student.id } })).planEndDate.toISOString().slice(0, 10), '2099-12-31');
    assert.equal(await db.payment.count({ where: { studentId: student.id } }), 2);

    stage = 'idempotent payment intent and concurrent reconciliation';
    const checkout = createCheckoutRepository(db);
    const input = { planId: plan.id, idempotencyKey: randomUUID() };
    const intents = await allSucceeded('payment intent', [checkout.createOrGet(user.id, input), checkout.createOrGet(user.id, input)]);
    assert.equal(intents[0].intent.id, intents[1].intent.id);
    const intent = intents[0].intent;
    await rejectsStatus(() => checkout.getOwned(intent.id, instructor.id), 404);
    const payment = { id: String(Date.now()), live_mode: false, collector_id: '123', currency_id: 'BRL', status: 'approved',
      transaction_amount: '150.00', transaction_amount_refunded: 0, external_reference: intent.id,
      metadata: { fitflow_intent_id: intent.id }, payment_method_id: 'pix', payment_type_id: 'bank_transfer', date_approved: new Date().toISOString() };
    const provider = { enabled: true, sellerId: '123', findPayment: async () => payment, getPayment: async () => payment };
    const checkoutService = createCheckoutService({ repository: checkout, provider });
    const reconciled = await allSucceeded('checkout reconciliation', Array.from({ length: 4 }, () => checkoutService.get(user.id, intent.id)));
    assert.ok(reconciled.every(result => result.state === 'paid' && result.settled));
    assert.equal((await db.student.findUnique({ where: { id: student.id } })).planEndDate.toISOString().slice(0, 10), '2100-01-30');
    assert.equal(await db.payment.count({ where: { studentId: student.id } }), 3);
    const settled = await checkout.findById(intent.id);
    await checkout.recordStatus(intent.id, { ...payment, status: 'pending' });
    assert.equal((await checkout.findById(intent.id)).state, 'paid');
    await rejectsStatus(() => manual.atualizar(settled.paymentId, { amount: '1.00' }), 409);
    payment.status = 'refunded';
    assert.equal((await checkoutService.get(user.id, intent.id)).state, 'review');
    assert.equal(await db.payment.count({ where: { studentId: student.id } }), 3);
    console.log('PASS PostgreSQL financial transactions: two renewals preserve balance, intent deduplication, four reconciliations create one ledger, ownership and refund review.');

    stage = 'ten database CHECK constraints';
    await checkRejects('workout_sessions_status_check', () => db.workoutSession.update({ where: { id: start.id }, data: { status: 'invalid' } }));
    for (const [name, data] of [
      ['workout_sets_kind_check', { kind: 'invalid' }], ['workout_sets_weight_check', { weightKg: -1 }],
      ['workout_sets_reps_check', { reps: 0 }], ['workout_sets_rir_check', { rir: 11 }],
    ]) await checkRejects(name, () => db.workoutSet.update({ where: { id: entry.id }, data }));
    await db.rateLimitBucket.create({ data: { key: quotaKey, hits: 1, windowEndsAt: new Date(Date.now() + 900000) } });
    await checkRejects('rate_limit_buckets_hits_check', () => db.rateLimitBucket.update({ where: { key: quotaKey }, data: { hits: -1 } }));
    for (const [name, data] of [
      ['payment_intents_state_check', { state: 'invalid' }], ['payment_intents_amount_check', { amount: 0 }],
      ['payment_intents_duration_check', { durationDays: 0 }], ['payment_intents_currency_check', { currency: 'USD' }],
    ]) await checkRejects(name, () => db.paymentIntent.update({ where: { id: intent.id }, data }));
    assert.equal((await db.workoutSet.findUnique({ where: { id: entry.id } })).reps, 8);
    assert.equal((await checkout.findById(intent.id)).state, 'review');
    console.log('PASS PostgreSQL integrity: all ten CHECK constraints reject invalid writes outside API validation.');
  } finally {
    // Exact fixture ownership only, even if a previous stage failed midway.
    try {
      const cleanup = [
        db.workoutSet.deleteMany({ where: { sessionId: { in: sessionIds } } }),
        db.workoutSession.deleteMany({ where: { id: { in: sessionIds } } }),
        db.rateLimitBucket.deleteMany({ where: { key: quotaKey } }),
      ];
      if (student) cleanup.push(
        db.paymentIntent.deleteMany({ where: { studentId: student.id } }),
        db.payment.deleteMany({ where: { studentId: student.id } }),
        db.checkin.deleteMany({ where: { studentId: student.id } }),
      );
      if (exercise) cleanup.push(db.exercise.delete({ where: { id: exercise.id } }));
      if (workout) cleanup.push(db.workout.delete({ where: { id: workout.id } }));
      if (student) cleanup.push(db.student.delete({ where: { id: student.id } }));
      if (ownerIds.length) cleanup.push(db.user.deleteMany({ where: { id: { in: ownerIds } } }));
      if (plan) cleanup.push(db.plan.delete({ where: { id: plan.id } }));
      await db.$transaction(cleanup);
    } finally { await db.$disconnect(); }
  }
}
run().catch(error => {
  const codes = error.failureCodes || [error.code || error.name];
  console.error('FAIL dedicated PostgreSQL core at ' + stage + '; codes: ' + codes.join(', ') + '. Internal diagnostics omitted.');
  process.exitCode = 1;
});
