// 最终：逐页面取实际调用(method+path) -> GET 实测 -> 四档分类
import fs from 'node:fs'; import path from 'node:path';
const W='/home/leyova/apps/web/src', BASE='http://localhost:8788';
const norm=s=>s.split('?')[0].replace(/\$\{[^}]*\}/g,'{dyn}').replace(/\/$/,'');
const canon=s=>{s=norm(s); if(s.startsWith('/api/v1/'))return s; if(s.startsWith('/v1/'))return '/api'+s; if(s.startsWith('/api/'))return '/api/v1'+s.slice(4); return '/api/v1'+s;};
const M={get:'GET',post:'POST',put:'PUT',patch:'PATCH',del:'DELETE',delete:'DELETE'};
// 1. 逐文件提取
const fileCalls=new Map();
const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  if(e.isDirectory()){walk(p);continue;} if(!/\.(tsx|ts)$/.test(e.name))continue;
  const rel=p.replace(W+'/',''); const src=fs.readFileSync(p,'utf8'); const calls=[];
  for(const m of src.matchAll(/api\s*\.\s*(get|post|put|patch|del|delete)\b[^(]{0,400}\(\s*(['"`])([^'"`]+)\2/g)){
    if(!m[3].startsWith('/'))continue; calls.push({method:M[m[1]],path:canon(m[3])});
  }
  for(const m of src.matchAll(/fetch\(\s*['"`](\/api\/v1[^'"`?]*)([\s\S]{0,220}?)\)/g)){
    const opt=m[2]||''; const mm=/method:\s*['"`]([A-Za-z]+)['"`]/.exec(opt);
    calls.push({method:mm?mm[1].toUpperCase():'GET',path:canon(m[1])});
  }
  if(calls.length) fileCalls.set(rel,calls);
}};
walk(W);
// 2. 登录 & GET 探针（带平台店铺 id 与 review 必填参数）
const r0=await fetch(BASE+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'Admin@123456'})});
const cookie='leyova_session='+/leyova_session=([^;]+)/.exec(r0.headers.getSetCookie().join(';'))[1];
const PLAT={kuaishou:'4',taobao:'10',tmall:'13',wechat:'7',douyin:'1',xiaohongshu:'16',omnichannel:'1'};
const resolve=(p)=>{
  let u=p;
  const m=p.match(/^\/api\/v1\/(douyin|kuaishou|taobao|tmall|wechat|xiaohongshu|omnichannel)\/shop\//);
  if(m) u=u.replace('{dyn}',PLAT[m[1]]);
  if(u.includes('/review/')&&!/[?]/.test(u)) u += (u.includes('?')?'&':'?')+'room_id=1&date=2026-11-12';
  if(u.includes('/platforms/{dyn}/')) u=u.replace('{dyn}','douyin');
  if(u.includes('{dyn}')) u=u.replace(/\{dyn\}/g,'1');
  return u;
};
const probe=async(p)=>{try{const c=new AbortController();const t=setTimeout(()=>c.abort(),8000);
  const r=await fetch(BASE+resolve(p),{headers:{cookie,accept:'application/json'},signal:c.signal});clearTimeout(t);
  const txt=await r.text();let j=null;try{j=JSON.parse(txt)}catch{}
  return {status:r.status,body:j,raw:txt.slice(0,140)};}catch(e){return {status:0,body:null,raw:String(e.name)}}};
const isEmpty=b=>{if(b===null||b===undefined)return true;if(Array.isArray(b))return b.length===0;if(typeof b==='object'&&b&&'data'in b){const d=b.data;if(d===null)return true;if(Array.isArray(d))return d.length===0;if(typeof d==='object')return Object.keys(d).length===0;return false;}return false;};
const cache=new Map();
const getProbe=async(p)=>{if(cache.has(p))return cache.get(p);const r=await probe(p);cache.set(p,r);return r;};
// 3. 分类
const pa=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/page_audit.json','utf8'));
const out=[];
for(const pg of pa.rows){
  const f=W+'/'+pg.file; const src=fs.readFileSync(f,'utf8');
  const placeholder=/正在开发|即将上线|敬请期待|建设中/.test(src);
  const calls=fileCalls.get(pg.file)||[];
  const gets=calls.filter(c=>c.method==='GET');
  const writes=calls.filter(c=>c.method!=='GET');
  const results=[];
  for(const g of gets) results.push({...g,res:await getProbe(g.path)});
  const bad=results.filter(r=>r.res.status>=400||r.res.status===0);
  const realBad=bad.filter(r=>r.res.status===404&&r.path.includes('{dyn}')?false:true);
  const empty=results.filter(r=>r.res.status>=200&&r.res.status<300&&isEmpty(r.res.body));
  const isRouter=/lazy\(\s*\(\)\s*=>\s*\n?\s*import\(/.test(src) && /defaultView|TAB|tab/.test(src);
  const isSection=/Section\.tsx$/.test(pg.file);
  let tier,reason;
  if(placeholder){tier='壳';reason='占位文案（正在开发/即将上线）';}
  else if(isSection){tier='子组件';reason='嵌入 SystemConfigPage/RoomsPage，无独立路由';}
  else if(!pg.mounted){tier='壳';reason='未在 App.tsx 挂载（死页/死代码，无入口）';}
  else if(calls.length===0){
    if(isRouter){tier='可用';reason='视图路由页：lazy 渲染其他已挂载页面（与 /standalone 路径重复）';}
    else if(/PlatformInsightPage/.test(pg.file)){tier='半可用';reason='34 行配置驱动通用壳，10 条路由共用，端点均 200 但无专属实现';}
    else {tier='壳';reason=`零接口调用，纯静态/硬编码数据（${pg.loc} 行）`;}
  }
  else if(bad.length){tier='坏';reason=bad.map(b=>`${b.method} ${b.path.replace('/api/v1','')} → ${b.res.status}`).slice(0,2).join('；');}
  else if(empty.length){tier='半可用';reason=`${empty.length}/${results.length} 个 GET 返回空数据`;}
  else if(gets.length===0){tier='半可用';reason='仅写接口（POST/PUT），只读审计无法验证写闭环';}
  else {tier='可用';reason=`${results.length} 个 GET 全部 2xx 且有数据`;}
  out.push({file:pg.file,loc:pg.loc,routes:pg.routes,module:pg.module,gets:gets.length,writes:writes.length,tier,reason,
    detail:results.map(r=>({m:r.method,p:r.path.replace('/api/v1',''),s:r.res.status,empty:r.res.status>=200&&r.res.status<300&&isEmpty(r.res.body)}))});
}
const cnt={};for(const o of out)cnt[o.tier]=(cnt[o.tier]||0)+1;
fs.writeFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/page_classification.json',JSON.stringify({summary:cnt,pages:out},null,1));
console.log(JSON.stringify(cnt),'total',out.length);
for(const t of ['壳','坏','半可用']){console.log('---',t);for(const o of out.filter(x=>x.tier===t))console.log(' ',o.file,o.loc+'行',o.routes[0]||'(无路由)',o.reason);}
