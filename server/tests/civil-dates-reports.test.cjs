const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { brazilDate, civilRange, brazilDayStartInstant } = require('../src/utils/civil-date');
const { createCheckinsRepository } = require('../src/repositories/checkins.repository');
const { createCheckinsService } = require('../src/services/checkins.service');
const { createCheckinsController } = require('../src/controllers/checkins.controller');
const { createRelatoriosController } = require('../src/controllers/relatorios.controller');
const { createAlunoPainelService } = require('../src/services/aluno-painel.service');
const { isOverdue } = require('../src/utils/helpers');
const iso = date => date.toISOString();
const date = value => new Date(value);
const bad = error => error?.statusCode === 400;

async function invoke(controller, name, query = {}) {
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  let error;
  await controller[name]({ query }, res, value => { error = value; });
  return { ...res, error };
}

test('DATE civil e instante mantêm contratos iguais em hosts UTC, Brasil e Ásia', () => {
  const script = `
    const { createCheckinsRepository } = require('./src/repositories/checkins.repository');
    const { brazilDate, brazilDayStartInstant } = require('./src/utils/civil-date');
    const now = new Date('2026-10-01T02:59:59.000Z');
    const repo = createCheckinsRepository({ now: () => now, db: { checkin: { create: async args => args.data } } });
    repo.create(11, 7).then(data => console.log(JSON.stringify({
      civil: data.checkinDate.toISOString(), instant: data.checkinTime.toISOString(),
      created: data.createdAt.toISOString(), start: brazilDayStartInstant(brazilDate(now)).toISOString()
    })));`;
  for (const TZ of ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo']) {
    const output = execFileSync(process.execPath, ['-e', script], { cwd: require('node:path').resolve(__dirname, '..'), env: { ...process.env, TZ }, encoding: 'utf8' });
    const actual = JSON.parse(output.trim().split('\n').at(-1));
    assert.deepEqual(actual, { civil: '2026-09-30T00:00:00.000Z', instant: '2026-10-01T02:59:59.000Z', created: '2026-10-01T02:59:59.000Z', start: '2026-09-30T03:00:00.000Z' });
  }
  assert.equal(iso(brazilDate(date('2026-10-01T03:00:00Z'))), '2026-10-01T00:00:00.000Z');
  // IANA rules also resolve a date that was under Brazilian daylight saving.
  assert.equal(iso(brazilDayStartInstant(date('2018-12-01T00:00:00Z'))), '2018-12-01T02:00:00.000Z');
});

test('filtros civis aceitam cada limite isolado e rejeitam datas inexistentes, arrays e inversão', () => {
  assert.equal(iso(civilRange({ startDate: '2024-02-29' }).gte), '2024-02-29T00:00:00.000Z');
  assert.equal(iso(civilRange({ endDate: '2026-09-30' }).lte), '2026-09-30T00:00:00.000Z');
  for (const query of [{ startDate: '2026-02-29' }, { endDate: '' }, { startDate: ['2026-10-01'] }, { startDate: '2026-10-02', endDate: '2026-10-01' }, { startDate: '2026-10-01T00:00:00Z' }]) assert.throws(() => civilRange(query), bad);
});

test('relatórios recusam filtros inválidos antes de consultar o banco', async () => {
  let calls = 0;
  const read = async () => { calls++; return []; };
  const controller = createRelatoriosController({ db: { payment: { findMany: read }, checkin: { groupBy: read, findMany: read }, student: { findMany: read } } });
  for (const name of ['financeiro', 'frequencia', 'checkins']) {
    for (const query of [{ startDate: '2026-02-30' }, { endDate: ['2026-10-01'] }, { startDate: '2026-10-02', endDate: '2026-10-01' }]) {
      assert.ok(bad((await invoke(controller, name, query)).error));
    }
  }
  assert.equal(calls, 0);
});

