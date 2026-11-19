// 96 页面四档分类：可用 / 半可用 / 壳 / 坏
import fs from 'node:fs'; import path from 'node:path';
const W='/home/leyova/apps/web/src';
const pageAudit=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/page_audit.json','utf8'));
const feCalls=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/probe_frontend_calls.json','utf8'));
const statusByFile=new Map();
for(const r of feCalls.res){ if(!r.file) continue; const arr=statusByFile.get(r.file)||[]; arr.push(r); statusByFile.set(r.file,arr); }
const feRows=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/frontend_api_paths.json','utf8')).rows;
const pathsByFile=new Map();
for(const r of feRows){ for(const f of r.files||[]){} }
// 逐文件统计 api 调用数
const apiCount=new Map();
const walkAll=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory()){walkAll(p);continue;}
  if(!/\.(tsx|ts)$/.test(e.name))continue;
  const rel=p.replace(W+'/',''); const src=fs.readFileSync(p,'utf8');
  const n=[...src.matchAll(/api\.(get|post|put|patch|del|delete)\s*[<(]/g)].length + [...src.matchAll(/fetch\(\s*['"`]\/api/g)].length;
  apiCount.set(rel,n);
}};
walkAll(W);

const out=[];
for(const p of pageAudit.rows){
  const f=W+'/'+p.file; const src=fs.readFileSync(f,'utf8');
  const placeholder=/正在开发|即将上线|敬请期待|TODO|占位页|建设中/.test(src);
  const napi=apiCount.get(p.file)||0;
  const calls=(statusByFile.get(p.file)||[]);
  const bad=calls.filter(c=>c.status>=400||c.status===0);
  const empty=calls.filter(c=>c.empty);
  let tier,reason;
  if(p.loc<40||placeholder){ tier='壳'; reason=placeholder?'占位文案(正在开发/即将上线)':'<40 行，仅转发/包装'; }
  else if(!p.mounted){ tier='壳'; reason='未在 App.tsx 挂载（死页）'; }
  else if(napi===0){ tier='壳'; reason='无任何接口调用，纯静态/壳'; }
  else if(bad.length){ tier='坏'; reason=`${bad.length} 个接口 4xx/404: ${bad.map(b=>b.path.split('/api/v1')[1]+'['+b.status+']').slice(0,3).join(', ')}`; }
  else if(empty.length){ tier='半可用'; reason=`${empty.length} 个接口返回空数据`; }
  else { tier='可用'; reason=`${calls.filter(c=>c.status>=200&&c.status<300).length} 个接口 2xx 有数据`; }
  out.push({file:p.file,loc:p.loc,routes:p.routes,module:p.module,napi,tier,reason});
}
const cnt={}; for(const o of out) cnt[o.tier]=(cnt[o.tier]||0)+1;
fs.writeFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/page_classification.json',JSON.stringify({summary:cnt,pages:out},null,1));
console.log(JSON.stringify(cnt));
for(const t of ['壳','坏','半可用']) { console.log('---',t); for(const o of out.filter(x=>x.tier===t)) console.log(' ',o.file,o.loc+'行',o.routes[0]||'-',o.reason); }
