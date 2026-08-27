from pathlib import Path
import re
p = Path(r"E:\Mdcs\apps\server\scripts\_xhs-dump\detail2.html")
t = p.read_bytes().decode("utf-8", "replace")
Path(r"E:\Mdcs\apps\server\scripts\_xhs-dump\detail.txt").write_text(t, encoding="utf-8")
out = []
title = re.search(r"<title[^>]*>([^<]+)</title>", t, re.I)
out.append(f"title={title.group(1) if title else ''}")
out.append("og:title " + (re.search(r'og:title["\']\s+content=["\']([^"\']+)', t) or [None, ""])[1] if False else "")
m = re.search(r'property="og:title"\s+content="([^"]+)"', t) or re.search(r'content="([^"]+)"\s+property="og:title"', t)
out.append("ogtitle=" + (m.group(1) if m else ""))
m = re.search(r'property="og:image"\s+content="([^"]+)"', t) or re.search(r'content="([^"]+)"\s+property="og:image"', t)
out.append("ogimage=" + (m.group(1) if m else ""))
hrefs = [h for h in re.findall(r'href=["\']([^"\']+)["\']', t) if any(x in h for x in ("/model/", "/video/", "/series", "tag", "category"))]
out.append("hrefs " + "\n".join(hrefs[:40]))
# h1
h1 = re.search(r"<h1[^>]*>(.*?)</h1>", t, re.S|re.I)
out.append("h1=" + re.sub(r"<[^>]+>", "", h1.group(1) if h1 else "")[:200])
# tags / models
out.append("models " + str(re.findall(r'href="(/model/id-[^"]+)"[^>]*>([^<]+)', t)[:10]))
out.append("duration " + str(re.findall(r"(\d+:\d{2})", t)[:8]))
# series
out.append("series " + str(re.findall(r'href="(/videos/series-[^"]+)"[^>]*>([^<]*)', t)[:10]))
# date
out.append("dates " + str(re.findall(r"20\d{2}[-/]\d{1,2}[-/]\d{1,2}", t)[:10]))
# snippet around video-detail or info
for key in ["video-detail", "info-item", "tags", "发布时间", "片商", "时长", "series"]:
    i = t.find(key)
    if i >= 0:
        out.append(f"--- around {key} ---")
        out.append(t[max(0,i-200):i+600])
Path(r"E:\Mdcs\apps\server\scripts\_xhs-dump\detail-out.txt").write_text("\n".join(out), encoding="utf-8")
