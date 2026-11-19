// 页面/路由/挂载关系审计（只读静态分析）
import fs from 'node:fs'; import path from 'node:path';
const W='/home/leyova/apps/web/src';
const app=fs.readFileSync(W+'/App.tsx','utf8');
const imported=new Set();
for(const m of app.matchAll(/import\(\s*['"](@\/pages\/[^'"]+)['"]\s*\)/g)) imported.add(m[1].replace('@/',''));
for(const m of app.matchAll(/from\s+['"](@\/pages\/[^'"]+)['"]/g)) imported.add(m[1].replace('@/',''));
// 路由表: <Route path="..." element={...<Comp/>...} />
const routes=[];
for(const m of app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g)){
  const body=m[2];
  const comps=[...body.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map(x=>x[1]);
  const mod=(body.match(/module="([^"]+)"/)||[])[1]||null;
  routes.push({path:m[1],comps,module:mod});
}
const files=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(e.name.endsWith('.tsx'))files.push(p);}})(W+'/pages');
const isShell=f=>{
  const src=fs.readFileSync(f,'utf8'); const loc=src.split('\n').length;
  const hasApi=/api\.(get|post|put|patch|del)|services\/api/.test(src);
  const isWrapper=/<([A-Z][A-Za-z0-9]*)\s*\/>/.test(src) && loc<40;
  return {loc,hasApi,isWrapper};
};
const rows=[];
for(const f of files.sort()){
  const rel=f.replace(W+'/','');
  const spec=rel.replace(/\.tsx$/,'');
  const {loc,hasApi,isWrapper}=isShell(f);
  const mounted=imported.has(spec);
  const rts=routes.filter(r=>r.comps.some(c=>spec.endsWith(c)));
  rows.push({file:rel,loc,hasApi,isWrapper,mounted,routes:rts.map(r=>r.path),module:(rts[0]&&rts[0].module)||null});
}
fs.writeFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/page_audit.json',JSON.stringify({
  pages:rows.length,routes:routes.length,imported:imported.size,
  notMounted:rows.filter(r=>!r.mounted),
  shell:rows.filter(r=>r.isWrapper||r.loc<40),
  noApi:rows.filter(r=>!r.hasApi&&!r.isWrapper&&r.loc>=40),
  rows},null,1));
console.log('pages',rows.length,'routes',routes.length,'imported',imported.size);
console.log('NOT MOUNTED:',rows.filter(r=>!r.mounted).map(r=>r.file+'('+r.loc+')').join(', ')||'none');
console.log('SHELL(<40行且仅包组件):',rows.filter(r=>r.isWrapper||r.loc<40).map(r=>r.file+'('+r.loc+')').join(', ')||'none');
console.log('NO-API(>40行但无接口调用):',rows.filter(r=>!r.hasApi&&!r.isWrapper&&r.loc>=40).map(r=>r.file+'('+r.loc+')').join(', ')||'none');
console.log('MULTI-ROUTE pages:',rows.filter(r=>r.routes.length>1).map(r=>r.file+'→'+r.routes.length).join(', '));
