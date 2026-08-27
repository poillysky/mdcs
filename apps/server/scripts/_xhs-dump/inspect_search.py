from pathlib import Path
import re
dump = Path(r"E:\Mdcs\apps\server\scripts\_xhs-dump")
out_lines = []
for name in ["search.html", "search-mdx1.html", "search-mdx.html", "videos.html", "photos.html"]:
    p = dump / name
    d = p.read_bytes()
    text = d.decode("utf-8", "replace")
    (dump / (name + ".txt")).write_text(text, encoding="utf-8")
    title = re.search(r"<title[^>]*>([^<]+)</title>", text, re.I)
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', text)
    interesting = [h for h in hrefs if any(x in h for x in ("/videos/", "/photos/", "/fictions/", "id-", "keyword"))]
    out_lines.append(f"===== {name} len={len(d)} title={title.group(1) if title else ''} =====")
    out_lines.append("interesting hrefs: " + str(interesting[:40]))
    # snippets
    for pat in ["没有", "未找到", "no result", "video-item", "photo-item", "item-title", "MDX"]:
        if pat.lower() in text.lower() or pat in text:
            out_lines.append(f"  has {pat}")
    # class names
    classes = sorted(set(re.findall(r'class="([^"]+)"', text)))[:40]
    out_lines.append("classes sample: " + str(classes))
    out_lines.append(text[text.find("<body"):text.find("<body")+2500] if "<body" in text else text[:1500])
    out_lines.append("")
Path(r"E:\Mdcs\apps\server\scripts\_xhs-dump\search-out.txt").write_text("\n".join(out_lines), encoding="utf-8")
