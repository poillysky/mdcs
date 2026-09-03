from playwright.sync_api import sync_playwright

routes = [
    "/",
    "/records",
    "/jobs",
    "/settings",
    "/actors",
    "/files",
    "/sources",
    "/kind-tasks",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for route in routes:
        page = browser.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda exc: errors.append(f"pageerror:{exc}"))
        page.on(
            "console",
            lambda msg: errors.append(f"console:{msg.type}:{msg.text}")
            if msg.type == "error"
            else None,
        )
        page.goto(f"http://127.0.0.1:9210{route}", wait_until="networkidle", timeout=30000)
        root = page.inner_html("#root")
        print(f"{route}\troot={len(root)}\terrors={len(errors)}")
        for e in errors[:5]:
            print(" ", e)
        page.close()
    browser.close()
