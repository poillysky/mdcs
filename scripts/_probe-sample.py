import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from enrich_actor_maps import ZH_CN_PATH, entry_href, entry_name, load_json, needs_zh_cn

table = load_json(ZH_CN_PATH)
keys = ["Shaku Alice", "辻アリス", "天沢りん", "花芽ありす", "佐野りか", "橘ひなの"]
lines = []
for k in keys:
    e = table.get(k)
    lines.append(f"{k!r}: name={entry_name(e)!r} href={entry_href(e)!r} needs={needs_zh_cn(k,e) if e else 'N/A'}")

# find all keys sharing libredmm 1069774 (橘ひなの)
for k, e in table.items():
    h = entry_href(e)
    if "1069774" in h or "辻" in k or "Shaku" in k:
        if "辻" in k or "Shaku" in k or "1069774" in h:
            lines.append(f"  {k!r} -> {entry_name(e)!r} {h}")

Path(ROOT / "scripts" / "_probe-sample.txt").write_text("\n".join(lines), encoding="utf-8")
print("wrote")
