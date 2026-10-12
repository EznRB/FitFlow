'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
const exercise=(id,nome='Exercício '+id)=>({id,nome,grupo_muscular:'Peito',ativo:true,locale:'pt',source:'wger',instrucoes:'Descrição completa '+id});
function fixture(){
 const nodes=new Map(),calls=[],notices=[],listeners={};let epoch='first',opened=false,actions=[],closes=0;
 const node=(id,value='')=>{const n={id,value,innerHTML:'',textContent:'',isConnected:true,disabled:false,options:[],contains:()=>true,reportValidity:()=>true,addEventListener:(name,fn)=>{n['on'+name]=fn;},appendChild:o=>n.options.push(o)};nodes.set(id,n);return n;};
 for(const id of ['exercicios-table-body','btn-novo-exercicio','btn-sync-wger','filtro-grupo-muscular','filtro-nome-exercicio','filtro-idioma-exercicio','filtro-status-exercicio','catalog-count','catalog-prev','catalog-next','catalog-page'])node(id);
 nodes.get('filtro-grupo-muscular').options=[{value:''}];nodes.get('filtro-status-exercicio').value='true';
 const Auth={user:{id:7,role:'admin'},generation:1,sessionEpoch:'first',getSessionEpoch:()=>epoch},App={currentPage:'exercicios'};
 function clear(){for(const [id,n]of nodes)if(id.startsWith('ex-')||['form-exercicio','catalog-confirm','modal-save','catalog-detail'].includes(id)){n.isConnected=false;nodes.delete(id);}}
 const Modal={revision:0,open(title,html,buttons){this.revision++;clear();opened=true;actions=buttons;
   const fields=new Map();for(const m of html.matchAll(/<(?:input|select|textarea)[^>]*id="([^"]+)"[^>]*>/g)){fields.set(m[1],node(m[1],m[0].match(/value="([^"]*)"/)?.[1]||''));}
   for(const id of ['form-exercicio','catalog-confirm','catalog-detail'])if(html.includes('id="'+id+'"')){const n=node(id);n.querySelector=s=>fields.get(s.slice(1));n.innerHTML=html;}
   const primary=buttons.find(b=>b.class==='btn-primary');if(primary){const n=node('modal-save');n.innerHTML=primary.text;}
 },close(){this.revision++;closes++;clear();opened=false;},isOpen:()=>opened,confirm:(html,fn)=>{actions=[{action:fn}];}};
 const API=Object.fromEntries(['get','post','put','delete'].map(method=>[method,(route,payload)=>{if(method==='get'&&route==='/exercicios/grupos')return Promise.resolve({data:['Peito']});const d=deferred();calls.push({method,route,payload,...d});return d.promise;} ]));
 const context=vm.createContext({URL,console:{error(){},warn(){}},Auth,App,API,Modal,window:{addEventListener:(name,fn)=>listeners[name]=fn},document:{getElementById:id=>nodes.get(id)||null,createElement:()=>({}),querySelectorAll:()=>nodes.has('modal-save')?[nodes.get('modal-save')]:[]},Toast:Object.fromEntries(['error','warning','success'].map(kind=>[kind,message=>notices.push([kind,message])]))});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../client/js/exercicios-catalogo.js'),'utf8')+'\nthis.view=ExerciciosCatalogoView',context);
 return{view:context.view,nodes,node,calls,notices,Auth,App,API,Modal,actions:()=>actions,closes:()=>closes,listeners,epoch:value=>{epoch=value;Auth.sessionEpoch=value;},remoteEpoch:value=>epoch=value,fill(){nodes.get('ex-nome').value='Nome';nodes.get('ex-grupo').value='Peito';nodes.get('ex-instrucoes').value='Texto';nodes.get('ex-imagem').value='';}};
}
test('catálogo recusa resposta antiga por consulta, conta, geração, epoch ou âncora',async()=>{
 for(const change of ['query','user','generation','epoch','remoteEpoch','table','page','role']){
  const h=fixture();const first=h.view.carregarExercicios();const body=h.nodes.get('exercicios-table-body');
  if(change==='query'){const next=h.view.carregarExercicios();h.calls[1].resolve({data:[exercise(2,'Atual')]});await next;}
  else if(change==='user')h.Auth.user={id:8,role:'admin'};
  else if(change==='generation')h.Auth.generation++;
  else if(change==='epoch')h.epoch('second');
  else if(change==='remoteEpoch')h.remoteEpoch('second');
  else if(change==='table')h.node('exercicios-table-body').innerHTML='Tela nova';
  else if(change==='page')h.App.currentPage='dashboard';else h.Auth.user.role='student';
  const before=h.nodes.get('exercicios-table-body').innerHTML;h.calls[0].resolve({data:[exercise(1,'Antigo')]});await first;
  assert.equal(h.nodes.get('exercicios-table-body').innerHTML,before,change);assert.equal(h.notices.length,0);assert(!h.view.dados?.some(e=>e.nome==='Antigo'));
  if(change==='table')assert(!body.innerHTML.includes('Antigo'));
 }
});
test('criação funciona durante lista pendente e a resposta não substitui o formulário',async()=>{
 const h=fixture(),init=h.view.inicializar();assert.equal(typeof h.nodes.get('btn-novo-exercicio').onclick,'function');h.nodes.get('btn-novo-exercicio').onclick();const form=h.nodes.get('form-exercicio');assert(form);
 h.calls[0].resolve({data:[exercise(1)]});await init;assert.equal(h.nodes.get('form-exercicio'),form);
});
test('grupos da consulta antiga não removem opções recebidas após nova consulta',async()=>{
 const h=fixture(),older=deferred(),newer=deferred();let call=0;h.API.get=()=>++call===1?older.promise:newer.promise;
 const first=h.view.carregarGruposMusculares(),second=h.view.carregarGruposMusculares();newer.resolve({data:['Costas','Peito']});await second;
 const selector=h.nodes.get('filtro-grupo-muscular'),before=selector.innerHTML;older.resolve({data:['Peito']});await first;assert.equal(selector.innerHTML,before);assert.match(selector.innerHTML,/Costas/);
});
test('busca sem acentos e idioma paginam somente IDs elegíveis e zeram página ao filtrar',async()=>{
 const h=fixture();h.view.dados=Array.from({length:50},(_,i)=>exercise(i+1,i===49?'Elevação lateral':'Supino '+i));h.view.dados.push(exercise(-1,'Inválido'));
 h.view.cacheContext=h.view.contexto();h.view.renderizarResultados();assert.equal((h.nodes.get('exercicios-table-body').innerHTML.match(/data-action="detalhes"/g)||[]).length,24);
 h.view.mudarPagina(1);assert.equal(h.view.page,2);assert.match(h.nodes.get('catalog-count').textContent,/25.*48.*50/);
 h.nodes.get('filtro-nome-exercicio').value='elevacao';h.view.aplicarFiltros();assert.equal(h.view.page,1);assert.match(h.nodes.get('exercicios-table-body').innerHTML,/Elevação lateral/);assert.equal(h.nodes.get('catalog-next').disabled,true);
 h.nodes.get('filtro-idioma-exercicio').value='en';h.view.aplicarFiltros();assert.match(h.nodes.get('exercicios-table-body').innerHTML,/Nenhum exercício encontrado/);
});
test('filtro de português da fonte não inclui cadastro local com locale pt',()=>{
 const h=fixture();h.view.dados=[exercise(1,'Fonte'),{...exercise(2,'Local'),source:'local'}];h.view.cacheContext=h.view.contexto();h.nodes.get('filtro-idioma-exercicio').value='pt';h.view.renderizarResultados();
 assert.match(h.nodes.get('exercicios-table-body').innerHTML,/>Fonte</);assert(!h.nodes.get('exercicios-table-body').innerHTML.includes('>Local<'));
 h.nodes.get('filtro-idioma-exercicio').value='local';h.view.aplicarFiltros();assert.match(h.nodes.get('exercicios-table-body').innerHTML,/>Local</);assert(!h.nodes.get('exercicios-table-body').innerHTML.includes('>Fonte<'));
});
test('falha tem retry escapado; callback antigo e duplo clique não iniciam consultas extras',async()=>{
 const h=fixture(),first=h.view.carregarExercicios();h.calls[0].reject(new Error('<img src=x onerror=bad()>'));await first;
 const body=h.nodes.get('exercicios-table-body');assert.match(body.innerHTML,/data-catalog-retry/);assert(!body.innerHTML.includes('<img src=x'));assert.equal(h.notices.length,0);
 const retry=body.onclick,event={target:{closest:()=>({})}},next=retry(event);retry(event);assert.equal(h.calls.length,2);
 h.calls[1].resolve({data:[exercise(1)]});await next;assert.match(body.innerHTML,/Exercício 1/);retry(event);assert.equal(h.calls.length,2);
});
test('edição atrasada não abre sobre modal posterior ou outra conta',async()=>{
 for(const changed of ['modal','account']){const h=fixture(),edit=h.view.abrirModalEditar(9);if(changed==='modal')h.view.abrirModalCriar();else h.Auth.user.id=8;
 const current=h.nodes.get('form-exercicio');h.calls[0].resolve({data:exercise(9)});await edit;assert.equal(h.nodes.get('form-exercicio'),current);assert.equal(h.notices.length,0);}
});
test('edição atrasada respeita diálogo de outro módulo, inclusive aberto e fechado; erro tardio fica silencioso',async()=>{
 for(const close of [false,true])for(const rejected of [false,true]){const h=fixture(),edit=h.view.abrirModalEditar(9);h.Modal.open('Segurança da conta','<p>Outro módulo</p>',[]);if(close)h.Modal.close();
 if(rejected)h.calls[0].reject(new Error('Resposta antiga'));else h.calls[0].resolve({data:exercise(9)});await edit;assert.equal(h.nodes.has('form-exercicio'),false);assert.equal(h.notices.length,0);assert.equal(h.Modal.isOpen(),!close);}
});
test('Enter e botão compartilham envio; resposta antiga preserva resultado sem fechar formulário novo',async()=>{
 const h=fixture();h.view.abrirModalCriar();h.fill();const form=h.nodes.get('form-exercicio'),save=h.actions().find(a=>a.class==='btn-primary').action;assert.equal(typeof form.onsubmit,'function');
 let prevented=0;const first=form.onsubmit({preventDefault:()=>prevented++}),second=save();assert.equal(h.calls.length,1);assert.equal(h.calls[0].method,'post');assert.equal(prevented,1);
 h.view.abrirModalCriar();h.fill();const next=h.nodes.get('form-exercicio');const response={data:exercise(9)};h.calls[0].resolve(response);assert.equal(await first,response);await second;
 assert.equal(h.nodes.get('form-exercicio'),next);assert.equal(h.closes(),0);assert.equal(h.notices.length,0);
 await form.onsubmit({preventDefault(){}});await save();assert.equal(h.calls.length,1);
});
test('formulário inválido não envia e falha atual permite tentar novamente',async()=>{
 const h=fixture();h.view.abrirModalCriar();h.fill();const form=h.nodes.get('form-exercicio');form.reportValidity=()=>false;const invalid=h.view.salvarExercicio();assert.equal(h.calls.length,0);await invalid;
 form.reportValidity=()=>true;const first=h.view.salvarExercicio();h.calls[0].reject(new Error('Falha'));await first;assert.equal(h.nodes.get('modal-save').disabled,false);assert.equal(h.closes(),0);
 const next=h.view.salvarExercicio();h.calls[1].reject(new Error('Falha novamente'));await next;assert.equal(h.calls.length,2);
});
test('sincronização não duplica envio nem restaura botão de uma tela substituta',async()=>{
 const h=fixture(),first=h.view.sincronizarAPI(),second=h.view.sincronizarAPI();assert.equal(h.calls.length,1);const newer=h.node('btn-sync-wger');newer.innerHTML='Novo';h.App.currentPage='dashboard';h.calls[0].resolve({data:{completa:true}});await first;await second;assert.equal(newer.innerHTML,'Novo');assert.equal(h.notices.length,0);assert.equal(h.calls.length,1);
});
test('confirmação substituída e outro usuário não desativam; confirmação atual envia uma vez',async()=>{
 for(const changed of ['modal','account','current']){const h=fixture();h.view.confirmarDesativar(9,'Nome');const action=h.actions().find(a=>a.class==='btn-danger')?.action||h.actions()[0]?.action;
 if(changed==='modal')h.view.abrirModalCriar();if(changed==='account')h.Auth.user.id=8;const first=action();const second=action();
 if(changed==='current'){assert.equal(h.calls.length,1);h.App.currentPage='dashboard';h.calls[0].resolve({data:{id:9}});}else assert.equal(h.calls.length,0);await first;await second;assert.equal(h.notices.length,0);}
});
test('detalhes mostram descrição inteira e créditos; não reclassificam importação como ciência validada',()=>{
 const h=fixture();const ex={...exercise(9,'<script>nome</script>'),instrucoes:'A'.repeat(400)+'<img src=x>',sourceMetadata:{text:{author:'Autoria',license:{code:'CC-BY'}},media:[]}};h.view.dados=[ex];h.view.cacheContext=h.view.contexto();h.view.abrirDetalhes(9);
 const html=h.nodes.get('catalog-detail').innerHTML;assert(html.includes('A'.repeat(400)));assert(!html.includes('<img src=x>'));assert.match(html,/Autoria/);assert.match(html,/não foi validada/);assert.equal(h.calls.length,0);
});
