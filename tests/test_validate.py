import csv
from common import COLS, DATA
from validate import validate

def row(**over):
    base = {h: 'x' for h in COLS}
    base.update({'ID': 'SR-001', 'Short Name': 'A', 'Year (first pub.)': '2020', 'Primary Function': 'Describe model',
                 'Primary Domain': 'Ecology', 'Binding Status': 'Voluntary', 'Verification Status': 'Verified 2026-01-01',
                 'Machine-Readable': 'No', 'GenAI / LLM Status': 'Pre-dates GenAI',
                 'Canonical Resource URL': 'https://doi.org/10.1/x', 'Citations (count)': '5',
                 'Relationship to Other Entries': 'Extends SR-002', 'Reference (full)': 'A (2020). https://doi.org/10.1/x'})
    base.update(over)
    return base

def write(tmp_path, rows):
    p = tmp_path / 'r.csv'
    with open(p, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(COLS)); w.writeheader(); w.writerows(rows)
    return p

def errors(tmp_path, rows):
    return [m for lvl, _, m in validate(write(tmp_path, rows)) if lvl == 'error']

def pair(**over):  # two valid rows so SR-002 exists for relationship checks
    return [row(), row(**{'ID': 'SR-002', 'Short Name': 'B', 'Relationship to Other Entries': 'Updates SR-001'}) | over]

def test_real_register_has_no_errors():
    assert [i for i in validate(DATA) if i[0] == 'error'] == []

def test_valid_rows_pass(tmp_path):
    assert errors(tmp_path, pair()) == []

def test_duplicate_id(tmp_path):
    assert any('duplicate' in m for m in errors(tmp_path, [row(), row(**{'Short Name': 'B'})]))

def test_bad_id_format(tmp_path):
    assert any('SR-###' in m for m in errors(tmp_path, [row(ID='SR-1')]))

def test_unknown_relationship(tmp_path):
    assert any('SR-999' in m for m in errors(tmp_path, [row(**{'Relationship to Other Entries': 'See SR-999'})]))

def test_vocabulary_violation(tmp_path):
    assert any('vocab' in m for m in errors(tmp_path, pair(**{'Primary Domain': 'Astrology'})))

def test_status_prefix(tmp_path):
    assert any('Verification Status' in m for m in errors(tmp_path, pair(**{'Verification Status': 'looks fine'})))

def test_mojibake_detected(tmp_path):
    assert any('mojibake' in m for m in errors(tmp_path, pair(**{'Full Name': 'MÃ¼ller et al.'})))

def test_missing_required_field(tmp_path):
    assert any('empty required' in m for m in errors(tmp_path, pair(Description='')))

def test_implausible_year(tmp_path):
    assert any('year' in m for m in errors(tmp_path, pair(**{'Year (first pub.)': '1066'})))

def test_na_url_is_warning_not_error(tmp_path):
    issues = validate(write(tmp_path, pair(**{'Canonical Resource URL': 'n/a (book chapter)'})))
    assert not [i for i in issues if i[0] == 'error'] and any('canonical URL' in i[2] for i in issues)

def test_guidance_real_file_resolves():
    from validate import check_guidance
    from common import read_rows
    assert check_guidance({r['ID'] for r in read_rows()[1]}) == []

def test_guidance_unknown_id_is_error():
    from validate import check_guidance
    assert check_guidance({'SR-001'}, '[["SR-001","ok"],["SR-999","bad"]]')[0][1] == 'SR-999'
