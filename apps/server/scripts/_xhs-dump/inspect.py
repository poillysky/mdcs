from pathlib import Path
p = Path(r"E:\Mdcs\apps\server\scripts\_xhs-dump\home.html")
d = p.read_bytes()
out = Path(r"E:\Mdcs\apps\server\scripts\_xhs-dump\out.txt")
lines = [f"len={len(d)} magic={d[:12]!r}"]
# try brotli
try:
    import brotli
    t = brotli.decompress(d)
    lines.append(f"brotli ok {len(t)}")
    d2 = t
except Exception as e:
    lines.append(f"brotli fail {e}")
    d2 = d
try:
    text = d2.decode("utf-8")
    lines.append("utf8 ok")
except Exception as e:
    lines.append(f"utf8 fail {e}")
    text = d2.decode("utf-8", "replace")
Path(r"E:\Mdcs\apps\server\scripts\_xhs-dump\home.txt").write_text(text[:20000], encoding="utf-8")
import re
hrefs = re.findall(r'href=["\']([^"\']+)["\']', text)
lines.append("href count " + str(len(hrefs)))
lines.extend(hrefs[:80])
out.write_text("\n".join(lines), encoding="utf-8")
