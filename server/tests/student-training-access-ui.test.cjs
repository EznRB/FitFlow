const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function fixture(access) {
  const context = vm.createContext({ window: { addEventListener() {} } });
  for (const file of ['security.js', 'aluno-painel.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext('this.panel=AlunoPainelView;this.workouts=AlunoTreinoView;',context);
  const data = { perfil: {nome:'Aluno fictício',status:'active'}, mensalidade:{diasRestantes:-20}, checkins:{totalMes:0,recentes:[]}, treinos:[], alertas:[], ...(access ? {trainingAccess:access} : {}) };
  const container = { innerHTML:'',querySelectorAll(){return [];} };
  context.panel.dados=data;
  return { context,data,container };
}
test('painel distingue acesso restrito de zero fichas confirmadas',()=>{
 const h=fixture({allowed:false,reason:'Mensalidade vencida.'});h.context.panel.renderizar(h.container);
 assert.match(h.container.innerHTML,/Acesso às fichas/);assert.match(h.container.innerHTML,/Restrito/);
 assert.match(h.container.innerHTML,/Consulta de fichas indisponível/);assert.doesNotMatch(h.container.innerHTML,/Nenhuma ficha ativa/);
});
test('zero confirmado e resposta anterior sem campo de acesso continuam distintos do bloqueio',()=>{
 for(const access of [{allowed:true,reason:null},undefined]){
  const h=fixture(access);h.context.panel.renderizar(h.container);
  assert.match(h.container.innerHTML,/Fichas ativas/);assert.match(h.container.innerHTML,/Nenhuma ficha ativa/);assert.doesNotMatch(h.container.innerHTML,/Restrito/);
 }
});
test('ficha restrita não apresenta exercícios nem converte bloqueio em ausência de dados',()=>{
 const h=fixture({allowed:false,reason:'Consulte a recepção <script>.'});
 h.data.treinos=[{nome:'Ficha não liberada',exercicios:[],criadoEm:'2026-11-01'}];
 h.context.workouts.dados=h.data;h.context.workouts.bloqueado=true;h.context.workouts.renderizar(h.container);
 assert.match(h.container.innerHTML,/Consulta de fichas indisponível/);assert.doesNotMatch(h.container.innerHTML,/Ficha não liberada/);
 assert.match(h.container.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(h.container.innerHTML,/<script>/);
});
