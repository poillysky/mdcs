import { FolderPicker } from "../../components/FolderPicker";
import { SettingRow } from "../../components/SettingRow";
import type { NotifyFn } from "../../lib/notify";
import type { Wm } from "./types";
import { Section } from "./widgets";

export function WatermarkStyleSection({
  w,
  styleSelectOptions,
  notify,
  patch,
}: {
  w: Wm;
  styleSelectOptions: string[];
  notify: NotifyFn;
  patch: (partial: Partial<Wm>) => void;
}) {
  return (
    <Section title="样式与资源">
      <SettingRow label="水印样式" hint="对应 assets/watermarks/{样式名}；自定义目录优先">
        <select
          className="org-select"
          value={w.style || "default"}
          onChange={(e) => patch({ style: e.target.value })}
        >
          {styleSelectOptions.map((id) => (
            <option key={id} value={id}>
              {id === "default" ? "默认" : id}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="水印样式 (4K, 8K)" hint="分辨率角标 PNG 目录，默认与基本样式相同">
        <select
          className="org-select"
          value={w.style4k || "default"}
          onChange={(e) => patch({ style4k: e.target.value })}
        >
          {styleSelectOptions.map((id) => (
            <option key={`4k-${id}`} value={id}>
              {id === "default" ? "默认" : id}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow
        label="自定义水印"
        hint="目录内 PNG：youma / wuma / umr / leak / sub / 4k / 8k"
        layout="stack"
      >
        <FolderPicker
          value={w.customDir || ""}
          onChange={(customDir) => patch({ customDir })}
          onError={(msg) => notify("error", msg)}
        />
      </SettingRow>
    </Section>
  );
}
