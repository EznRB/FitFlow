'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID,randomBytes}=require('node:crypto');
const canonical='https://fit-flow-indol.vercel.app', vars=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../.env.remote.local')));
require('./hosted-management.integration.cjs').assertHostedTarget(vars,canonical);
assert.equal(process.argv[2],'--execute-hosted-fixtures');
const {PrismaClient}=require('../generated/postgresql'),owner=new PrismaClient({datasources:{db:{url:vars.DIRECT_URL}},log:[]});
const prefix='Hosted origin '+randomUUID(),emails=['instructor','student'].map(role=>role+'.'+randomUUID()+'@example.invalid'),users=[],sessionIds=[];
let student,stage='fixtures';
async function request(route,{method='GET',body,cookie,expected=200}={}){
 const response=await fetch(canonical+'/api'+route,{method,headers:{Origin:canonical,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(25000)});
 assert.equal(response.status,expected,stage+' HTTP');const data=await response.json();return {data:data.data,response};
}
(async()=>{
 try{
  const password=randomBytes(24).toString('base64url'),passwordHash=await require('bcryptjs').hash(password,10);
  for(const [i,role] of ['instructor','student'].entries())users.push(await owner.user.create({data:{name:prefix,email:emails[i],passwordHash,role}}));
  student=await owner.student.create({data:{userId:users[1].id,planEndDate:new Date('2099-11-01T00:00:00Z')}});
  const cookies=[];for(const email of emails){const login=await request('/auth/login',{method:'POST',body:{email,password}});cookies.push(login.response.headers.get('set-cookie').split(';')[0]);}
  stage='catalog selection';const catalog=(await request('/treinos/catalogo',{cookie:cookies[0]})).data.find(c=>c.source==='wger'&&c.sourceMetadata?.text?.author);
  assert.ok(catalog,'A credited real catalog entry is required');
  const ex={name:catalog.nome,muscleGroup:catalog.grupo_muscular,sets:2,reps:'8-12',restSeconds:90,catalogExerciseId:catalog.id};
  await request('/treinos',{method:'POST',cookie:cookies[0],body:{name:prefix,studentId:student.id,exercises:[{...ex,catalogSnapshot:{source:'forged'}}]},expected:400});
  const first=(await request('/treinos',{method:'POST',cookie:cookies[0],body:{name:prefix,studentId:student.id,exercises:[ex]},expected:201})).data;
  const snapshot=first.exercises[0].catalogSnapshot;assert.equal(snapshot.catalogExerciseId,catalog.id);assert.deepEqual(snapshot.sourceMetadata.text,catalog.sourceMetadata.text);assert.equal(snapshot.sourceMetadata.upstream,undefined);
  stage='student session snapshot';const body={id:randomUUID(),workoutId:first.id,clientStartedAt:new Date().toISOString()};sessionIds.push(body.id);
  assert.deepEqual((await request('/sessoes/start',{method:'POST',cookie:cookies[1],body,expected:201})).data.planSnapshot.exercises[0].catalogSnapshot,snapshot);
  assert.deepEqual((await request('/sessoes/start',{method:'POST',cookie:cookies[1],body,expected:201})).data.planSnapshot.exercises[0].catalogSnapshot,snapshot);
  stage='revision and previous origin ownership';
  const revised=(await request('/treinos/'+first.id,{method:'PUT',cookie:cookies[0],body:{name:prefix,exercises:[{...ex,sourceExerciseId:first.exercises[0].id,name:ex.name.slice(0,90)+' adaptado'}]}})).data;
  assert.notEqual(revised.exercises[0].id,first.exercises[0].id);assert.deepEqual(revised.exercises[0].catalogSnapshot,snapshot);
  assert.deepEqual((await request('/sessoes',{cookie:cookies[1]})).data.sessions.find(s=>s.id===body.id).planSnapshot.exercises[0].catalogSnapshot,snapshot);
  const own=(await request('/treinos/meus',{cookie:cookies[1]})).data;assert.ok(own.some(w=>w.id===revised.id));assert.ok(!own.some(w=>w.id===first.id));
  console.log('Hosted origin HTTPS PASS: real wger credit, forged metadata rejected, session/replay, stable revision snapshot and distinct Exercise IDs; two logins, quotas preserved.');
 }finally{
  if(student){await owner.$transaction(async tx=>{
   const workouts=await tx.workout.findMany({where:{studentId:student.id},select:{id:true,name:true,instructorId:true}});
   assert.ok(workouts.every(w=>w.name===prefix&&w.instructorId===users[0].id));
   await tx.workoutSet.deleteMany({where:{sessionId:{in:sessionIds}}});await tx.workoutSession.deleteMany({where:{id:{in:sessionIds},studentId:student.id}});
   await tx.exercise.deleteMany({where:{workoutId:{in:workouts.map(w=>w.id)}}});await tx.workout.deleteMany({where:{id:{in:workouts.map(w=>w.id)}}});await tx.student.delete({where:{id:student.id}});
  });}
  if(users.length)await owner.user.deleteMany({where:{id:{in:users.map(u=>u.id)},email:{in:emails},name:prefix}});
  console.log('Only this run’s origin fixtures removed; catalog and demonstrative accounts preserved.');
 }
})().catch(e=>{console.error('Hosted origin FAIL: '+stage+' '+(e.code||e.name));process.exitCode=1}).finally(()=>owner.$disconnect());
