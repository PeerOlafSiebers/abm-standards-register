// Renders the "Which standard should I use?" tab from data/guidance.json. Needs globals BY and esc.
function renderHelp(g){
  if(!g) return '<p>No guidance data.</p>';
  const pick=([id,why])=>{ const r=BY[id]; return r?`<div class="pk"><button class="lk" data-id="${id}">${esc(r.short)}</button><span class="bd ${r.b}">${r.b}</span><span class="why">${esc(why||'')}</span></div>`:''; };
  const group=(label,picks)=>picks.length?`<div class="gl">${label}</div>${picks.map(p=>pick(p)).join('')}`:'';
  const nav=[['hs-rules','Rules of thumb'],['hs-sit','By situation'],['hs-task','By task'],['hs-ex','Worked examples'],['hs-read','Reading a card']];
  const legend=[['Required','Many venues expect or mandate it. Check your target journal, funder or regulator.'],['Voluntary','Good practice; nobody enforces it.'],['Encouraged','Venues encourage it but do not enforce it.'],['Verified','Source details independently checked.'],['Unverified','Carried over or added without a check. Confirm before citing.'],['Yes','Machine-readable: tools can validate or process it. “Partial” means some parts can be.']];
  return `<div class="hn">${nav.map(([i,t])=>`<button class="chip" data-go="${i}">${t}</button>`).join('')}</div>
<p class="lead">Not sure what to pick? Find your situation, start with the first suggestion, then add only what you need. Click any name to open its card.</p>
<section class="hs" id="hs-rules"><h2>Rules of thumb</h2><ol class="rl">${g.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ol></section>
<section class="hs" id="hs-sit"><h2>By situation</h2><div class="gg">${g.situations.map(s=>`<div class="gc"><h3><span>${s.icon}</span> ${esc(s.title)}</h3>${group('Start with',s.start)}${group('Then add',s.add||[])}${s.note?`<p class="mt">${esc(s.note)}</p>`:''}</div>`).join('')}</div></section>
<section class="hs" id="hs-task"><h2>By task</h2><div class="gg">${g.tasks.map(t=>`<div class="gc"><h3>${esc(t.title)}</h3><p class="mt">${esc(t.ask)}</p>${t.picks.map(p=>pick(p)).join('')}</div>`).join('')}</div></section>
<section class="hs" id="hs-ex"><h2>Worked examples</h2><div class="gg">${g.examples.map(e=>`<div class="gc ex"><h3>${esc(e.title)}</h3><p class="mt">${esc(e.story)}</p><ol class="tl">${e.steps.map(s=>`<li><b>${esc(s.when)}</b>${s.picks.map(p=>pick(p)).join('')}</li>`).join('')}</ol></div>`).join('')}</div></section>
<section class="hs" id="hs-read"><h2>Reading a card</h2><div class="gc"><dl class="lg">${legend.map(([b,t])=>`<dt><span class="bd ${b}">${b==='Yes'?'machine-readable':b}</span></dt><dd>${esc(t)}</dd>`).join('')}</dl></div></section>`;
}