test('check-ins rejeitam filtros, limites e dias inválidos sem leituras de perfis', async () => {
  let calls = 0;
  const read = async () => { calls++; return []; };
  const repo = createCheckinsRepository({ db: { checkin: { findMany: read, groupBy: read } } });
  const service = createCheckinsService({ repository: repo, db: { student: { findUnique: read, findMany: read } } });
  for (const filters of [{ studentId: '11junk' }, { incluirCancelados: 'yes' }, { date: '2026-02-30' }, { date: '2026-10-01', endDate: '2026-10-02' }]) await assert.rejects(service.listar(filters), bad);
  for (const filters of [{ limit: '-1' }, { limit: '4foo' }, { limit: '367' }, { endDate: 'bad' }]) await assert.rejects(service.buscarPorAluno(11, filters), bad);
  const controller = createCheckinsController({ service });
  for (const dias of ['7foo', '0', '-1', '367', ['7'], '']) assert.ok(bad((await invoke(controller, 'frequencia', { dias })).error));
  assert.equal(calls, 0);
});

test('contagem e resumo do dia usam o mesmo dia BRT e excluem cancelamentos; últimos 30 dias são inclusivos', async () => {
  const queries = [];
  const read = async args => { queries.push(args); return []; };
  const repo = createCheckinsRepository({ now: () => date('2026-10-01T00:30:00Z'), db: { checkin: { count: read, findMany: read, groupBy: read } } });
  await repo.countToday(); await repo.findToday(); await repo.frequencyByStudent('30');
  for (const args of queries.slice(0, 2)) {
    assert.equal(args.where.status, 'present');
    assert.equal(iso(args.where.checkinDate.gte), '2026-09-30T00:00:00.000Z');
    assert.equal(iso(args.where.checkinDate.lt), '2026-10-01T00:00:00.000Z');
  }
  assert.equal(iso(queries[2].where.checkinDate.gte), '2026-09-01T00:00:00.000Z');
  assert.equal(iso(queries[2].where.checkinDate.lte), '2026-09-30T00:00:00.000Z');
});

test('dashboard às 00–03 UTC agrupa matrículas por instante BRT e pagamentos/presença por DATE civil', async () => {
  let month; let students; let attendance;
  const controller = createRelatoriosController({ now: () => date('2026-10-01T02:59:59Z'), repository: { countToday: async () => 1 }, db: {
    student: { count: async () => 2, findMany: async args => {
      if (!args.select) return [];
      students = args.where.createdAt;
      return [{ createdAt: date('2026-09-30T02:30:00Z') }, { createdAt: date('2026-10-01T00:30:00Z') }];
    } },
    workout: { count: async () => 1 },
    payment: { aggregate: async args => { month = args.where.paymentDate; return { _sum: { amount: 123 } }; }, findMany: async args => args.select ? [{ paymentDate: date('2026-09-30T00:00:00Z'), amount: 123 }] : [] },
    checkin: { findMany: async args => { if (!args.select) return []; attendance = args.where.checkinDate; return [{ checkinDate: date('2026-09-30T00:00:00Z') }]; } }
  } });
  const result = await invoke(controller, 'dashboard');
  assert.equal(result.error, undefined); assert.equal(result.code, 200);
  const data = result.body.data;
  assert.equal(iso(month.gte), '2026-09-01T00:00:00.000Z'); assert.equal(iso(month.lt), '2026-10-01T00:00:00.000Z');
  assert.equal(iso(students.gte), '2026-09-24T03:00:00.000Z'); assert.equal(iso(students.lt), '2026-10-01T03:00:00.000Z');
  assert.equal(iso(attendance.gte), '2026-09-24T00:00:00.000Z');
  assert.deepEqual(data.historico.alunos, [0, 0, 0, 0, 0, 1, 1]);
  assert.deepEqual(data.historico.checkins, [0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(data.historico.receita, [0, 0, 0, 0, 0, 0, 123]);
  assert.equal(data.historico.labels.at(-1), 'Qua');
});

test('relatório de presença expõe createdAt como instante e não interpreta TIME legado como horário BRT', async () => {
  const createdAt = date('2026-10-01T00:30:00Z');
  let ordering;
  const controller = createRelatoriosController({ db: { checkin: { findMany: async args => { ordering = args.orderBy; return [{ id: 1, studentId: 11, checkinDate: date('2026-09-30T00:00:00Z'), checkinTime: date('1970-01-01T21:30:00Z'), createdAt, status: 'present' }]; } } } });
  const result = await invoke(controller, 'checkins', { startDate: '2026-09-30', endDate: '2026-09-30' });
  assert.equal(result.body.data.items[0].hora, createdAt);
  assert.deepEqual(ordering, { createdAt: 'desc' });
  assert.equal(createdAt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }), '21:30');
});

