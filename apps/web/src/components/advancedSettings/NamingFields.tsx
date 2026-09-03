import { SettingRow } from "../SettingRow";
import type { JobNamingOptions } from "../../lib/jobOptions";
import { Panel } from "./primitives";

export function NamingFields({
  value,
  onChange,
}: {
  value: JobNamingOptions;
  onChange: (next: JobNamingOptions) => void;
}) {
  function patch(partial: Partial<JobNamingOptions>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="命名模板">
        <SettingRow label="目录模板" layout="stack">
          <input
            className="org-input"
            value={value.directoryTemplate || ""}
            onChange={(e) => patch({ directoryTemplate: e.target.value })}
            placeholder="{category}/{studio}/{number}"
          />
        </SettingRow>
        <SettingRow label="文件名模板" layout="stack">
          <input
            className="org-input"
            value={value.fileNameTemplate || ""}
            onChange={(e) => patch({ fileNameTemplate: e.target.value })}
            placeholder="{number}"
          />
        </SettingRow>
        <SettingRow label="文件名后缀" layout="stack">
          <input
            className="org-input"
            value={value.nameSuffixTemplate || ""}
            onChange={(e) => patch({ nameSuffixTemplate: e.target.value })}
            placeholder="如 -{mosaic}"
          />
        </SettingRow>
        <SettingRow label="海报裁剪">
          <select
            className="org-select"
            value={value.posterCrop || "right"}
            onChange={(e) => patch({ posterCrop: e.target.value })}
          >
            <option value="right">右裁</option>
            <option value="none">不裁</option>
            <option value="face">人脸（失败居中）</option>
          </select>
        </SettingRow>
      </Panel>
    </div>
  );
}
