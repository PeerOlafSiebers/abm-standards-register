// UI wiring. Globals D and BY are also read by card.js.
let D=[], BY={}, META={}, qvecFn=null, runId=0;
const $ = s => document.querySelector(s);
const FS = {dom:'Domain', fn:'Function', b:'Binding', m:'Machine-readable', v:'Verification'};
const fv = {};
const EXAMPLES = ['mandatory checklist for health','machine-readable schema','validate an agent-based model','share code and data','prove my results can be reproduced','describe agent decision making'];

function buildFilters(){
  let h='';
  for(const k in FS){ const vals=[...new Set(D.map(r=>r[k]))].sort(); h+=`<select data-k="${k}"><option value="">${FS[k]}: any</option>${vals.map(v=>`<option>${esc(v)}</option>`).join('')}</select>`; }
  h+='<select id="so"><option value="r">Sort: relevance</option><option value="y">Newest first</option><option value="c">Most cited</option><option value="i">ID</option></select>';
  $('#fl').innerHTML=h;
  $('#fl').onchange=e=>{ if(e.target.dataset.k) fv[e.target.dataset.k]=e.target.value; run(); };
}

async function run(){
  const id=++runId, q=$('#q').value.trim(); let qvec=null;
  if(qvecFn&&q){ try{ qvec=await qvecFn(q); }catch(e){} }
  if(id!==runId) return;                                   // a newer keystroke superseded this run
  const {x,relaxed,results}=rank(q,D,{meta:META,qvec,filter:r=>Object.entries(fv).every(([k,v])=>!v||r[k]===v)});
  const cmp={y:(a,b)=>b.r.year-a.r.year, c:(a,b)=>b.r.cn-a.r.cn, i:(a,b)=>a.r.id.localeCompare(b.r.id)}[$('#so').value];
  if(cmp) results.sort(cmp); else if(!x.terms.length) results.sort((a,b)=>b.r.cn-a.r.cn);
  const und=[...x.f.map(f=>f.l), ...x.terms.map(t=>'“'+t+'”'+(SYN[t]?' (+'+SYN[t].slice(0,3).join(', ')+')':''))];
  $('#info').innerHTML=`<b>${results.length}</b> of ${D.length} standards`+(und.length?` · understood as ${und.map(u=>`<span class="u">${esc(u)}</span>`).join('')}`:'')+(relaxed&&results.length?' · no exact match for every word, showing partial matches':'');
  $('#g').innerHTML=results.map(({r,hit,via})=>`<button class="c" data-id="${r.id}"><span class="id">${r.id}</span><h3>${esc(r.short)}</h3><div class="fn">${esc(r.name)}</div><div><span class="bd dom">${esc(r.dom)}</span><span class="bd">${esc(r.fn)}</span><span class="bd ${r.b}">${r.b}</span>${r.m!=='No'?`<span class="bd ${r.m}">machine-readable: ${r.m}</span>`:''}</div>${q&&via?`<div class="via">${via==='semantic'?'semantic match · related meaning, not the same words':'matched in: '+esc(hit.slice(0,4).join(', '))+(via==='keyword + semantic'?' · + semantic':'')}</div>`:''}<div class="ft"><span>${r.year}</span><span>${esc(r.cites||'–')} citations</span><span class="bd ${r.v}">${r.v}</span></div></button>`).join('')||'<p>No matches. Try fewer words or clear the filters.</p>';
}

function openCard(id){
  $('#dc').innerHTML=card(BY[id]); $('#dlg').showModal(); $('#dlg').scrollTop=0;
  try{ history.replaceState(null,'','#'+id); }catch(e){}
}

// Optional neural query embeddings (only when the build used --backend minilm). Needs network access to the
// jsDelivr CDN and Hugging Face hub, so it works on GitHub Pages; falls back to keyword-only if unavailable.
async function loadMiniLM(){
  try{
    const {pipeline}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    const ex=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2');
    qvecFn=async q=>Array.from((await ex(q,{pooling:'mean',normalize:true})).data);
    $('#mode').textContent='keyword + semantic (MiniLM)'; run();
  }catch(e){ console.warn('semantic model unavailable; keyword only',e); $('#mode').textContent='keyword only (model failed to load)'; }
}

function setTheme(t){
  document.documentElement.dataset.theme=t;
  document.querySelectorAll('[data-th]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.th===t));
  try{ localStorage.setItem('abm-theme',t); }catch(e){}
}

async function init(){
  let saved='beige'; try{ saved=localStorage.getItem('abm-theme')||'beige'; }catch(e){}
  setTheme(saved);
  const data=window.__DATA__||await (await fetch('data/standards.json')).json();
  META=data.meta; D=prepare(data.records); BY=Object.fromEntries(D.map(r=>[r.id,r]));
  $('#n').textContent=D.length;
  $('#mode').textContent={lsa:'keyword + semantic (LSA)',minilm:'keyword (loading semantic model…)',none:'keyword only'}[META.backend]||'keyword';
  $('#ex').innerHTML=EXAMPLES.map(s=>`<button>${s}</button>`).join('');
  $('#ex').onclick=e=>{ if(e.target.tagName==='BUTTON'){ $('#q').value=e.target.textContent; run(); } };
  $('#q').oninput=run; buildFilters(); run();
  $('#h').innerHTML=renderHelp(data.guidance);
  const h=location.hash.slice(1); if(BY[h]) openCard(h);
  if(META.backend==='minilm') loadMiniLM();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-id]'); if(b) openCard(b.dataset.id);
  const t=e.target.closest('.tab');
  if(t){ document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===t)); ['b','h'].forEach(k=>$('#'+k).hidden=t.dataset.t!==k); }
  const g=e.target.closest('[data-go]'); if(g) document.getElementById(g.dataset.go).scrollIntoView({behavior:'smooth'});
  const th=e.target.closest('[data-th]'); if(th) setTheme(th.dataset.th);
});
$('#cl').onclick=()=>$('#dlg').close();
$('#dlg').addEventListener('click',e=>{ if(e.target===$('#dlg')) $('#dlg').close(); });
init();
