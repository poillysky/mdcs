import urllib.request

url = "http://127.0.0.1:3050/src/styles.css"
with urllib.request.urlopen(url, timeout=10) as r:
    d = r.read().decode("utf-8", "replace")
print("status", r.status)
print("len", len(d))
print("empty_css", '__vite__css = ""' in d or "__vite__css = ''" in d)
print("has_root", ":root" in d or "--bg" in d)
print("---head---")
print(d[:600])
