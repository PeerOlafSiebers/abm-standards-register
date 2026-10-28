"""Shared loading and normalisation for the register."""
import csv, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'register.csv'
GUIDANCE = ROOT / 'data' / 'guidance.json'
VOCAB = json.loads((ROOT / 'data' / 'vocab.json').read_text(encoding='utf-8'))

# CSV header -> JSON key used by the site
COLS = {
    'ID': 'id', 'Short Name': 'short', 'Full Name': 'name', 'Year (first pub.)': 'year',
    'Latest Version / Update': 'ver', 'Description': 'desc', 'Artefact Type': 'type',
    'Primary Function': 'fn', 'Primary Domain': 'dom', 'Other Domains': 'other',
    'Method Focus': 'method', 'Lifecycle Coverage': 'life',
    'Explicit Exclusions / Scope Limits': 'excl', 'Data Type Addressed': 'data',
    'Machine-Readable': 'mr', 'GenAI / LLM Status': 'genai', 'Binding Status': 'bind',
    'Relationship to Other Entries': 'rel', 'Canonical Resource URL': 'url',
    'Citations (count)': 'cites', 'Citation Source & Date': 'csrc', 'Provenance': 'prov',
    'Verification Status': 'vs', 'Reference (full)': 'ref',
    'TODO: Real World Use Case Examples (2-3 references)': 'usecases',
}
REQUIRED = ['ID', 'Short Name', 'Full Name', 'Year (first pub.)', 'Description', 'Artefact Type',
            'Primary Function', 'Primary Domain', 'Binding Status', 'Verification Status',
            'Provenance', 'Reference (full)']


def read_rows(path=DATA):
    with open(path, newline='', encoding='utf-8-sig') as f:
        rd = csv.DictReader(f)
        return rd.fieldnames or [], list(rd)


def binding_class(t):
    if re.match(r'(?i)^(mandatory|mandated|required|effectively (mandatory|required))', t): return 'Required'
    if re.match(r'(?i)^encouraged', t): return 'Encouraged'
    if re.match(r'(?i)^voluntary', t): return 'Voluntary'
    return 'Other'


def machine_class(t):
    return 'Yes' if t.startswith('Yes') else 'Partial' if t.startswith('Partial') else 'No'


def verification_class(t):
    return 'Verified' if t.startswith('Verified') else 'Check' if t.startswith('FIXED') else 'Unverified'


def leading_int(s):
    m = re.match(r'\d[\d,]*', s or '')
    return int(m.group().replace(',', '')) if m else 0


def to_record(row):
    rec = {k: (row.get(h) or '').strip() for h, k in COLS.items()}
    if not rec['url'].startswith(('http://', 'https://')):
        rec['url'] = ''  # 'n/a ...' placeholders mean no link
    rec['year'] = int(rec['year']) if rec['year'].isdigit() else 0
    rec['b'] = binding_class(rec['bind'])
    rec['m'] = machine_class(rec['mr'])
    rec['v'] = verification_class(rec['vs'])
    rec['cn'] = leading_int(rec['cites'])
    return rec
