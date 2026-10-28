# ABM Documentation Standards Register

Searchable "standard cards" for the documentation, transparency and reproducibility standards register.
`data/register.csv` is the single source of truth; everything else is generated from it.

## Layout
| Path | What |
|---|---|
| `data/register.csv` | The register (one row per standard). **Edit this.** |
| `data/vocab.json` | Controlled vocabularies enforced by the validator |
| `scripts/validate.py` | Data rules (IDs, vocab, URLs, relationships, encoding damage) |
| `scripts/build.py` | CSV → `dist/` (JSON + search vectors + `/standards/SR-###/` stable links) |
| `site/` | Static front end: `search.js` (ranking), `card.js` (card), `app.js` (UI) |
| `tests/` | pytest (data + build) and `node --test` (search + cards) |

## Run and test locally (before pushing anything)
```bash
pip install -r requirements.txt            # numpy + pytest; Node 18+ needed for the JS tests
python scripts/validate.py                 # 1. is the data valid?
python scripts/build.py                    # 2. build dist/
pytest -q tests                            # 3. Python tests
node --test tests/*.test.js                # 4. search + card tests
python -m http.server -d dist 8000         # 5. look at it: http://localhost:8000
```
(`file://` won't work because the page fetches `data/standards.json`; use the local server.)
`python scripts/build.py --single-file dist/single.html` also writes one self-contained HTML file you can open directly.

## Add or change a standard
Edit the CSV, run `validate.py`, open a pull request. CI repeats the checks and annotates problems on the changed lines.
Never reuse or renumber an ID. Leave the URL blank rather than writing `n/a`.

## Search
Hybrid ranking in `site/search.js`: weighted keyword match (name > function/domain > description), synonym expansion,
natural-language filters ("mandatory", "machine-readable", "health"), fused with vector similarity.
- `--backend lsa` (default): offline TF-IDF + SVD vectors, no model download. Modest gains on 66 short entries.
- `--backend minilm`: neural vectors (`pip install -r requirements-minilm.txt`); the browser then loads
  `all-MiniLM-L6-v2` via transformers.js from a CDN to embed queries. **Not exercised in CI** (needs model downloads);
  try it locally and watch the console. If the model fails to load the site falls back to keyword search.
- The test marked TODO in `tests/search.test.js` is the paraphrase case the neural backend should fix.

## Deploy
Repo Settings → Pages → Source: **GitHub Actions**. Pushing to `main` validates, tests, builds and publishes.
For a citable DOI per release, enable the GitHub–Zenodo integration and add a `CITATION.cff` and licence (your choice).
