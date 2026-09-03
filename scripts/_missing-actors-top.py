import json
import re
import sqlite3
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZH_CN = ROOT / "data" / "scrape_maps" / "actors.zh-CN.json"
DB = ROOT / "data" / "mdcs.db"
OUT = ROOT / "scripts" / "_missing-actors-top.txt"
KANA = re.compile(r"[\u3040-\u30ff]")
CJK = re.compile(r"[\u4e00-\u9fff]")


def looks_chinese(name: str) -> bool:
    s = (name or "").strip()
    if not s:
        return False
    cn = len(CJK.findall(s))
    kana = len(KANA.findall(s))
    return cn >= 2 and cn >= kana


def entry_name(entry):
    if isinstance(entry, str):
        return entry.strip()
    if isinstance(entry, dict):
        return str(entry.get("name") or entry.get("zh") or "").strip()
    return ""


def needs(key, entry):
    name = entry_name(entry) or key
    if looks_chinese(name) and name != key:
        return False
    if looks_chinese(name) and not KANA.search(key):
        return False
    return bool(KANA.search(key) or KANA.search(name) or not looks_chinese(name))


table = json.loads(ZH_CN.read_text(encoding="utf-8"))
missing = {k for k, v in table.items() if needs(k, v)}

freq = Counter()
if DB.is_file():
    conn = sqlite3.connect(DB)
    try:
        rows = conn.execute(
            "SELECT meta_json FROM scrape_cache WHERE meta_json IS NOT NULL AND meta_json != ''"
        ).fetchall()
        for (raw,) in rows:
            try:
                meta = json.loads(raw)
            except json.JSONDecodeError:
                continue
            for a in meta.get("actors") or []:
                name = str(a).strip()
                if name in missing:
                    freq[name] += 1
    finally:
        conn.close()

lines = [
    f"total={len(table)} missing={len(missing)}",
    "",
    "top missing in scrape_cache:",
]
for name, n in freq.most_common(80):
    lines.append(f"  {n:5d}  {name}  ->  {entry_name(table.get(name, ''))}")

lines.append("")
lines.append("sample missing keys:")
for k in sorted(missing)[:50]:
    lines.append(f"  {k}")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {OUT}")
