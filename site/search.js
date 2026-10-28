// Pure search logic (no DOM) so it can be unit-tested with `node --test`.
// Hybrid ranking: weighted keyword match (+ synonyms, + natural-language filters) fused with
// semantic similarity of precomputed vectors. Works in the browser and in Node.
const STOP = new Set('a an the for of to in on and or with how do does i is are was what which that me my show find any can be it its this these those from by as at about'.split(' '));
const SYN = {validate:['validation','evaluate','verification','calibration'],validation:['validate','evaluate','verification'],check:['checklist'],checklist:['reporting','guideline'],share:['archive','sharing','repository','open'],sharing:['archive','repository'],code:['software','archive','repository'],reproducibility:['replication','reproduce','transparency'],replication:['reproducibility'],describe:['description','reporting','document'],document:['describe','reporting'],data:['dataset','provenance'],experiment:['experiments','doe','sensitivity','design'],journal:['publication','policy'],policy:['journal','mandatory'],decision:['decisions','behaviour','agents'],agents:['agent','abm'],simulation:['abm','des','model'],model:['models','simulation'],trial:['clinical','consort'],review:['prisma','moose']};
// field -> [weight, label shown in "matched in"]
const FIELDS = [['short',10,'name'],['name',6,'title'],['fn',4,'function'],['type',4,'type'],['dom',4,'domain'],['other',3,'domain'],['method',3,'method'],['desc',2,'description'],['excl',1.5,'scope limits'],['life',1.5,'lifecycle'],['rel',1,'relationships'],['ref',1,'reference']];
// natural-language phrases -> structured filters
const RULES = [[/\b(mandatory|mandated|required|enforced|binding|compulsory)\b/,'b','Required','binding: required'],[/\b(voluntary)\b/,'b','Voluntary','binding: voluntary'],[/\b(machine[- ]readable|schema|json|yaml)\b/,'m','!No','machine-readable'],[/\b(health|clinical|medical)\b/,'dom','health','domain: health'],[/\b(verified)\b/,'v','Verified','verified only'],[/\b(llm|genai|generative)\b/,'ai','1','GenAI-related']];

// --- must stay identical to stem/tokenize/doc_text in scripts/build.py ---
function stem(w){ if(w.length>4&&w.endsWith('ies')) return w.slice(0,-3)+'y'; if(w.length>3&&w.endsWith('s')&&!w.endsWith('ss')) return w.slice(0,-1); return w; }
function tokenize(text, stop){ return (text.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>1&&!stop.has(w)).map(stem); }
function docText(r){ return [r.short,r.name,r.desc,r.type,r.fn,r.dom,r.other,r.method,r.excl].join(' '); }

function prepare(records){ records.forEach(r=>{ r._f={}; FIELDS.forEach(([k])=>r._f[k]=String(r[k]||'').toLowerCase()); }); return records; }

// Project a query into the LSA concept space (same maths as the build: tf-idf, L2-normalise, multiply by V).
function embedLSA(text, meta){
  const stop=new Set(meta.stop), cnt={};
  tokenize(text,stop).forEach(t=>{ if(meta.terms[t]) cnt[t]=(cnt[t]||0)+1; });
  const k=meta.k, v=new Array(k).fill(0), xs=[]; let n=0;
  for(const t in cnt){ const e=meta.terms[t], x=(1+Math.log(cnt[t]))*e[0]; xs.push([x,e]); n+=x*x; }
  if(!n) return null; n=Math.sqrt(n);
  for(const [x,e] of xs) for(let j=0;j<k;j++) v[j]+=x/n*e[j+1];
  const m=Math.sqrt(v.reduce((a,b)=>a+b*b,0)); return m?v.map(a=>a/m):null;
}
function cosine(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }

function parse(q){
  let t=q.toLowerCase(); const f=[];
  RULES.forEach(([re,k,v,l])=>{ if(re.test(t)){ f.push({k,v,l}); t=t.replace(re,' '); } });
  return {f, terms:t.split(/[^a-z0-9+]+/).filter(w=>w.length>1&&!STOP.has(w))};
}
function pass(r,x){
  return x.f.every(({k,v})=> k==='b'?r.b===v : k==='m'?r.m!=='No' : k==='dom'?(r.dom+' '+r.other).toLowerCase().includes(v) : k==='v'?r.v==='Verified' : r.genai.indexOf('Pre-dates')!==0);
}
function kwScore(r,terms){
  let s=0, all=true; const hit=new Set();
  for(const t of terms){
    let best=0;
    for(const [w,wt] of [[t,1],...(SYN[t]||[]).map(x=>[x,.6])]){
      const re=new RegExp('\\b'+w.replace(/[+]/g,'\\+'));
      for(const [k,fw,lab] of FIELDS) if(re.test(r._f[k])){ best=Math.max(best,fw*wt); hit.add(lab); }
    }
    if(!best) all=false; s+=best;
  }
  return {s, all, hit:[...hit]};
}

// rank(query, records, {meta, qvec, filter}) -> {x, relaxed, results:[{r, s, hit, via}]}
function rank(q, records, o={}){
  const meta=o.meta||{}, x=parse(q);
  const rows=records.filter(r=>pass(r,x)&&(!o.filter||o.filter(r)));
  if(!x.terms.length) return {x, relaxed:false, results:rows.map(r=>({r,s:0,hit:[],via:''}))};
  let qv=o.qvec||null;
  if(!qv&&meta.backend==='lsa') qv=embedLSA(x.terms.join(' '),meta);
  const kw=rows.map(r=>({r,...kwScore(r,x.terms)}));
  const sem=rows.map(r=>qv&&r.vec?Math.max(0,cosine(qv,r.vec)):0);
  const maxK=Math.max(1e-9,...kw.map(k=>k.s)), maxS=Math.max(1e-9,...sem), min=meta.semMin||0.4;
  let res=[];
  kw.forEach((k,i)=>{
    const sc=sem[i], semOk=sc>=min&&sc>=0.75*maxS;
    if(k.all||semOk) res.push({r:k.r, hit:k.hit, s:.65*(k.s/maxK)*(k.all?1:.5)+.35*(sc/maxS), via:k.all?(semOk?'keyword + semantic':'keyword'):'semantic'});
  });
  let relaxed=false;
  if(!res.length){ relaxed=true; res=kw.filter(k=>k.s>0).map(k=>({r:k.r,hit:k.hit,s:k.s/maxK,via:'partial keyword'})); }
  res.sort((a,b)=>b.s-a.s||b.r.cn-a.r.cn);
  return {x, relaxed, results:res};
}
if(typeof module!=='undefined') module.exports={stem,tokenize,docText,prepare,embedLSA,cosine,parse,rank};
