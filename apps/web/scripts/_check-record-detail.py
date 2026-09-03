from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda exc: errors.append(f"pageerror:{exc}"))
    page.on(
        "console",
        lambda msg: errors.append(f"console:{msg.type}:{msg.text}")
        if msg.type == "error"
        else None,
    )
    page.goto("http://127.0.0.1:9210/records", wait_until="networkidle", timeout=30000)
    # click first record row if any
    row = page.locator(".records-table tbody tr, tr.records-row, .records-row").first
    count = page.locator(".records-table tbody tr, tr.records-row, .records-row").count()
    print("row_count", count)
    if count > 0:
        row.click(timeout=5000)
        page.wait_for_timeout(1500)
        print("after_click_root", len(page.inner_html("#root")))
        print("url", page.url)
    else:
        # try any clickable code link
        link = page.locator("a, button").filter(has_text="详情").first
        if link.count():
            link.click()
            page.wait_for_timeout(1500)
            print("detail via button", len(page.inner_html("#root")))
    print("errors", errors)
    # dump a bit of structure
    print("has record-detail", page.locator(".record-detail").count())
    browser.close()
