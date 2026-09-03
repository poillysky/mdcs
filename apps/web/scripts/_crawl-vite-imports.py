import re
import urllib.request

base = "http://127.0.0.1:3050"
seen: set[str] = set()
q = ["/src/main.tsx"]
errors: list[tuple[str, str]] = []

while q:
    path = q.pop(0)
    if path in seen:
        continue
    seen.add(path)
    if not path.startswith("/src/"):
        continue
    try:
        with urllib.request.urlopen(base + path, timeout=20) as r:
            body = r.read().decode("utf-8", "replace")
    except Exception as e:
        errors.append((path, str(e)))
        print("FAIL", path, e)
        continue
    for m in re.finditer(r"""from\s*["'](/src/[^"']+)["']""", body):
        q.append(m.group(1).split("?")[0])
    for m in re.finditer(r"""import\(\s*["'](/src/[^"']+)["']\s*\)""", body):
        q.append(m.group(1).split("?")[0])

print("scanned", len(seen), "errors", len(errors))
for e in errors[:40]:
    print(e)
