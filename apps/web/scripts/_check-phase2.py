from pathlib import Path

for d in [
    Path(r"e:/Mdcs/apps/web/src/pages/records"),
    Path(r"e:/Mdcs/apps/web/src/pages/naming"),
    Path(r"e:/Mdcs/apps/web/src/components/recordDetail"),
]:
    print("===", d)
    for p in sorted(d.rglob("*")):
        if p.is_file() and p.suffix in {".ts", ".tsx"}:
            n = len(p.read_text(encoding="utf-8").splitlines())
            print(f"  {n:4d}  {p.relative_to(d)}")
