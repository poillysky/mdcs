import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from enrich_actor_maps import ZH_CN_PATH, entry_href, entry_name, load_json, looks_chinese, needs_zh_cn, KANA_RE

table = load_json(ZH_CN_PATH)
url = "https://www.libredmm.com/actresses/1096544"
items = [(k, entry_name(v), entry_href(v)) for k, v in table.items() if entry_href(v) == url or "1096544" in entry_href(v)]
lines = [f"url={url} count={len(items)}"]
for k, n, h in sorted(items, key=lambda x: x[0])[:40]:
    lines.append(f"  {k} -> {n} needs={needs_zh_cn(k, table[k])}")
Path(ROOT / "scripts" / "_probe-url.txt").write_text("\n".join(lines), encoding="utf-8")
print(len(items))
