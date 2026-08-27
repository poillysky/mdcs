"""Extract KindSettingsModal draft helpers into kindSettings/drafts.ts."""
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "pages" / "KindSettingsModal.tsx"
OUT = Path(__file__).resolve().parents[1] / "src" / "pages" / "kindSettings"
lines = SRC.read_text(encoding="utf-8").splitlines(keepends=True)
OUT.mkdir(parents=True, exist_ok=True)

# types KindDraft/ProfileDraft + helpers: lines 38-152 (1-indexed) = 37:152
helpers = "".join(lines[37:152])
helpers = helpers.replace("type KindDraft", "export type KindDraft", 1)
helpers = helpers.replace("type ProfileDraft", "export type ProfileDraft", 1)
for name in (
    "defaultDownload",
    "defaultWatermark",
    "defaultMetadata",
    "toKindDraft",
    "ensureProfile",
):
    helpers = helpers.replace(f"function {name}", f"export function {name}", 1)

(OUT / "drafts.ts").write_text(
    '''import type { KindRow } from "../../api";
import { normalizeRelativePath } from "../../lib/paths";
import type { OrganizeConfig, ScrapeConfig } from "../../types";

'''
    + helpers,
    encoding="utf-8",
)

# Props type remains in main - lines 52-60 were Props
# Actually lines 38-48 KindDraft, 50 ProfileDraft, 52-60 Props, 62-152 helpers
# I included Props in helpers by mistake if Props is in 37:152

# Check: indices 37:152 includes Props. Filter Props out of drafts and keep in main.
drafts_text = (OUT / "drafts.ts").read_text(encoding="utf-8")
# Remove Props type block from drafts if present
import re
drafts_text = re.sub(
    r"export type Props = \{.*?\n\};\n\n",
    "",
    drafts_text,
    count=1,
    flags=re.S,
)
(OUT / "drafts.ts").write_text(drafts_text, encoding="utf-8")

# Rebuild main: imports + Props + modal body from line 154
props_block = "".join(lines[51:61])  # type Props ...
main_body = "".join(lines[153:])  # export function KindSettingsModal...

SRC.write_text(
    '''import { useEffect, useMemo, useState } from "react";
import { fetchKinds, fetchScrapeConfig, saveScrapeConfig, updateKind, type KindRow } from "../api";
import {
  AdvancedSettingsShell,
} from "../components/advancedSettings/AdvancedSettingsShell";
import {
  OrganizeFields,
  Panel,
  seedOrganize,
} from "../components/advancedSettings/fields";
import { FolderPicker } from "../components/FolderPicker";
import { KindSourcesSettingsView } from "../components/KindSourcesSettingsView";
import { SettingRow } from "../components/SettingRow";
import { DownloadSettingsPanel } from "./DownloadSettingsPanel";
import { MetadataSettingsPanel } from "./MetadataSettingsPanel";
import { NamingSettingsPanel } from "./NamingSettingsPanel";
import { NfoSettingsPanel } from "./NfoSettingsPanel";
import { WatermarkSettingsPanel } from "./WatermarkSettingsPanel";
import {
  JOB_ADVANCED_TABS,
  applyJobDownload,
  applyJobMetadata,
  applyJobNaming,
  applyJobNfo,
  applyJobWatermark,
  scrapeToJobDownload,
  scrapeToJobMetadata,
  scrapeToJobNaming,
  scrapeToJobNfo,
  scrapeToJobWatermark,
  type JobOptionsTab,
  type JobWatermarkOptions,
} from "../lib/jobOptions";
import type { NotifyFn } from "../lib/notify";
import { displayRelativePath, normalizeRelativePath } from "../lib/paths";
import type { OrganizeConfig, ProviderCatalogRow, ScrapeConfig } from "../types";
import {
  ensureProfile,
  toKindDraft,
  type KindDraft,
  type ProfileDraft,
} from "./kindSettings/drafts";

'''
    + props_block
    + "\n"
    + main_body,
    encoding="utf-8",
)
print("KindSettingsModal helpers extracted")
