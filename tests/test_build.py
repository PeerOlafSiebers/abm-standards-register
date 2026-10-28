import json, pytest
from build import build, ROOT

@pytest.fixture(scope='module')
def out(tmp_path_factory):
    d = tmp_path_factory.mktemp('dist')
    build(d / 'site', 'lsa', d / 'single.html')
    return d

def load(out):
    return json.loads((out / 'site' / 'data' / 'standards.json').read_text(encoding='utf-8'))

def test_records_and_vectors(out):
    d = load(out); recs = d['records']
    assert d['meta']['count'] == len(recs) >= 60
    assert len({r['id'] for r in recs}) == len(recs)
    assert all(len(r['vec']) == d['meta']['k'] for r in recs)

def test_every_entry_has_stable_url_stub(out):
    for r in load(out)['records']:
        p = out / 'site' / 'standards' / r['id'] / 'index.html'
        assert p.exists() and f'#{r["id"]}' in p.read_text(encoding='utf-8')

def test_derived_fields_and_clean_urls(out):
    for r in load(out)['records']:
        assert r['b'] in {'Required', 'Voluntary', 'Encouraged', 'Other'}
        assert r['url'] == '' or r['url'].startswith('http')

def test_single_file_is_self_contained(out):
    html = (out / 'single.html').read_text(encoding='utf-8')
    assert 'window.__DATA__=' in html and '<script src=' not in html and 'rel="stylesheet"' not in html

def test_no_embeddings_backend(tmp_path):
    build(tmp_path / 's', 'none')
    assert 'vec' not in json.loads((tmp_path / 's' / 'data' / 'standards.json').read_text(encoding='utf-8'))['records'][0]

def test_refuses_to_overwrite_sources():
    with pytest.raises(SystemExit):
        build(ROOT / 'site')
