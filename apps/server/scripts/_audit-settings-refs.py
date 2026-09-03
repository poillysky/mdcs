#!/usr/bin/env python3
"""One-off audit helper: find setting field consumption."""
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..", "src")
PATTERNS = [
    r"proxyUrl",
    r"flareSolverrUrl",
    r"requestTimeoutSec",
    r"exportFastConcurrency",
    r"exportSlowConcurrency",
    r"applyMetadataPrefs",
    r"resolveLlmConfig",
    r"applyWatermark",
    r"resolveWatermarkAssetDir",
    r"watermarkConfig",
    r"writeNfo",
    r"normalizeNfoConfig",
    r"dispatchJobWebhooks",
    r"dispatchWebhook",
    r"autoScrapeEnabled",
    r"autoScrapeRecentDays",
    r"refreshLibraryAfterScrape",
    r"scrapeMetadata",
    r"scrapeImages",
    r"metadataOverwrite",
    r"translateEngine",
    r"customSystemPrompt",
    r"cfg\.llm",
    r"scrapeCfg\.llm",
    r"\.watermark\b",
    r"\.nfo\b",
    r"\.metadata\b",
]

compiled = [(p, re.compile(p)) for p in PATTERNS]
hits = {p: [] for p, _ in compiled}

for dirpath, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith(".ts"):
            continue
        path = os.path.join(dirpath, fn)
        rel = os.path.relpath(path, ROOT).replace("\\", "/")
        try:
            with open(path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            for p, cre in compiled:
                if cre.search(line):
                    hits[p].append(f"{rel}:{i}:{line.strip()[:120]}")

for p, rows in hits.items():
    print(f"\n=== {p} ({len(rows)}) ===")
    for r in rows[:25]:
        print(r)
    if len(rows) > 25:
        print(f"... +{len(rows)-25} more")
