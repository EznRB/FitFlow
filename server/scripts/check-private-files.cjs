'use strict';
// Checks the current checkout against its own local secrets without printing them.
// This complements review; it does not scan Git history or unknown credentials.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../..');
const secrets = new Set();
const directories = [root, path.join(root,'server'),path.join(root,'.vercel')];
for (const directory of directories) {
  if (!fs.existsSync(directory)) continue;
  for (const name of fs.readdirSync(directory)) {
    if (!/^\.env(?:\.|$)/.test(name) || name === '.env.example') continue;
    const file = path.join(directory,name); if (!fs.statSync(file).isFile()) continue;
    const vars = dotenv.parse(fs.readFileSync(file));
    for (const [key,value] of Object.entries(vars)) {
      if (/(?:SECRET|TOKEN|PASSWORD|API_KEY)$/.test(key) && value.length >= 12) secrets.add(value);
      if (/^DATABASE_URL$|^DIRECT_URL$/.test(key)) {
        try { const password = decodeURIComponent(new URL(value).password); if (password.length >= 8) secrets.add(password); } catch {}
      }
    }
  }
}
for (const name of fs.readdirSync(path.join(root,'server')).filter(name=>/^\.demo-credentials.*\.json$/.test(name))) {
  const credentials=JSON.parse(fs.readFileSync(path.join(root,'server',name)));
  for (const account of Object.values(credentials)) if (typeof account.password === 'string' && account.password.length >= 12) secrets.add(account.password);
}
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const findings=[];
for (const file of new Set(files)) {
  const absolute=path.join(root,file); if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  if (/(?:^|\/)\.env(?!\.example$)|\.demo-credentials.*\.json$|(?:^|\/)\.local-db(?:-postgresql)?\//.test(file)) findings.push(file+' (private file)');
  const contents=fs.readFileSync(absolute);
  if ([...secrets].some(secret=>contents.includes(Buffer.from(secret)))) findings.push(file+' (local secret present)');
}
if (findings.length) { console.error('Private material found in publishable files:',...new Set(findings)); process.exitCode=1; }
else console.log('Private-file gate PASS: '+new Set(files).size+' publishable files contain no known local secret or private environment file.');
