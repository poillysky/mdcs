import re
import urllib.request

html = urllib.request.urlopen("http://127.0.0.1:9210/").read().decode()
print(html)
print("---")
for m in re.finditer(r'(?:src|href)="(/assets/[^"]+)"', html):
    url = "http://127.0.0.1:9210" + m.group(1)
    r = urllib.request.urlopen(url)
    print(m.group(1), r.status, r.headers.get("content-type"), "len", r.headers.get("content-length"))
