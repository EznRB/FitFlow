'use strict';
// Secrets travel through stdin, never command arguments or console output.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const target = process.argv[2];
assert.ok(['preview','production'].includes(target), 'Specify preview or production.');
const linked = JSON.parse(fs.readFileSync(path.join(root, '.vercel/project.json')));
assert.equal(linked.projectId, 'prj_WuZ2SgTjkrNUmPnebAhq0fjmEdwI');
assert.equal(linked.orgId, 'team_GYg7v0g4Za298khudDk3pqHL');
const vars = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../.env.remote.runtime.local')));
if (target === 'preview') {
  const file = path.resolve(__dirname, '../.env.remote.preview.local');
  if (!fs.existsSync(file)) fs.writeFileSync(file, 'JWT_SECRET='+require('node:crypto').randomBytes(48).toString('hex')+'\n');
  vars.JWT_SECRET = require('dotenv').parse(fs.readFileSync(file)).JWT_SECRET;
}
assert.equal(vars.NEON_PROJECT_ID, 'mute-night-99440749');
assert.equal(vars.NEON_BRANCH_ID, 'br-tiny-king-b6carztp');
const connection = new URL(vars.DATABASE_URL);
assert.equal(connection.hostname, 'ep-jolly-grass-b6jl6hjo-pooler.c-2.sa-east-1.aws.neon.tech');
assert.equal(connection.username, 'fitflow_app');
assert.equal(connection.pathname, '/fitflow');
assert.equal(connection.searchParams.get('sslaccept'), 'strict');
assert.ok(vars.JWT_SECRET.length >= 64);
const cli = path.join(process.env.APPDATA, 'npm/node_modules/vercel/dist/vc.js');
assert.ok(fs.existsSync(cli), 'Authenticated Vercel CLI required.');
for (const key of ['DATABASE_PROVIDER','DATABASE_URL','DIRECT_URL','JWT_SECRET','CORS_ORIGIN','NODE_ENV']) {
  const type = ['DATABASE_URL','DIRECT_URL','JWT_SECRET'].includes(key) ? 'secret' : 'config';
  const child = spawnSync(process.execPath, [cli,'env','add',key,target,'--force','--yes','--type',type,
    '--scope','eznrbs-projects','--project',linked.projectId], {
    cwd: root, input: vars[key], encoding: 'utf8', windowsHide: true,
  });
  if (child.status !== 0) {
    fs.writeFileSync(path.join(root,'.vercel/env-sync.failure.log'), String(child.stdout || '')+String(child.stderr || ''));
    throw new Error('Vercel configuration failed for '+key+'; private diagnostic saved.');
  }
  console.log(key+' configured for '+target+' ('+type+').');
}
