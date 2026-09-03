"""
Phase4: move download / flaresolverr / siteMirror into subdirs; keep thin barrels at old paths.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "scrape" / "network"


def rewrite_imports(text: str) -> str:
    out: list[str] = []
    for line in text.splitlines(keepends=True):
        if 'from "./' in line:
            line = line.replace('from "./', 'from "../')
        if "from './" in line:
            line = line.replace("from './", "from '../")
        if 'import("./' in line:
            line = line.replace('import("./', 'import("../')
        if "import('./" in line:
            line = line.replace("import('./", "import('../")
        line = line.replace('from "../scrapeCancel.js"', 'from "../../scrapeCancel.js"')
        line = line.replace('from "../providers/catalog.js"', 'from "../../providers/catalog.js"')
        line = line.replace('from "../../paths.js"', 'from "../../../paths.js"')
        out.append(line)
    return "".join(out)


def main() -> None:
    for name in ("download", "flaresolverr", "siteMirror"):
        src = ROOT / f"{name}.ts"
        raw = src.read_text(encoding="utf-8")
        if raw.strip().startswith("export * from"):
            print("skip already barreled", name)
            continue
        out_dir = ROOT / name
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.ts").write_text(rewrite_imports(raw), encoding="utf-8", newline="\n")
        src.write_text(f'export * from "./{name}/index.js";\n', encoding="utf-8", newline="\n")
        print("moved", name, "->", f"{name}/index.ts")


if __name__ == "__main__":
    main()
