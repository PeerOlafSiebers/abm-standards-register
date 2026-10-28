"""Build the static site: data/register.csv -> dist/ (JSON + search vectors + per-entry stub pages).
Usage:
  python scripts/build.py                          # -> dist/  (LSA vectors, no network needed)
  python scripts/build.py --backend minilm         # neural vectors (needs requirements-minilm.txt)
  python scripts/build.py --single-file out.html   # also write one self-contained HTML file
"""
import argparse, datetime, html, json, math, re, shutil, sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from common import DATA, GUIDANCE, ROOT, read_rows, to_record

SITE = ROOT / 'site'
STOP = ['the', 'of', 'and', 'a', 'an', 'in', 'to', 'for', 'with', 'on', 'by', 'is', 'are', 'as', 'at', 'or',
        'that', 'this', 'it', 'be', 'from', 'not', 'its', 'their', 'which', 'can', 'such', 'these', 'where',
        'how', 'into', 'than', 'also', 'does', 'do', 'what']


# --- text processing: MUST stay identical to tokenize/stem/docText in site/search.js ---
def stem(w):
    if len(w) > 4 and w.endswith('ies'): return w[:-3] + 'y'
    if len(w) > 3 and w.endswith('s') and not w.endswith('ss'): return w[:-1]
    return w


def tokenize(text):
    return [stem(w) for w in re.findall(r'[a-z0-9]+', text.lower()) if len(w) > 1 and w not in STOP]


def doc_text(r):
    return ' '.join(r[k] for k in ('short', 'name', 'desc', 'type', 'fn', 'dom', 'other', 'method', 'excl'))


def lsa(records, k=24):
    """Latent semantic analysis: TF-IDF -> truncated SVD. Offline, deterministic, dependency: numpy."""
    import numpy as np
    docs = [tokenize(doc_text(r)) for r in records]
    n = len(docs)
    df = Counter(t for d in docs for t in set(d))
    vocab = sorted(t for t, c in df.items() if c >= 2)
    idx = {t: i for i, t in enumerate(vocab)}
    idf = np.array([math.log((1 + n) / (1 + df[t])) + 1 for t in vocab])
    X = np.zeros((n, len(vocab)))
    for i, d in enumerate(docs):
        for t, c in Counter(d).items():
            if t in idx: X[i, idx[t]] = (1 + math.log(c)) * idf[idx[t]]
    X /= np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-9)
    k = min(k, n - 1)
    V = np.linalg.svd(X, full_matrices=False)[2][:k].T          # (vocab, k)
    D = X @ V
    D /= np.maximum(np.linalg.norm(D, axis=1, keepdims=True), 1e-9)
    terms = {t: [round(float(idf[i]), 4)] + [round(float(x), 4) for x in V[i]] for t, i in idx.items()}
    meta = {'backend': 'lsa', 'k': k, 'stop': STOP, 'terms': terms, 'semMin': 0.4}
    return meta, [[round(float(x), 4) for x in row] for row in D]


def minilm(records):
    from sentence_transformers import SentenceTransformer  # pip install -r requirements-minilm.txt
    name = 'sentence-transformers/all-MiniLM-L6-v2'
    V = SentenceTransformer(name).encode([doc_text(r) for r in records], normalize_embeddings=True)
    meta = {'backend': 'minilm', 'model': name, 'k': int(V.shape[1]), 'semMin': 0.35}
    return meta, [[round(float(x), 4) for x in row] for row in V]


def stub(r):
    t, d = html.escape(r['short'] + ' – ABM Standards Register'), html.escape(r['desc'][:300], quote=True)
    return (f'<!doctype html><meta charset="utf-8"><title>{t}</title><meta name="description" content="{d}">'
            f'<meta http-equiv="refresh" content="0;url=../../#{r["id"]}">'
            f'<p>Redirecting to <a href="../../#{r["id"]}">{html.escape(r["short"])}</a>…</p>')


def single_file(data_json, dest):
    page = (SITE / 'index.html').read_text(encoding='utf-8')
    page = page.replace('<link rel="stylesheet" href="style.css">',
                        '<style>' + (SITE / 'style.css').read_text(encoding='utf-8') + '</style>')
    page = re.sub(r'<script src="(\w+\.js)"></script>',
                  lambda m: '<script>' + (SITE / m.group(1)).read_text(encoding='utf-8') + '</script>', page)
    payload = data_json.replace('</', '<\\/')
    page = page.replace('<script>', f'<script>window.__DATA__={payload};</script>\n<script>', 1)
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    Path(dest).write_text(page, encoding='utf-8')


def build(out='dist', backend='lsa', single=None, csv_path=DATA):
    out = Path(out)
    if out.resolve() in (ROOT, SITE, ROOT / 'data'):
        raise SystemExit('refusing to overwrite a source directory')
    _, rows = read_rows(csv_path)
    records = [to_record(r) for r in rows]
    meta = {'backend': 'none'}
    if backend == 'lsa': meta, vecs = lsa(records)
    elif backend == 'minilm': meta, vecs = minilm(records)
    if backend != 'none':
        for r, v in zip(records, vecs): r['vec'] = v
    meta.update(count=len(records), built=datetime.date.today().isoformat())
    if out.exists(): shutil.rmtree(out)
    shutil.copytree(SITE, out)
    (out / 'data').mkdir()
    data_json = json.dumps({'meta': meta, 'records': records, 'guidance': json.loads(GUIDANCE.read_text(encoding='utf-8'))}, ensure_ascii=False, separators=(',', ':'))
    (out / 'data' / 'standards.json').write_text(data_json, encoding='utf-8')
    for r in records:
        (out / 'standards' / r['id']).mkdir(parents=True, exist_ok=True)
        (out / 'standards' / r['id'] / 'index.html').write_text(stub(r), encoding='utf-8')
    if single: single_file(data_json, single)
    return meta


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='dist')
    ap.add_argument('--backend', choices=['lsa', 'minilm', 'none'], default='lsa')
    ap.add_argument('--single-file')
    a = ap.parse_args()
    m = build(a.out, a.backend, a.single_file)
    print(f"built {m['count']} entries -> {a.out}/  (search backend: {m['backend']})")
