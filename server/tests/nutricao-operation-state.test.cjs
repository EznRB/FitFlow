const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const science = require('../../client/js/science');
const input = { formula: 'mifflin', sex: 'male', age: 30, weightKg: 80, heightCm: 180, activityFactor: 1.5, adjustmentPercent: 0, proteinPerKg: 1.6, fatPercent: 25, eligible: true };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
test('render durante transição entre epochs não inicia escrita com identidade desatualizada', async () => {
  let writes = 0;
  const f = fixture({ put: async () => { writes++; return { data: { currentFormulaVersion: science.version } }; } });
  f.epoch('two');
  f.view.render(f.container);
  f.view.lastInputs = { ...input };
  await f.view.saveScenario(1);
  assert.equal(writes, 0);
});
function fixture(api) {
  const timers = new Map(); let nextTimer = 0;
  const elements = Object.fromEntries(Object.keys(input).map(key => [key, { value: String(input[key]), checked: true, focus() {} }]));
  const listeners = {}; const advanced = { open: false };
  const form = { elements, addEventListener(type,fn) { listeners[type]=fn; }, reset() {}, querySelector() { return advanced; } };
  const nodes = { '#nutrition-form': form };
  for (const selector of ['save','restore','delete','save-summary','account-status','error','result','sources','ai','review','review-summary','review-ack','review-confirm']) nodes[`#nutrition-${selector}`] = { textContent:'', innerHTML:'local result', disabled:false, hidden:true, checked:false };
  const container = { isConnected:true, innerHTML:'', querySelector: selector => nodes[selector] };
  let epoch = 'one';
  const context = { window:{addEventListener(){}}, document:{}, structuredClone, FitFlowScience:science, API:api, Auth:{user:{id:1},generation:1,sessionEpoch:'one',getSessionEpoch:()=>epoch}, AbortController,
    setTimeout(fn) { const id=++nextTimer; timers.set(id,fn); return id; }, clearTimeout(id){timers.delete(id);}, EvidenciasView:{renderSources(){},mountAI(){}} };
  vm.createContext(context); vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../../client/js/nutricao.js'),'utf8'),context);
  const view=vm.runInContext('NutricaoView',context); view.render(container); view.lastInputs=structuredClone(input);
  return {view,nodes,context,container,elements,timers,listeners,advanced,epoch(value){epoch=value;},expire(){ for(const fn of [...timers.values()]) fn(); }};
}
for (const method of ['put','delete']) for (const identity of ['generation','epoch']) test(`${method}: retorno de outra ${identity} da mesma conta não altera DOM`, async()=>{
  const waiting=deferred(); const f=fixture({[method]:()=>waiting.promise});
  const operation=method==='put'?f.view.saveScenario(1):f.view.deleteScenario(1);
  const status=f.nodes['#nutrition-account-status'].textContent;
  if(identity==='generation') f.context.Auth.generation++; else f.epoch('two');
  waiting.resolve({data:{currentFormulaVersion:science.version,deleted:true}}); await operation;
  assert.equal(f.nodes['#nutrition-account-status'].textContent,status);
});
test('confirma snapshot de 80 kg e identifica novo cálculo de 90 kg como não salvo',async()=>{
  const waiting=deferred(); const f=fixture({put:()=>waiting.promise}); const saving=f.view.saveScenario(1);
  f.view.lastInputs={...input,weightKg:90}; f.view.editRevision++;
  waiting.resolve({data:{currentFormulaVersion:science.version}}); await saving;
  assert.match(f.nodes['#nutrition-account-status'].textContent,/80 kg/);
  assert.match(f.nodes['#nutrition-account-status'].textContent,/90 kg[\s\S]*não.*salv/i);
  assert.equal(f.view.lastInputs.weightKg,90);
});
for(const method of ['get','put','delete']) test(`${method}: prazo de 15s limita operação e envia signal`,async()=>{
  const waiting=deferred(); let options;
  const f=fixture({[method]:(...args)=>{options=args.at(-1);return waiting.promise;}});
  const operation=method==='get'?f.view.restoreScenario(1):method==='put'?f.view.saveScenario(1):f.view.deleteScenario(1);
  assert.equal(options.timeoutMs,15000); assert.ok(options.signal);
  f.expire(); await operation;
  assert.match(f.nodes['#nutrition-account-status'].textContent,method==='get'?/consulta|recuperar/i:/não.*confirm|incerto/i);
  assert.equal(f.view.lastInputs.weightKg,80);
});
test('escrita incerta sobrevive reabertura; GET não libera repetição nem apaga cálculo',async()=>{
  let writes=0; const waiting=deferred();
  const f=fixture({put:()=>{writes++;return waiting.promise;},get:async()=>({data:{scenario:{inputs:{...input,weightKg:70},formulaVersion:science.version}}})});
  const saving=f.view.saveScenario(1); f.expire(); await saving;
  f.view.render(f.container); f.view.lastInputs={...input,weightKg:90}; f.view.updateAccountPreview();
  await f.view.saveScenario(1); assert.equal(writes,1);
  await f.view.restoreScenario(1);
  assert.equal(f.view.lastInputs.weightKg,90); assert.equal(f.elements.weightKg.value,'80');
  await f.view.saveScenario(1); assert.equal(writes,1);
  assert.equal(f.nodes['#nutrition-review'].hidden,false);
  assert.match(f.nodes['#nutrition-review-summary'].textContent,/70 kg/);
  assert.match(f.nodes['#nutrition-review-summary'].textContent,/não.*(término|terminou|conclu)/i);
});
test('operação pendente bloqueia repetição após navegar e renderizar novamente',async()=>{
  const waiting=deferred(); let writes=0;
  const f=fixture({put:()=>{writes++;return waiting.promise;}}); const saving=f.view.saveScenario(1);
  f.view.render(f.container); f.view.lastInputs={...input}; await f.view.saveScenario(1); assert.equal(writes,1);
  waiting.resolve({data:{currentFormulaVersion:science.version}}); await saving;
});
test('reabertura durante escrita permite conferir estado depois do prazo, sem prender controles',async()=>{
  const waiting=deferred(); const f=fixture({put:()=>waiting.promise,get:async()=>({data:{scenario:null}})});
  const saving=f.view.saveScenario(1); f.view.render(f.container);
  assert.equal(f.nodes['#nutrition-restore'].disabled,false);
  f.expire(); await saving;
  await f.view.restoreScenario(1); assert.equal(f.nodes['#nutrition-review'].hidden,false);
});
test('nova operação exige consulta válida, confirmação explícita e outro clique de salvar',async()=>{
  let writes=0; const f=fixture({put:async()=>{writes++;if(writes===1)throw new Error('offline');return {data:{currentFormulaVersion:science.version}};},get:async()=>({data:{scenario:null}})});
  f.view.render(f.container); f.view.lastInputs={...input};
  await f.view.saveScenario(1); f.view.reviewUncertainOperation(1); await f.view.saveScenario(1); assert.equal(writes,1);
  await f.view.restoreScenario(1); f.view.reviewUncertainOperation(1); await f.view.saveScenario(1); assert.equal(writes,1);
  f.nodes['#nutrition-review-ack'].checked=true; f.view.reviewUncertainOperation(1); assert.equal(writes,1);
  await f.view.saveScenario(1); assert.equal(writes,2); assert.equal(f.nodes['#nutrition-review'].hidden,true);
});
test('GET de sessão anterior e retorno tardio depois do timeout não sobrescrevem dados',async()=>{
  const waiting=deferred(); const f=fixture({get:()=>waiting.promise}); const reading=f.view.restoreScenario(1);
  f.context.Auth.generation++; waiting.resolve({data:{scenario:{inputs:{...input,weightKg:70},formulaVersion:science.version}}}); await reading;
  assert.equal(f.elements.weightKg.value,'80'); assert.equal(f.view.lastInputs.weightKg,80);
  const late=deferred(); const g=fixture({get:()=>late.promise}); const pending=g.view.restoreScenario(1); g.expire(); await pending;
  const status=g.nodes['#nutrition-account-status'].textContent;
  late.resolve({data:{scenario:{inputs:{...input,weightKg:70},formulaVersion:science.version}}}); await Promise.resolve(); await Promise.resolve();
  assert.equal(g.elements.weightKg.value,'80'); assert.equal(g.nodes['#nutrition-account-status'].textContent,status);
});
test('incerteza de uma conta não bloqueia outra conta nem permite callback antigo nela',async()=>{
  const waiting=deferred(); let writes=0;
  const f=fixture({put:()=>{writes++;return writes===1?waiting.promise:Promise.resolve({data:{currentFormulaVersion:science.version}});}});
  const saving=f.view.saveScenario(1); f.context.Auth.user={id:2}; f.context.Auth.generation++; f.view.render(f.container); f.view.lastInputs={...input,weightKg:90};
  await f.view.saveScenario(2); const status=f.nodes['#nutrition-account-status'].textContent;
  waiting.resolve({data:{currentFormulaVersion:science.version}}); await saving;
  assert.equal(writes,2); assert.equal(f.nodes['#nutrition-account-status'].textContent,status);
});
test('erro em campo básico mantém ajustes fechados; erro avançado abre apenas sua seção',()=>{
  const f=fixture({}); f.view.render(f.container);
  const basic={closest:()=>null,setAttribute(){}};
  f.listeners.invalid({target:basic}); assert.equal(f.advanced.open,false);
  const advanced={closest:()=>f.advanced,setAttribute(){}};
  f.listeners.invalid({target:advanced}); assert.equal(f.advanced.open,true);
});
test('trocar somente status/controles no DOM impede callback da operação anterior',async()=>{
  const waiting=deferred(); const f=fixture({put:()=>waiting.promise}); const saving=f.view.saveScenario(1);
  f.nodes['#nutrition-account-status']={textContent:'nova seção'};
  waiting.resolve({data:{currentFormulaVersion:science.version}}); await saving;
  assert.equal(f.nodes['#nutrition-account-status'].textContent,'nova seção');
});
test('navegação conserva bloqueio pendente mas resposta confirmada libera RAM sem escrever no novo DOM',async()=>{
  const waiting=deferred(); let writes=0;
  const f=fixture({put:()=>{writes++;return writes===1?waiting.promise:Promise.resolve({data:{currentFormulaVersion:science.version}});}});
  const saving=f.view.saveScenario(1); f.view.render(f.container); const status=f.nodes['#nutrition-account-status'].textContent;
  waiting.resolve({data:{currentFormulaVersion:science.version}}); await saving;
  assert.equal(f.nodes['#nutrition-account-status'].textContent,status);
  f.view.lastInputs={...input}; await f.view.saveScenario(1); assert.equal(writes,2);
});
test('conferir uma solicitação já confirmada após navegação não restaura medidas inesperadamente',async()=>{
  const waiting=deferred(); let reads=0;
  const f=fixture({put:()=>waiting.promise,get:async()=>{reads++;return {data:{scenario:{inputs:input,formulaVersion:science.version}}};}});
  const saving=f.view.saveScenario(1); f.view.render(f.container); f.view.lastInputs={...input,weightKg:90};
  waiting.resolve({data:{currentFormulaVersion:science.version}}); await saving;
  await f.view.restoreScenario(1); assert.equal(reads,0); assert.equal(f.view.lastInputs.weightKg,90);
  assert.match(f.nodes['#nutrition-account-status'].textContent,/confirmação.*navegava/);
  await f.view.restoreScenario(1); assert.equal(reads,1); assert.equal(f.view.lastInputs,null);
});
for(const status of [400,500]) test(`recusa HTTP${status} ${status===400?'permite correção':'exige revisão por resultado incerto'}`,async()=>{
  let calls=0; const f=fixture({put:async()=>{calls++;throw Object.assign(new Error('recusado'),{status});}});
  await f.view.saveScenario(1); await f.view.saveScenario(1); assert.equal(calls,status===400?2:1);
  assert.equal(f.view.lastInputs.weightKg,80);
});
test('logout apaga referências de DOM e medidas mas mantém marcador mínimo contra repetição',async()=>{
  const waiting=deferred(); const f=fixture({put:()=>waiting.promise}); const saving=f.view.saveScenario(1);
  f.view.clearPrivateState(); f.context.Auth.generation++; f.context.Auth.user=null;
  waiting.resolve({data:{currentFormulaVersion:science.version}}); await saving;
  assert.equal(f.view.lastInputs,null);
  const operation=f.view.accountOperations.get('1'); assert.equal(operation.state,'uncertain'); assert.equal(operation.container,null); assert.equal(operation.form,null); assert.equal(operation.nodes,null);
  f.context.Auth.user={id:1}; f.view.render(f.container); f.view.lastInputs={...input}; f.view.updateAccountPreview(); assert.equal(f.nodes['#nutrition-save'].disabled,true);
});
test('recusa tardia da sessão anterior não remove bloqueio de escrita mais nova',async()=>{
  const old=deferred(), recent=deferred(); let writes=0;
  const f=fixture({put:()=>{writes++;return writes===1?old.promise:recent.promise;},get:async()=>({data:{scenario:null}})});
  const first=f.view.saveScenario(1); f.view.clearPrivateState(); f.context.Auth.generation++; f.view.render(f.container); f.view.lastInputs={...input};
  await f.view.restoreScenario(1); f.nodes['#nutrition-review-ack'].checked=true; f.view.reviewUncertainOperation(1);
  const second=f.view.saveScenario(1); old.reject(Object.assign(new Error('recusa anterior'),{status:400})); await first;
  assert.equal(f.view.accountOperations.get('1').state,'pending'); await f.view.saveScenario(1); assert.equal(writes,2);
  recent.resolve({data:{currentFormulaVersion:science.version}}); await second;
});
for(const method of ['put','get','delete']) for(const identity of ['generation','epoch','sessionEpoch']) test(`${method}: handler do render anterior não inicia operação após mudar ${identity} mantendo id`,async()=>{
  let calls=0; const f=fixture({[method]:async()=>{calls++;return {data:{scenario:null,currentFormulaVersion:science.version,deleted:true}};}});
  const handler=f.nodes[method==='put'?'#nutrition-save':method==='get'?'#nutrition-restore':'#nutrition-delete'].onclick;
  if(identity==='generation') f.context.Auth.generation++; else if(identity==='epoch') f.epoch('two'); else f.context.Auth.sessionEpoch='two';
  await handler(); assert.equal(calls,0);
});
test('callback capturado de botão de render antigo não inicia escrita depois de novo render da mesma conta',async()=>{
  let calls=0; const f=fixture({put:async()=>{calls++;return {data:{currentFormulaVersion:science.version}};}});
  const oldHandler=f.nodes['#nutrition-save'].onclick; f.view.render(f.container); f.view.lastInputs={...input};
  await oldHandler(); assert.equal(calls,0);
});
