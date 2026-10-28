// Run: python scripts/build.py && node --test tests/*.test.js   (Node >= 18, no dependencies)
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const S = require('../site/search.js');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(process.env.DIST || path.join(root, 'dist'), 'data/standards.json'), 'utf8'));
const D = S.prepare(data.records), meta = data.meta;
const ids = (q, n = 99) => S.rank(q, D, { meta }).results.slice(0, n).map(o => o.r.id);

test('JS query embedding matches the vectors Python stored (build/browser parity)', () => {
  assert.equal(meta.backend, 'lsa');
  for (const r of D) assert.ok(S.cosine(S.embedLSA(S.docText(r), meta), r.vec) > 0.99, r.id);
});
test('"ODD" surfaces the ODD (2020) standard near the top', () => assert.ok(ids('ODD', 6).includes('SR-003')));
test('natural language filters: "mandatory checklist for health"', () => {
  const res = S.rank('mandatory checklist for health', D, { meta }).results;
  assert.ok(res.length >= 8);
  assert.ok(res.every(o => o.r.b === 'Required' && (o.r.dom + o.r.other).toLowerCase().includes('health')));
  assert.ok(res.some(o => o.r.id === 'SR-082'));                          // CONSORT
});
test('"machine-readable schema" returns only machine-readable entries', () => {
  const res = S.rank('machine-readable schema', D, { meta }).results;
  assert.ok(res.every(o => o.r.m !== 'No'));
  assert.ok(['SR-065', 'SR-057'].every(i => res.some(o => o.r.id === i)));
});
test('synonym expansion: "validation" finds the V&V framework first', () => assert.ok(ids('validation', 3).includes('SR-024')));
test('semantic: "how do agents make decisions" finds ODD+D', () => assert.ok(ids('how do agents make decisions', 5).includes('SR-004')));
test('semantic: "publishing rules for journals" finds TOP and AEA', () => {
  const r = ids('publishing rules for journals'); assert.ok(r.includes('SR-073') && r.includes('SR-075'));
});
test('nonsense query returns nothing', () => assert.equal(ids('zzzqqq').length, 0));
test('KNOWN WEAKNESS: paraphrase query should reach reproducibility standards (needs neural vectors)',
  { todo: 'LSA over 66 short docs is too weak; expected to pass with --backend minilm' }, () => {
    const r = ids('prove my results can be reproduced by others', 8);
    assert.ok(['SR-071', 'SR-072', 'SR-073', 'SR-075'].some(i => r.includes(i)));
  });

test('every card renders cleanly (no undefined/NaN/broken links)', () => {
  const ctx = vm.createContext({ D, BY: Object.fromEntries(D.map(r => [r.id, r])) });
  const card = vm.runInContext(fs.readFileSync(path.join(root, 'site/card.js'), 'utf8') + ';card', ctx);
  for (const r of D) {
    const h = card(r);
    assert.ok(h.includes(r.id), r.id);
    assert.ok(!/undefined|NaN|\[object|href="n\/a/.test(h), `${r.id} has a rendering glitch`);
    if (!r.url) assert.ok(!h.includes('Canonical resource'), `${r.id} shows a link it does not have`);
  }
});

test('help tab renders every guidance pick (none silently dropped, nothing broken)', () => {
  const ctx = vm.createContext({ BY: Object.fromEntries(D.map(r => [r.id, r])) });
  vm.runInContext(fs.readFileSync(path.join(root, 'site/card.js'), 'utf8'), ctx);
  const render = vm.runInContext(fs.readFileSync(path.join(root, 'site/help.js'), 'utf8') + ';renderHelp', ctx);
  const g = data.guidance, html = render(g);
  const picks = JSON.stringify(g).match(/\["SR-\d{3}"/g).length;
  assert.equal((html.match(/class="lk" data-id=/g) || []).length, picks);
  assert.ok(!/undefined|NaN|\[object/.test(html));
});
