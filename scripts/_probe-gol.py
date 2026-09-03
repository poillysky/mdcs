import json
import sqlite3
from pathlib import Path

db = Path("data/mdcs.db")
if not db.is_file():
    print("no db")
    raise SystemExit(0)
conn = sqlite3.connect(db)
conn.row_factory = sqlite3.Row
for q in ["GOL-0149", "GOL%"]:
    rows = conn.execute(
        "SELECT id, code, status, error, kind, source_path FROM files WHERE code LIKE ? OR source_path LIKE ? LIMIT 5",
        (q, f"%{q.replace('%','')}%"),
    ).fetchall()
    print("query", q, "hits", len(rows))
    for r in rows:
        print(dict(r))
        cache = conn.execute(
            "SELECT meta_json FROM scrape_cache WHERE file_id = ?", (r["id"],)
        ).fetchone()
        if cache:
            meta = cache["meta_json"]
            try:
                m = json.loads(meta) if meta else {}
            except json.JSONDecodeError:
                m = {}
            print("  meta keys:", list(m.keys())[:15] if isinstance(m, dict) else type(m))
            if isinstance(m, dict):
                print("  title:", m.get("title"), m.get("titleZh"))
                print("  actors:", m.get("actors"))
                print("  ok:", m.get("ok"))
conn.close()
