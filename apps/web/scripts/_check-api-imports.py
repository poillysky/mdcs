from pathlib import Path
import re

api = Path(r"e:/Mdcs/apps/web/src/api/index.ts").read_text(encoding="utf-8")
names: set[str] = set()
for m in re.finditer(r"export \{([^}]+)\}", api, re.S):
    for part in m.group(1).split(","):
        part = part.strip()
        if not part:
            continue
        part = re.sub(r"^type\s+", "", part).strip()
        if " as " in part:
            part = part.split(" as ")[-1].strip()
        names.add(part)
for m in re.finditer(r"export (?:async )?function (\w+)", api):
    names.add(m.group(1))
for m in re.finditer(r"export class (\w+)", api):
    names.add(m.group(1))

root = Path(r"e:/Mdcs/apps/web/src")
missing = []
pat = re.compile(
    r"import\s+(type\s+)?\{([^}]+)\}\s+from\s+[\"']((?:\.\./)+api|\./api)[\"']",
    re.S,
)
for f in root.rglob("*"):
    if f.suffix not in (".ts", ".tsx"):
        continue
    text = f.read_text(encoding="utf-8")
    for m in pat.finditer(text):
        is_type_import = bool(m.group(1))
        for part in m.group(2).split(","):
            part = part.strip()
            if not part:
                continue
            if part.startswith("type "):
                is_type_import = True
                part = part[5:].strip()
            if " as " in part:
                part = part.split(" as ")[0].strip()
            if part not in names:
                missing.append((str(f.relative_to(root)), part, "type" if is_type_import else "value"))

print("api export count", len(names))
print("missing count", len(missing))
for x in missing:
    print(x)
