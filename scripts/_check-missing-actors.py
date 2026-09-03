import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZH_CN = ROOT / "data" / "scrape_maps" / "actors.zh-CN.json"
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
missing = [k for k, v in table.items() if needs(k, v)]
print("total", len(table), "missing", len(missing))
for q in ["橘ひなの", "橘日向", "三上悠亜", "波多野結衣"]:
    e = table.get(q)
    print(q, "->", entry_name(e) if e else "NOT IN TABLE", e)

print("\nfirst 30 missing:")
for k in missing[:30]:
    print(" ", k, "->", entry_name(table[k]))
