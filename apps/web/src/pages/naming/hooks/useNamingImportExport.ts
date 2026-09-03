import { useRef } from "react";
import type { NotifyFn } from "../../../lib/notify";
import type { ScrapeConfig } from "../../../types";
import { prepareConfigForSave } from "../configHelpers";
import { DEFAULT_NAMING, type Naming } from "../types";

export function useNamingImportExport(
  config: ScrapeConfig | null,
  patchNaming: (next: Partial<Naming>) => void,
  commit: (next: ScrapeConfig) => void,
  notify: NotifyFn,
) {
  const fileImportRef = useRef<HTMLInputElement>(null);

  function exportNaming() {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config.naming, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mdcs-naming-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("ok", "命名配置已导出");
  }

  function importNaming(file: File) {
    if (!config) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result || "{}")) as Partial<Naming>;
        const merged = { ...DEFAULT_NAMING, ...config.naming, ...raw };
        commit(
          prepareConfigForSave({
            ...config,
            naming: merged,
          }),
        );
        notify("ok", "已导入，请确认后保存");
      } catch (e) {
        notify("error", e, "导入失败");
      }
    };
    reader.readAsText(file);
  }

  return { fileImportRef, exportNaming, importNaming };
}
