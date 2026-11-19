// 交叉核对：前端调用端点 vs 后端源码注册路由（app.get/post/... 静态字符串）
import fs from 'node:fs'; import path from 'node:path';
const A='/home/leyova/apps/api/src';
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.name.endsWith('.ts'))files.push(p);}})(A);
const reg=[];
for(const f of files){const src=fs.readFileSync(f,'utf8');
  for(const m of src.matchAll(/app\.(get|post|put|patch|delete)\s*<?[^(]*\(\s*['"`](\/api\/v1[^'"`]*)['"`]/g)){
    reg.push({method:m[1].toUpperCase(),path:m[2].replace(/\/$/,''),file:f.replace(A+'/','')});
  }
}
const key=(m,p)=>m+' '+p.replace(/:[A-Za-z_]+/g,'*');
const regSet=new Set(reg.map(r=>key(r.method,r.path)));
// 前端调用
const fe=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/frontend_api_paths.json','utf8'));
const out={registered:reg.length,frontend:fe.rows.length,dead:[],dynamic:[]};
for(const r of fe.rows){
  if(r.method==='?') { out.dynamic.push(r); continue; }
  const k=key(r.method,r.path);
  if(regSet.has(k)) continue;
  // 允许 :id 对应任意参数名
  const alt=[...regSet].some(s=>s.split(' ')[0]===r.method && s.split(' ')[1].replace(/\*/g,'X')===r.path.replace(/:id/g,'X'));
  if(!alt) out.dead.push(r);
}
fs.writeFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/route_crosscheck.json',JSON.stringify({...out,allRegistered:reg},null,1));
console.log('backend registered routes:',reg.length,'frontend calls:',fe.rows.length);
console.log('DEAD (前端调用但后端无此路由):',out.dead.length);
for(const d of out.dead) console.log('  ',d.method,d.path,'<-',d.files.join(','));
console.log('METHOD-UNKNOWN:',out.dynamic.length);
