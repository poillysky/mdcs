"""Split NamingSettingsPanel.tsx into pages/naming/ modules."""
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "pages" / "NamingSettingsPanel.tsx"
OUT = Path(__file__).resolve().parents[1] / "src" / "pages" / "naming"
lines = SRC.read_text(encoding="utf-8").splitlines(keepends=True)
OUT.mkdir(parents=True, exist_ok=True)

constants = "".join(lines[9:93])
for name in ("DEFAULT_NAMING", "CATEGORY_KIND_ITEMS", "FIELD_TABS"):
    constants = constants.replace(f"const {name}", f"export const {name}", 1)
for name in ("Props", "Naming", "PreviewResult", "FieldTab"):
    constants = constants.replace(f"type {name}", f"export type {name}", 1)

(OUT / "types.ts").write_text(
    '''import { KIND_LABELS } from "../../lib/labels";
import type { NotifyFn } from "../../lib/notify";
import type { ScrapeConfig } from "../../types";

'''
    + constants,
    encoding="utf-8",
)

widgets = "".join(lines[94:227])
widgets = widgets.replace("function TemplateInput", "export function TemplateInput", 1)
widgets = widgets.replace("function MapGrid", "export function MapGrid", 1)
widgets = widgets.replace("function Panel", "export function Panel", 1)

(OUT / "widgets.tsx").write_text(
    '''import { useRef, useState, type ReactNode } from "react";
import { generateNamingTemplate, hasLlmConfigured } from "../../lib/llmNaming";
import type { NotifyFn } from "../../lib/notify";

'''
    + widgets,
    encoding="utf-8",
)

syntax = "".join(lines[1116:])
for name in ("SYNTAX_FILTERS", "SYNTAX_CONDS", "SYNTAX_EXAMPLES", "SYNTAX_VARS"):
    syntax = syntax.replace(f"const {name}", f"export const {name}", 1)
syntax = syntax.replace("function NamingSyntaxDoc", "export function NamingSyntaxDoc", 1)

(OUT / "NamingSyntaxDoc.tsx").write_text(syntax, encoding="utf-8")

main = "".join(lines[227:1116])

(OUT / "NamingSettingsPanel.tsx").write_text(
    '''import { useEffect, useRef, useState } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../../api";
import { Modal } from "../../components/Modal";
import { SettingRow } from "../../components/SettingRow";
import type { ScrapeConfig } from "../../types";
import {
  CATEGORY_KIND_ITEMS,
  DEFAULT_NAMING,
  FIELD_TABS,
  type FieldTab,
  type PreviewResult,
  type Props,
} from "./types";
import { MapGrid, Panel, TemplateInput } from "./widgets";
import { NamingSyntaxDoc } from "./NamingSyntaxDoc";

'''
    + main,
    encoding="utf-8",
)

(OUT / "index.ts").write_text(
    '''export { NamingSettingsPanel } from "./NamingSettingsPanel";
''',
    encoding="utf-8",
)

SRC.write_text('export { NamingSettingsPanel } from "./naming";\n', encoding="utf-8")
print("NamingSettingsPanel split done")
