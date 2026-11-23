'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture() {
 const nodes = new Map(), requests = [], timers = new Map(), notices = []; let timerId = 0, dialog;
 for (const id of ['exercicios-table-body','filtro-grupo-muscular','filtro-status-exercicio','filtro-nome-exercicio','filtro-idioma-exercicio','catalog-prev','catalog-next','catalog-count','catalog-page']) nodes.set(id, { value:'', innerHTML:'', textContent:'', disabled:false, isConnected:true, contains:()=>true });
 nodes.get('filtro-status-exercicio').value='true'; nodes.get('filtro-grupo-muscular').value='Costas'; nodes.get('filtro-grupo-muscular').innerHTML='<option>Costas</option>';
 const Modal = { revision:0, open(title, html, actions) { this.revision++; dialog={title,html,actions}; }, close() {this.revision++;} };
 const context = vm.createContext({ URL, AbortController, Auth:{user:{id:7,role:'admin'},generation:1},App:{currentPage:'exercicios'}, Modal, Toast:{error:message=>notices.push(message)},
  document:{getElementById:id=>nodes.get(id)||null}, window:{addEventListener(){},dispatchEvent(){}}, CustomEvent:class{},
  setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),
  fetch(url,options){let finish;const promise=new Promise(resolve=>{finish=resolve;});requests.push({url,options,finish});return promise;}
 });
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../client/js/api.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../../client/js/exercicios-catalogo.js'),'utf8')+'\nglobalThis.view=ExerciciosCatalogoView;',context);
 return {view:context.view,nodes,requests,timers,Modal,notices,dialog:()=>dialog,finish(index,data){requests[index].finish(new Response(JSON.stringify({data}),{status:200}));}};
}
const valid={id:9,nome:'Remada',grupo_muscular:'Costas',ativo:true,instrucoes:null,imagem_url:null};
test('stalled catalog, optional groups and detail requests finish at deadline without late effects',async()=>{
 for(const kind of ['list','groups','detail']){
  const h=fixture();const before=h.nodes.get('filtro-grupo-muscular').innerHTML;
  const pending=kind==='list'?h.view.carregarExercicios():kind==='groups'?h.view.carregarGruposMusculares():h.view.abrirModalEditar(9);
  const timer=[...h.timers.values()][0];assert.equal(timer?.delay,15000,kind);
  timer.callback();await pending;assert.equal(h.requests[0].options.signal.aborted,true);
  if(kind==='list'){assert.match(h.nodes.get('exercicios-table-body').innerHTML,/Tentar novamente/);assert.equal(h.view.cacheContext,null);}
  if(kind==='groups')assert.equal(h.nodes.get('filtro-grupo-muscular').innerHTML,before);
  if(kind==='detail')assert.ok(h.dialog().actions.some(action=>/Tentar novamente/.test(action.text)));
  const markup=h.nodes.get('exercicios-table-body').innerHTML, revision=h.Modal.revision;
  h.finish(0,kind==='list'?[valid]:kind==='groups'?['Peito']:valid);await Promise.resolve();await Promise.resolve();
  assert.equal(h.nodes.get('exercicios-table-body').innerHTML,markup);assert.equal(h.Modal.revision,revision);assert.equal(h.requests.length,1);
 }
});
test('malformed list, invalid IDs and duplicates are errors rather than empty or partial catalogs; retry recovers',async()=>{
 for(const payload of [null,{},[null],[{id:9}],[{...valid,nome:''}],[{...valid,ativo:null}],[{...valid,grupo_muscular:3}],[valid,{...valid,id:0}],[valid,{...valid,id:'10'}],[valid,{...valid,id:9}]]){
  const h=fixture(),pending=h.view.carregarExercicios();h.finish(0,payload);await pending;
  const body=h.nodes.get('exercicios-table-body');assert.match(body.innerHTML,/Não foi possível carregar o catálogo/);assert.match(body.innerHTML,/data-catalog-retry/);
  assert.equal(h.view.dados.length,0);assert.equal(h.view.cacheContext,null);assert.equal(h.nodes.get('filtro-nome-exercicio').disabled,true);
  const retry=body.onclick({target:{closest:()=>({})}});h.finish(1,[valid]);await retry;
  assert.match(body.innerHTML,/Remada/);assert.equal(h.view.dados.length,1);assert.equal(h.nodes.get('filtro-nome-exercicio').disabled,false);
  assert.match(h.requests[1].url,/grupo_muscular=Costas/);
 }
 const empty=fixture(),pending=empty.view.carregarExercicios();empty.finish(0,[]);await pending;
 assert.match(empty.nodes.get('exercicios-table-body').innerHTML,/Nenhum exercício/);
});
test('invalid detail shows scoped manual recovery and optional malformed groups preserve existing options',async()=>{
 const h=fixture();let form;h.view.abrirFormulario=data=>{form=data;};
 const pending=h.view.abrirModalEditar(9);h.finish(0,{...valid,id:10});await pending;
 assert.equal(form,undefined);const action=h.dialog().actions.find(action=>/Tentar novamente/.test(action.text));assert.ok(action);
 const retried=action.action();h.finish(1,valid);await retried;assert.equal(form.id,9);
 const groups=h.view.carregarGruposMusculares();h.finish(2,{bad:true});await groups;
 assert.equal(h.nodes.get('filtro-grupo-muscular').innerHTML,'<option>Costas</option>');
});
test('detail recovery from a replaced dialog cannot request data or close the newer dialog',async()=>{
 const h=fixture(),pending=h.view.abrirModalEditar(9);h.finish(0,null);await pending;
 const previous=h.dialog().actions;
 h.Modal.open('Outro módulo','<p>Atual</p>',[]);const revision=h.Modal.revision;
 for(const action of previous)await action.action();
 assert.equal(h.requests.length,1);assert.equal(h.Modal.revision,revision);assert.equal(h.dialog().title,'Outro módulo');
});

test('incomplete edit data cannot open blank fields that would erase existing content',async()=>{
 for(const missing of ['instrucoes','imagem_url','nome','ativo']){
  const h=fixture();let opened=false;h.view.abrirFormulario=()=>{opened=true;};
  const partial={...valid};delete partial[missing];
  const pending=h.view.abrirModalEditar(9);h.finish(0,partial);await pending;
  assert.equal(opened,false,missing);assert.ok(h.dialog().actions.some(action=>/Tentar novamente/.test(action.text)));
 }
});
