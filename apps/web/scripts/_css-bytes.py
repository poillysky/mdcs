from pathlib import Path
p = Path(r"E:\Mdcs\apps\web\src\styles.css")
b = p.read_bytes()
nuls = b.count(b"\x00")
out = [
    f"size={len(b)}",
    f"nuls={nuls}",
    f"bom={b[:4]!r}",
]
# find weird chars
weird = 0
for i, ch in enumerate(b):
    if ch < 9 and ch not in (9, 10, 13) and ch != 0:
        weird += 1
        if weird <= 5:
            out.append(f"lowbyte at {i}={ch}")
Path(r"E:\Mdcs\apps\web\scripts\_css-bytes.txt").write_text("\n".join(out), encoding="utf-8")
