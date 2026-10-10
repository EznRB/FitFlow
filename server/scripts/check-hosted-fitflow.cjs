'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const target = new URL(process.argv[2]);
assert.equal(target.protocol, 'https:');
assert.ok(target.hostname === 'fit-flow-indol.vercel.app' || /^fit-flow-[a-z0-9]+-eznrbs-projects\.vercel\.app$/.test(target.hostname));
assert.equal(target.pathname, '/');
const credentials = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.demo-credentials.remote.local.json')));
const headers = {};
if (target.hostname !== 'fit-flow-indol.vercel.app') {
  const vars = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../../.env.local')));
  assert.ok(vars.VERCEL_OIDC_TOKEN);
  headers['x-vercel-trusted-oidc-idp-token'] = vars.VERCEL_OIDC_TOKEN;
}
let stage = 'health';
const request = (endpoint, options={}) => fetch(new URL(endpoint,target), { ...options, headers: {...headers,...options.headers}, redirect:'manual', signal:AbortSignal.timeout(20000) });
(async () => {
  const health = await request('/api/health'); assert.equal(health.status,200); assert.equal((await health.json()).database,'ready');
  const cookies = {};
  for (const [key, role] of [['admin','admin'],['instructor','instructor'],['student','student']]) {
    stage='login '+role;
    const login = await request('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json',Origin:target.origin}, body:JSON.stringify(credentials[key]) });
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie');
    assert.match(cookie,/; Secure/i); assert.match(cookie,/; HttpOnly/i); assert.match(cookie,/; SameSite=Lax/i);
    cookies[key]=cookie.split(';')[0];
    const body=await login.json(); assert.equal(body.data.user.role,role); assert.ok(!body.data.token);
    const me=await request('/api/auth/me',{headers:{Cookie:cookies[key]}}); assert.equal(me.status,200); assert.equal((await me.json()).data.user.role,role);
  }
  stage='roles and catalog';
  assert.equal((await request('/api/relatorios/dashboard',{headers:{Cookie:cookies.admin}})).status,200);
  assert.equal((await request('/api/relatorios/dashboard',{headers:{Cookie:cookies.student}})).status,403);
  const catalog=await request('/api/treinos/catalogo',{headers:{Cookie:cookies.instructor}}); assert.equal(catalog.status,200);
  assert.equal((await request('/api/aluno/painel',{headers:{Cookie:cookies.student}})).status,200);
  stage='csrf and logout';
  assert.equal((await request('/api/auth/logout',{method:'POST',headers:{Cookie:cookies.student,Origin:'https://attacker.invalid'}})).status,403);
  const logout=await request('/api/auth/logout',{method:'POST',headers:{Cookie:cookies.student,Origin:target.origin}}); assert.equal(logout.status,200);
  assert.match(logout.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/);
  const home=await request('/'); assert.equal(home.status,200);
  assert.match(await home.text(),/FitFlow/);
  console.log('HTTPS hosted gate PASS: banco ready, login/me nos 3 perfis, cookie Secure/HttpOnly, autorização, catálogo, fichas, CSRF e logout.');
})().catch(error=>{console.error('Hosted gate failed:',stage,error.name,'actual',error.actual,'expected',error.expected);process.exitCode=1;});
