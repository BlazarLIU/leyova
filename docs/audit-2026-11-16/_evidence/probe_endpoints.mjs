// 只读端点探测：登录 -> 遍历 OpenAPI 全部 GET -> 记录状态/耗时/空数据
// 用法: node probe_endpoints.mjs <username> <outfile>
import fs from 'node:fs';
const BASE='http://localhost:8788';
const user=process.argv[2]||'admin';
const OUT=process.argv[3]||`/home/leyova/docs/audit-2026-11-16/_evidence/probe_${user}.json`;
const spec=JSON.parse(fs.readFileSync('/home/leyova/docs/audit-2026-11-16/_evidence/openapi.json','utf8'));

async function login(u){const r=await fetch(BASE+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:u,password:'Admin@123456'})});
 const j=await r.json().catch(()=>null); const sc=r.headers.getSetCookie?r.headers.getSetCookie():[];
 const m=/leyova_session=([^;]+)/.exec(sc.join(';')); return {status:r.status,body:j,cookie:m?`leyova_session=${m[1]}`:null};}

const auth=await login(user);
if(!auth.cookie){console.error('LOGIN FAILED',auth.status,JSON.stringify(auth.body));process.exit(2);}

const CODE={'{code}':['douyin','kuaishou','taobao','wechat','xiaohongshu','tmall','xhs'],
 '{channel}':['douyin','kuaishou','taobao','wechat','xhs'],
 '{platform}':['douyin','kuaishou','taobao','wechat','xhs'],
 '{conversationId}':['1'],'{sessionId}':['1'],'{orderId}':['1']};

function* variants(path){ // 生成参数取值组合
  const names=[...new Set(path.match(/\{[^}]+\}/g)||[])];
  if(!names.length){yield path;return;}
  const cand=names.map(n=>CODE[n]||['1','999999']);
  // 笛卡尔积（限 228 组合内）
  let acc=[path];
  for(let i=0;i<names.length;i++){
    const next=[];
    for(const p of acc) for(const v of cand[i]) next.push(p.replace(names[i],v));
    acc=next.slice(0,32);
  }
  yield* acc;
}

async function req(path,ms=8000){
  const t=Date.now();
  try{
    const c=new AbortController(); const to=setTimeout(()=>c.abort(),ms);
    const r=await fetch(BASE+path,{headers:{cookie:auth.cookie,accept:'application/json'},signal:c.signal});
    clearTimeout(to);
    const txt=await r.text(); const dt=Date.now()-t;
    let j=null; try{j=JSON.parse(txt);}catch{}
    return {path,status:r.status,ms:dt,bytes:txt.length,body:j,raw:txt.slice(0,300),timeout:false};
  }catch(e){return {path,status:0,ms:Date.now()-t,bytes:0,body:null,raw:String(e.name||e).slice(0,120),timeout:e.name==='AbortError'};}
}

function isEmpty(b){
  if(b===null||b===undefined) return true;
  if(Array.isArray(b)) return b.length===0;
  if(typeof b!=='object') return false;
  if('data' in b){
    const d=b.data;
    if(d===null||d===undefined) return true;
    if(Array.isArray(d)) return d.length===0;
    if(typeof d==='object') return Object.keys(d).length===0;
    return false;
  }
  return Object.keys(b).length===0;
}

// 收集 GET 操作
const ops=[];
for(const [p,ms] of Object.entries(spec.paths)) for(const [m,o] of Object.entries(ms)){
  if(m!=='get') continue; ops.push({path:p,op:o});
}
ops.sort((a,b)=>a.path.localeCompare(b.path));

const results=[]; const idmap={};
for(const o of ops){
  let best=null;
  for(const v of variants(o.path)){
    const r=await req(v);
    r.tpl=o.path;
    if(!best) best=r;
    // 认为"成功"就停止尝试
    if(r.status>=200&&r.status<300&&!isEmpty(r.body)){best=r;break;}
    if(r.status>=200&&r.status<300){best=r;} // 2xx 空数据也保留，但继续找有数据的
    if(r.status===401||r.status===403){break;}
  }
  results.push(best);
  // 从列表结果里收割 id，供后续 {id} 端点使用
  const pre=o.path.split('/')[3]||'';
  const b=best&&best.body;
  const arr=b&&b.data&&(Array.isArray(b.data)?b.data:(Array.isArray(b.data.items)?b.data.items:(Array.isArray(b.data.list)?b.data.list:null)));
  if(pre&&arr&&arr.length&&arr[0]&&typeof arr[0]==='object'&&'id' in arr[0]) idmap[pre]=String(arr[0].id);
}

// 第二轮：路径参数端点用收割到的真实 id 重试
const pass2=[];
for(const r of results){
  if(!/\{[^}]+\}/.test(r.tpl)) continue;
  if(r.status>=200&&r.status<300&&!isEmpty(r.body)) continue;
  const pre=r.tpl.split('/')[3]||'';
  const real=idmap[pre];
  if(!real) continue;
  const np=r.tpl.replace('{id}',real).replace('{sessionId}',idmap['sessions']||real).replace('{orderId}',idmap['orders']||real).replace('{conversationId}',real);
  if(np===r.path) continue;
  const rr=await req(np); rr.tpl=r.tpl; rr.retryWith=real;
  if(rr.status>=200&&rr.status<300){results[results.indexOf(r)]=rr;pass2.push(rr);}
}

const summary={user,at:new Date().toISOString(),total:results.length,
 s2:results.filter(r=>r.status>=200&&r.status<300).length,
 s2empty:results.filter(r=>r.status>=200&&r.status<300&&isEmpty(r.body)).length,
 s4:results.filter(r=>r.status>=400&&r.status<500).length,
 s5:results.filter(r=>r.status>=500).length,
 to:results.filter(r=>r.timeout).length,
 err:results.filter(r=>r.status===0&&!r.timeout).length};
fs.writeFileSync(OUT,JSON.stringify({summary,idmap,results},null,1));
console.log(JSON.stringify(summary));
console.log('idmap',JSON.stringify(idmap));
