"""Validate data/register.csv. Exit 1 on errors. Emits GitHub annotations in CI.
Usage: python scripts/validate.py [path/to/register.csv]"""
import datetime, os, re, sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from common import DATA, GUIDANCE, REQUIRED, VOCAB, read_rows

MOJIBAKE = re.compile(r'Ã.|â€|Â\s')
TEXT_COLS = ['Short Name', 'Full Name', 'Description', 'Reference (full)', 'Explicit Exclusions / Scope Limits']


def check_guidance(known, text=None):
    """Every SR-### mentioned in data/guidance.json must exist in the register."""
    text = GUIDANCE.read_text(encoding='utf-8') if text is None else text
    return [('error', ref, 'guidance.json refers to an unknown entry') for ref in sorted(set(re.findall(r'"(SR-\d{3})"', text)) - known)]


def validate(path=DATA):
    """Return a list of (level, id, message). level is 'error' or 'warning'."""
    issues = []
    add = lambda lvl, i, m: issues.append((lvl, i, m))
    fields, rows = read_rows(path)
    for c in REQUIRED:
        if c not in fields:
            add('error', '-', f'missing column: {c}')
    if any(i[0] == 'error' for i in issues):
        return issues
    ids = [r['ID'].strip() for r in rows]
    known = set(ids)
    for dup, n in Counter(ids).items():
        if n > 1: add('error', dup, f'duplicate ID ({n} rows)')
    for dup, n in Counter(r['Short Name'].strip() for r in rows).items():
        if n > 1: add('warning', '-', f'short name used {n} times: {dup!r} (disambiguate, e.g. 2015a/2015b)')
    this_year = datetime.date.today().year
    for r in rows:
        i = r['ID'].strip() or '(blank)'
        if not re.fullmatch(r'SR-\d{3}', i): add('error', i, 'ID must match SR-###')
        for c in REQUIRED:
            if not (r.get(c) or '').strip(): add('error', i, f'empty required field: {c}')
        y = (r.get('Year (first pub.)') or '').strip()
        if not (y.isdigit() and 1950 <= int(y) <= this_year + 1): add('error', i, f'implausible year: {y!r}')
        for c in ('Primary Function', 'Primary Domain'):
            v = (r.get(c) or '').strip()
            if v and v not in VOCAB[c]: add('error', i, f'{c} {v!r} not in data/vocab.json')
        for c, prefixes in VOCAB['prefixes'].items():
            v = (r.get(c) or '').strip()
            if v and not v.startswith(tuple(prefixes)): add('error', i, f'{c} must start with one of {prefixes}; got {v[:40]!r}')
        for c in TEXT_COLS:
            if MOJIBAKE.search(r.get(c) or ''): add('error', i, f'encoding damage (mojibake) in {c}')
        url = (r.get('Canonical Resource URL') or '').strip()
        if not url or url.lower().startswith('n/a'): add('warning', i, 'no canonical URL (leave blank rather than "n/a")' if url else 'no canonical URL')
        elif not url.startswith(('http://', 'https://')): add('error', i, f'URL must start with http(s)://: {url[:40]!r}')
        if not re.search(r'https?://', r.get('Reference (full)') or ''): add('warning', i, 'full reference has no DOI/URL')
        if not re.match(r'\d', (r.get('Citations (count)') or '').strip()): add('warning', i, 'no citation count')
        for ref in set(re.findall(r'SR-\d{3}', r.get('Relationship to Other Entries') or '')):
            if ref not in known: add('error', i, f'relationship points to unknown entry {ref}')
    if Path(path) == DATA and GUIDANCE.exists():
        issues += check_guidance(known)
    return issues


def main(argv):
    path = Path(argv[1]) if len(argv) > 1 else DATA
    issues = validate(path)
    ci = os.environ.get('GITHUB_ACTIONS') == 'true'
    for lvl, i, m in issues:
        print(f'::{lvl} file={path.name}::{i}: {m}' if ci else f'{lvl.upper():8} {i:8} {m}')
    _, rows = read_rows(path)
    unver = sum(1 for r in rows if not r['Verification Status'].startswith('Verified'))
    errs = sum(1 for i in issues if i[0] == 'error')
    print(f'\n{len(rows)} entries · {errs} errors · {len(issues)-errs} warnings · {unver} not yet verified')
    return 1 if errs else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
