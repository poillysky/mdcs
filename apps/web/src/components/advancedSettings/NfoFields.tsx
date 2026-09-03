import { SettingRow } from "../SettingRow";
import type { JobNfoOptions } from "../../lib/jobOptions";
import { Panel, Switch } from "./primitives";

export function NfoFields({
  value,
  onChange,
  variant = "full",
}: {
  value: JobNfoOptions;
  onChange: (next: JobNfoOptions) => void;
  variant?: "full" | "kind";
}) {
  function patch(partial: Partial<JobNfoOptions>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="NFO">
        {variant === "full" ? (
          <>
            <SettingRow label="写入演员">
              <Switch
                checked={value.writeActors !== false}
                onChange={(v) => patch({ writeActors: v })}
              />
            </SettingRow>
            <SettingRow label="写入类型标签">
              <Switch
                checked={value.writeGenres !== false}
                onChange={(v) => patch({ writeGenres: v })}
              />
            </SettingRow>
          </>
        ) : null}
        <SettingRow label="合并策略" hint="重刮/重整理时的字段优先级">
          <select
            className="org-select"
            value={value.mergeStrategy || "prefer_scraped"}
            onChange={(e) =>
              patch({
                mergeStrategy:
                  e.target.value === "prefer_nfo" ? "prefer_nfo" : "prefer_scraped",
              })
            }
          >
            <option value="prefer_scraped">刮削结果覆盖</option>
            <option value="prefer_nfo">本地非空优先</option>
          </select>
        </SettingRow>
        {variant === "kind" ? (
          <p className="set-section-sub">字段写入开关请在「设置 → NFO」全局配置；本分区可覆盖合并策略。</p>
        ) : null}
      </Panel>
    </div>
  );
}