test('painel do aluno conta o mês BRT, preserva paginação/ownership e vencimento civil', async () => {
  const queries = [];
  let now = date('2026-10-01T02:59:59Z');
  let lookups = 0;
  const aluno = { id: 11, status: 'active', planEndDate: date('2026-09-30T00:00:00Z') };
  const createdAt = date('2026-10-01T00:30:00Z');
  const service = createAlunoPainelService({ now: () => now, db: { student: { findUnique: async args => { lookups++; assert.equal(args.where.userId, 7); return aluno; } }, checkin: {
    findMany: async args => { queries.push(args); return [{ id: 1, checkinDate: date('2026-09-30T00:00:00Z'), checkinTime: date('1970-01-01T21:30:00Z'), createdAt, status: 'cancelled' }]; },
    count: async args => { queries.push(args); return args.where.checkinDate ? 1 : 2; }
  } } });
  for (const [limit, offset] of [['2foo', 0], [101, 0], [20, '-1'], [20, '1foo']]) await assert.rejects(service.getCheckins(7, limit, offset), bad);
  assert.equal(lookups, 0);
  const history = await service.getCheckins(7, '20', '0');
  assert.equal(history.total, 2); assert.equal(history.totalMes, 1); assert.equal(history.checkins[0].hora, createdAt);
  assert.ok(queries.every(query => query.where.studentId === 11));
  assert.equal(queries[1].where.status, undefined); // History includes cancelled records.
  assert.equal(iso(queries[2].where.checkinDate.gte), '2026-09-01T00:00:00.000Z');
  assert.equal(iso(queries[2].where.checkinDate.lt), '2026-10-01T00:00:00.000Z');
  assert.equal(service._calcularMensalidade(aluno, null).diasRestantes, 0);
  now = date('2026-10-01T03:00:00Z');
  assert.equal(service._calcularMensalidade(aluno, null).diasRestantes, -1);
});

test('carência de cinco dias termina na virada do sexto dia civil brasileiro, sem bloqueio às 00 UTC', () => {
  const end = date('2026-09-30T00:00:00Z');
  for (const time of ['2026-10-05T23:59:59Z', '2026-10-06T00:00:00Z', '2026-10-06T02:59:59Z']) assert.equal(isOverdue(end, 5, date(time)), false);
  assert.equal(isOverdue(end, 5, date('2026-10-06T03:00:00Z')), true);
  assert.equal(isOverdue(end, 0, date('2026-10-01T02:59:59Z')), false);
  assert.equal(isOverdue(end, 0, date('2026-10-01T03:00:00Z')), true);
});

test('ficha do painel expõe pausa cadastrada e preserva zero sem inventar padrão', async () => {
  const service = createAlunoPainelService({ now: () => date('2026-10-08T12:00:00Z'), db: {
    student: { findUnique: async () => ({ id: 11, status: 'active', planEndDate: date('2026-12-31T00:00:00Z'), user: { id: 7, name: 'Fixture', email: 'fixture@example.invalid' } }) },
    workout: { findMany: async () => [{ id: 5, name: 'Ficha', createdAt: date('2026-10-01T12:00:00Z'), exercises: [{ id: 1, name: 'A', sets: 2, reps: '8–12', restSeconds: 0, workoutLogs: [] }, { id: 2, name: 'B', sets: 2, reps: '8–12', restSeconds: 120, workoutLogs: [] }] }] },
    payment: { findFirst: async () => null },
    checkin: { findMany: async () => [], count: async () => 0 }
  } });
  const result = await service.getPainelCompleto(7);
  assert.deepEqual(result.treinos[0].exercicios.map(ex => ex.descansoSegundos), [0, 120]);
});
