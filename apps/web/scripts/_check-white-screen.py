from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror:{e}"))
    page.on(
        "console",
        lambda m: errors.append(f"{m.type}:{m.text}")
        if m.type in ("error", "warning")
        else None,
    )
    page.goto("http://127.0.0.1:3050/", wait_until="networkidle", timeout=30000)
    info = page.evaluate(
        """() => {
      const root = document.getElementById('root');
      return {
        rootLen: root ? root.innerHTML.length : -1,
        textLen: root ? (root.innerText || '').length : -1,
        sample: root ? (root.innerText || '').slice(0, 120) : '',
        hasShell: !!document.querySelector('.app-shell'),
      };
    }"""
    )
    print("info", info)
    print("errors:")
    for e in errors:
        print(" ", e)
    browser.close()
