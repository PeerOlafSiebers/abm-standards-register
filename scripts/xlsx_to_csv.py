"""One-off import: Catalogue sheet of the v0.4 workbook -> data/register.csv.
After this, edit the CSV (or a spreadsheet exporting to it), not the xlsx.
Usage: python scripts/xlsx_to_csv.py path/to/register.xlsx"""
import csv, sys
from pathlib import Path
from openpyxl import load_workbook

src = Path(sys.argv[1])
ws = load_workbook(src, read_only=True, data_only=True)['Catalogue']
rows = list(ws.iter_rows(values_only=True))
out = Path(__file__).resolve().parent.parent / 'data' / 'register.csv'
with open(out, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    for r in rows:
        if r[0] is None:
            continue
        w.writerow(['' if c is None else str(c).strip() for c in r])
print(f'wrote {out} ({len(rows)-1} entries)')
