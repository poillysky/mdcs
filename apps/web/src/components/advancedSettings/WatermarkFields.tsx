import { SettingRow } from "../SettingRow";
import type { JobWatermarkOptions } from "../../lib/jobOptions";
import { Panel, Switch } from "./primitives";

export function WatermarkFields({
  value,
  onChange,
}: {
  value: JobWatermarkOptions;
  onChange: (next: JobWatermarkOptions) => void;
}) {
  function patch(partial: Partial<JobWatermarkOptions>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="水印">
        <SettingRow label="启用水印">
          <Switch checked={Boolean(value.enabled)} onChange={(v) => patch({ enabled: v })} />
        </SettingRow>
        <SettingRow label="位置">
          <select
            className="org-select"
            value={value.position || "top-right"}
            onChange={(e) => patch({ position: e.target.value })}
          >
            <option value="top-left">左上</option>
            <option value="top-right">右上</option>
            <option value="bottom-left">左下</option>
            <option value="bottom-right">右下</option>
          </select>
        </SettingRow>
        <SettingRow label="缩放 %">
          <input
            className="org-input"
            type="number"
            min={4}
            max={40}
            value={value.scalePercent ?? 12}
            onChange={(e) => patch({ scalePercent: Number(e.target.value) || 12 })}
          />
        </SettingRow>
        {(
          [
            ["markSubtitle", "标记字幕"],
            ["markCracked", "标记破解"],
            ["markLeak", "标记流出"],
            ["markUncensored", "标记无码"],
            ["markCensored", "标记有码"],
          ] as const
        ).map(([key, label]) => (
          <SettingRow key={key} label={label}>
            <Switch checked={Boolean(value[key])} onChange={(v) => patch({ [key]: v })} />
          </SettingRow>
        ))}
      </Panel>
    </div>
  );
}
