// 只读：实测前端实际调用的 GET 端点（含 :id 用真实 id 替换）
import fs from 'node:fs';
const BASE='http://localhost:8788';
const fl=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/frontend_api_paths.json','utf8'));
const probe=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/probe_admin.json','utf8'));
const idmap=probe.idmap||{};
const idmap2={...idmap, sessions:probe.idmap.sessions||'5875', orders:'1', products:'1', shops:'1', users:'7', anchors:'1', plans:'1'};

async function login(){const r=await fetch(BASE+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'Admin@123456'})});
 const sc=r.headers.getSetCookie().join(';'); const m=/leyova_session=([^;]+)/.exec(sc); return `leyova_session=${m[1]}`;}
const cookie=await login();

async function get(p){const t=Date.now();try{const c=new AbortController();const to=setTimeout(()=>c.abort(),8000);
 const r=await fetch(BASE+p,{headers:{cookie,accept:'application/json'},signal:c.signal});clearTimeout(to);
 const txt=await r.text(); let j=null;try{j=JSON.parse(txt)}catch{}
 return {path:p,status:r.status,ms:Date.now()-t,body:j,raw:txt.slice(0,200)};}catch(e){return {path:p,status:0,ms:Date.now()-t,timeout:e.name==='AbortError',raw:String(e.name)}}}

const target=fl.rows.filter(o=>o.method==='GET'||o.method==='?');
const res=[];
for(const o of target){
  if(!o.path.includes(':id')){ const r=await get(o.path); r.meta=o; res.push(r); continue; }
  const seg=o.path.split('/')[3]||'';
  // 平台专属端点：用该平台自己的 shop id（模拟前端 currentShop 解析）
  const PLAT={kuaishou:'4',taobao:'10',tmall:'13',wechat:'7',douyin:'1',xiaohongshu:'16'};
  const m=o.path.match(/^\/api\/v1\/(douyin|kuaishou|taobao|tmall|wechat|xiaohongshu|omnichannel)\//);
  const cands=m?[PLAT[m[1]]||'1']:[...new Set([idmap2[seg],'1','2','5875','4080'].filter(Boolean))];
  let best=null;
  for(const c of cands){
    const r=await get(o.path.split(':id').join(c)); r.meta=o; r.usedId=c;
    if(!best) best=r;
    if(r.status>=200&&r.status<300){best=r;break;}
  }
  res.push(best);
}
const isE=b=>{if(b===null||b===undefined)return true;if(Array.isArray(b))return b.length===0;if(typeof b==='object'&&'data'in b){const d=b.data;if(d===null)return true;if(Array.isArray(d))return d.length===0;if(typeof d==='object')return Object.keys(d).length===0;return false;}return false;};
const sum={tested:res.length,s2:res.filter(r=>r.status>=200&&r.status<300).length,
 s2empty:res.filter(r=>r.status>=200&&r.status<300&&isE(r.body)).length,
 s4:res.filter(r=>r.status>=400&&r.status<500).length,s5:res.filter(r=>r.status>=500).length,
 to:res.filter(r=>r.timeout).length,err:res.filter(r=>r.status===0&&!r.timeout).length};
fs.writeFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/probe_frontend_calls.json',JSON.stringify({at:new Date().toISOString(),sum,res:res.map(r=>({path:r.path,status:r.status,ms:r.ms,usedId:r.usedId,raw:r.raw,file:(r.meta&&r.meta.files||[])[0],empty:r.status>=200&&r.status<300&&isE(r.body)}))},null,1));
console.log(JSON.stringify(sum));
const bad=res.filter(r=>r.status>=400||r.timeout||r.status===0);
console.log('--- FAILED ---');
for(const r of bad) console.log([r.status,r.path,(r.meta&&r.meta.files||[])[0],r.raw.slice(0,110)].join(' | '));
