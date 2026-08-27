from pathlib import Path
t = Path(r"E:\Mdcs\apps\web\src\styles.css").read_text(encoding="utf-8")
depth = 0
line = 1
bad = []
in_s = None
esc = False
in_cmt = False
i = 0
while i < len(t):
    ch = t[i]
    nxt = t[i + 1] if i + 1 < len(t) else ""
    if ch == "\n":
        line += 1
    if in_cmt:
        if ch == "*" and nxt == "/":
            in_cmt = False
            i += 2
            continue
        i += 1
        continue
    if in_s:
        if esc:
            esc = False
            i += 1
            continue
        if ch == "\\":
            esc = True
            i += 1
            continue
        if ch == in_s:
            in_s = None
        i += 1
        continue
    if ch == "/" and nxt == "*":
        in_cmt = True
        i += 2
        continue
    if ch in "\"'":
        in_s = ch
        i += 1
        continue
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth < 0:
            bad.append(line)
            depth = 0
    i += 1
out = Path(r"E:\Mdcs\apps\web\scripts\_css-check.txt")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(f"final={depth}\nbad={bad}\nlines={line}\nlen={len(t)}\n", encoding="utf-8")
