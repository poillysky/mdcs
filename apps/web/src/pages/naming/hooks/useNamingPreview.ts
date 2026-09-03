import { useState } from "react";
import type { NotifyFn } from "../../../lib/notify";
import type { Naming, PreviewResult } from "../types";

export function useNamingPreview(naming: Naming | null, notify: NotifyFn) {
  const [testOpen, setTestOpen] = useState(false);
  const [testCode, setTestCode] = useState("SSIS-001");
  const [testMosaic, setTestMosaic] = useState("有码");
  const [testHasSub, setTestHasSub] = useState(false);
  const [testResolution, setTestResolution] = useState("1080P");
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  async function runPreview() {
    if (!naming) return;
    try {
      const res = await fetch("/api/organize/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "japan_censored",
          code: testCode,
          mosaic: testMosaic,
          hasSubtitle: testHasSub,
          resolution: testResolution,
          directoryTemplate: naming.directoryTemplate,
          fileNameTemplate: naming.fileNameTemplate,
          nameSuffixTemplate: naming.nameSuffixTemplate || "",
          videoSuffixTemplate: naming.videoSuffixTemplate,
          naming,
          title: `${testCode} 测试标题`,
          studio: "S1",
          series: "系列测试",
          actors: ["演员A", "演员B"],
        }),
      });
      const json = (await res.json()) as { ok: boolean; data?: PreviewResult; message?: string };
      if (!json.ok || !json.data) throw new Error(json.message || "预览失败");
      setPreview(json.data);
    } catch (e) {
      notify("error", e, "命名测试失败");
    }
  }

  return {
    testOpen,
    setTestOpen,
    testCode,
    setTestCode,
    testMosaic,
    setTestMosaic,
    testHasSub,
    setTestHasSub,
    testResolution,
    setTestResolution,
    preview,
    runPreview,
  };
}
