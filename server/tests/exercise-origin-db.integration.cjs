'use strict';
// Native test databases or the existing isolated Neon verification branch only.
const assert = require('node:assert/strict'), { randomUUID, randomBytes } = require('node:crypto');
const url = new URL(process.env.DATABASE_URL || 'file:missing');
assert.ok(['test','development'].includes(process.env.NODE_ENV));
if (url.protocol === 'mysql:') {
  assert.equal(process.env.LOCAL_DB_MANAGED,'fitflow-native-v1'); assert.equal(url.hostname,'127.0.0.1'); assert.equal(url.port,'3308'); assert.equal(url.pathname,'/fitflow_dev');
} else require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();
const PrismaClient = require('../src/config/databaseProvider').getPrismaClientClass(), db = new PrismaClient({ log: [] });
globalThis.prisma = db;
const { createTreinosService } = require('../src/services/treinos.service'), { createTreinosRepository } = require('../src/repositories/treinos.repository');
const { createSessoesService } = require('../src/services/sessoes.service'), { createSessoesRepository } = require('../src/repositories/sessoes.repository');
const users = [], sessionIds = [], prefix = 'Origin fixture ' + randomUUID(); let catalog, student, stage='fixtures';
(async()=>{
  try {
    for (const role of ['instructor','student']) users.push(await db.user.create({ data: { name: prefix, email: randomUUID()+'@example.invalid', passwordHash: randomBytes(48).toString('hex'), role } }));
    student = await db.student.create({ data: { userId: users[1].id, planEndDate: new Date('2099-11-01T00:00:00Z') } });
    catalog = await db.catalogoExercicio.create({ data: { nome: prefix, grupo_muscular: 'Costas', source: 'local', curated: true,
      sourceMetadata: { version: 1, text: { author: 'Synthetic fixture', license: { code: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' } }, equipment: [{ id: 1, name: 'Synthetic' }] } } });
    const workouts = createTreinosService({ db, repo: createTreinosRepository(db) }), actor = users[0];
    const exercise = { name: 'Adaptação sintética', muscleGroup: 'Costas', sets: 2, reps: '8-12', restSeconds: 90, catalogExerciseId: catalog.id };
    stage='catalog capture and manual unknown';
    const first = await workouts.criar({ name: prefix, studentId: student.id, exercises: [exercise,{ ...exercise, name: catalog.nome, catalogExerciseId: null }] },actor);
    assert.equal(first.exercises[0].catalogExerciseId,catalog.id); assert.equal(first.exercises[0].catalogSnapshot.originalName,catalog.nome);
    assert.equal(first.exercises[0].catalogSnapshot.sourceMetadata.text.author,'Synthetic fixture');
    assert.equal(first.exercises[1].catalogExerciseId,null); assert.equal(first.exercises[1].catalogSnapshot,null);
    stage='constraints';
    await assert.rejects(db.exercise.create({ data: { workoutId:first.id,name:'Invalid pair',catalogExerciseId:catalog.id } }),e=>String(e.message).includes('exercises_catalog_origin_pair_check'));
    await assert.rejects(db.exercise.create({ data: { workoutId:first.id,name:'Missing catalog',catalogExerciseId:2147483647,catalogSnapshot:{version:1} } }),e=>e.code==='P2003');
    await assert.rejects(db.catalogoExercicio.delete({where:{id:catalog.id}}),e=>e.code==='P2003');
    stage='session snapshot and catalog update';
    const sessions = createSessoesService(createSessoesRepository(db));
    const request = {id:randomUUID(),workoutId:first.id,clientStartedAt:new Date().toISOString()}; sessionIds.push(request.id);
    const started = await sessions.start(users[1].id,request), original = structuredClone(first.exercises[0].catalogSnapshot);
    assert.deepEqual(started.planSnapshot.exercises[0].catalogSnapshot,original);
    await db.catalogoExercicio.update({where:{id:catalog.id},data:{ativo:false,nome:'Fonte alterada',sourceMetadata:{text:{author:'Changed'}}}});
    assert.deepEqual((await sessions.start(users[1].id,request)).planSnapshot.exercises[0].catalogSnapshot,original);
    assert.deepEqual((await db.exercise.findUnique({where:{id:first.exercises[0].id}})).catalogSnapshot,original);
    stage='revision inherits even when catalog inactive';
    const next = await workouts.atualizar(first.id,{name:prefix+' revised',exercises:first.exercises.map(e=>({name:e.name,muscleGroup:e.muscleGroup,sets:e.sets,reps:e.reps,restSeconds:e.restSeconds,catalogExerciseId:e.catalogExerciseId,sourceExerciseId:e.id}))},actor);
    assert.notEqual(next.exercises[0].id,first.exercises[0].id);
    assert.deepEqual(next.exercises[0].catalogSnapshot,original);
    assert.equal((await db.workout.findUnique({where:{id:first.id}})).active,false);
    const second={id:randomUUID(),workoutId:next.id,clientStartedAt:new Date().toISOString()}; sessionIds.push(second.id);
    assert.deepEqual((await sessions.start(users[1].id,second)).planSnapshot.exercises[0].catalogSnapshot,original);
    const count=await db.workout.count({where:{studentId:student.id}});
    await assert.rejects(workouts.criar({name:prefix,studentId:student.id,exercises:[exercise]},actor),e=>e.statusCode===400);
    assert.equal(await db.workout.count({where:{studentId:student.id}}),count);
    console.log('Origin DB PASS: capture, manual unknown, FK/CHECK, immutable session/replay, revision with inactive catalog and distinct Exercise IDs.');
  } finally {
    if(student){await db.workoutSet.deleteMany({where:{sessionId:{in:sessionIds}}}); await db.workoutSession.deleteMany({where:{id:{in:sessionIds},studentId:student.id}});
      const rows=await db.workout.findMany({where:{studentId:student.id},select:{id:true}});
      await db.exercise.deleteMany({where:{workoutId:{in:rows.map(r=>r.id)}}}); await db.workout.deleteMany({where:{studentId:student.id}}); await db.student.delete({where:{id:student.id}});}
    if(catalog)await db.catalogoExercicio.delete({where:{id:catalog.id}});
    if(users.length)await db.user.deleteMany({where:{id:{in:users.map(u=>u.id)},name:prefix}});
    console.log('Only this run’s UUID fixtures removed.');
  }
})().catch(e=>{console.error('Origin DB gate failed at '+stage+': '+(e.code||e.name));process.exitCode=1}).finally(()=>db.$disconnect());
