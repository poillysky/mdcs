"""Split ScrapeConfigPanel into pages/scrape/ modules."""
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "pages" / "ScrapeConfigPanel.tsx"
OUT = Path(__file__).resolve().parents[1] / "src" / "pages" / "scrape"
lines = SRC.read_text(encoding="utf-8").splitlines(keepends=True)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "hooks").mkdir(exist_ok=True)

# constants: FIELD_LABELS + PROVIDER_UI_GROUPS (lines 25-47, 1-based) = 24:47
constants = "".join(lines[24:47])
constants = constants.replace("const FIELD_LABELS", "export const FIELD_LABELS", 1)
constants = constants.replace("const PROVIDER_UI_GROUPS", "export const PROVIDER_UI_GROUPS", 1)
(OUT / "constants.ts").write_text(
    """import type { ProviderCatalogRow } from "../../types";

"""
    + constants,
    encoding="utf-8",
)

# probeStorage: type ProbeStatus + consts + functions through persistProbeSnapshot (49-124)
probe = "".join(lines[48:124])
probe = probe.replace("type ProbeStatus", "export type ProbeStatus", 1)
for name in (
    "PROBE_BATCH_SIZE",
    "PROBE_LAST_AT_KEY",
    "PROBE_STATUS_KEY",
    "PROBE_DAY_KEY",
    "PROBE_HOUR",
    "PROBE_MINUTE",
):
    probe = probe.replace(f"const {name}", f"export const {name}", 1)
for name in (
    "localDayKey",
    "todayProbeSlotStart",
    "nextProbeSlot",
    "isProbeDoneForDay",
    "claimProbeDay",
    "readStoredProbeStatus",
    "persistProbeSnapshot",
):
    probe = probe.replace(f"function {name}", f"export function {name}", 1)
(OUT / "probeStorage.ts").write_text(probe, encoding="utf-8")

# providerDisplay: 126-181
disp = "".join(lines[125:181])
for name in (
    "orderedProviderIds",
    "displayProviderName",
    "formatAgo",
    "providerAccessRank",
    "sortProviderRows",
    "emptySite",
):
    disp = disp.replace(f"function {name}", f"export function {name}", 1)
(OUT / "providerDisplay.ts").write_text(
    """import type { ProviderCatalogRow, ProviderSiteConfig } from "../../types";
import { PROVIDER_UI_GROUPS } from "./constants";

"""
    + disp,
    encoding="utf-8",
)

# Fix providerDisplay - PROVIDER_UI_GROUPS may not be needed if only used for ranking via groups in sort - check sortProviderRows
# providerAccessRank doesn't use PROVIDER_UI_GROUPS. Remove unused import if needed.

# Types for Props
(OUT / "types.ts").write_text(
    """import type { NotifyFn } from "../../lib/notify";
import type { ProviderCatalogRow, ScrapeConfig } from "../../types";

export type ScrapeConfigPanelProps = {
  notify: NotifyFn;
  variant?: "project" | "sources" | "providers" | "fields";
  embedded?: boolean;
  value?: ScrapeConfig;
  catalog?: ProviderCatalogRow[];
  onChange?: (next: ScrapeConfig, catalog?: ProviderCatalogRow[]) => void;
};
""",
    encoding="utf-8",
)

print("helpers written")
