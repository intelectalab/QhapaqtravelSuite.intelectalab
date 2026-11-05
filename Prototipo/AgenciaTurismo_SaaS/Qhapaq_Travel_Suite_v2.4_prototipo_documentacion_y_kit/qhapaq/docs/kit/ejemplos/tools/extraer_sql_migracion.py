#!/usr/bin/env python3
"""Extrae el SQL de up() o down() de migraciones Laravel generadas (nowdoc <<<'SQL' y DB::statement("…"))."""
import re
import sys
from pathlib import Path

mode, files = sys.argv[1], sys.argv[2:]
for f in files:
    php = Path(f).read_text(encoding="utf-8")
    m = re.search(rf"public function {mode}\(\): void\s*\{{(.*?)\n    \}}", php, re.S)
    if not m:
        continue
    body = m.group(1)
    rx = re.compile(r"DB::(?:statement|unprepared)\((?:<<<'SQL'\n(?P<now>.*?)\n\s*SQL|\"(?P<dq>[^\"]*)\"|'(?P<sq>[^']*)')\);", re.S)
    for st in rx.finditer(body):
        sql = st.group("now") or st.group("dq") or st.group("sq")
        sql = "\n".join(line[12:] if line.startswith(" " * 12) else line for line in sql.splitlines()).strip()
        print(sql if sql.endswith(";") else sql + ";")
