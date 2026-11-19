// 提取前端 api.* 调用的 (method, endpoint) 对，按 services/api.ts buildUrl 归一化为 /api/v1/...
import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/leyova/apps/web/src';
const files=[]; (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory())walk(p); else if(/\.(ts|tsx)$/.test(e.name))files.push(p);}})(ROOT);
const norm=s=>s.split('?')[0].replace(/\$\{[^}]*\}/g,':id').replace(/\{[^}]*\}/g,':id').replace(/\/$/,'');
const canon=s=>{ s=norm(s); if(s.startsWith('/api/v1/'))return s; if(s.startsWith('/v1/'))return '/api'+s; if(s.startsWith('/api/'))return '/api/v1'+s.slice(4); return '/api/v1'+s; };
const M={get:'GET',post:'POST',put:'PUT',patch:'PATCH',del:'DELETE',delete:'DELETE'};
const rows=new Map();
for(const f of files){
  const src=fs.readFileSync(f,'utf8'); const rel=f.replace('/home/leyova/apps/web/src/','');
  for(const m of src.matchAll(/api\.(get|post|put|patch|del|delete)\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\2/g)){
    let p=m[3]; if(!p.startsWith('/')) continue;
    const key=M[m[1]]+' '+canon(p);
    if(!rows.has(key)) rows.set(key,new Set()); rows.get(key).add(rel);
  }
  for(const m of src.matchAll(/['"`](\/api\/v1\/[^'"`\s]*)['"`]/g)){
    const key='? '+canon(m[1]);
    if(!rows.has(key)) rows.set(key,new Set()); rows.get(key).add(rel);
  }
}
const spec=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/openapi.json','utf8'));
const specSet=new Set(Object.keys(spec.paths).map(p=>p.replace(/\{[^}]+\}/g,':id')));
const out=[...rows.entries()].map(([k,v])=>{const [m,p]=k.split(' ');return {method:m,path:p,files:[...v].slice(0,3),inOpenapi:specSet.has(p)};}).sort((a,b)=>a.path.localeCompare(b.path));
fs.writeFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/frontend_api_paths.json',JSON.stringify({total:out.length,notInOpenapi:out.filter(o=>!o.inOpenapi).length,rows:out},null,1));
console.log('pairs:',out.length);
console.log('methods:',JSON.stringify(out.reduce((a,o)=>(a[o.method]=(a[o.method]||0)+1,a),{})));
console.log('--- NOT IN OPENAPI ---');
for(const o of out.filter(o=>!o.inOpenapi)) console.log(o.method,o.path,o.files[0]);
