import { SettingRow } from "../SettingRow";
import type { JobMetadataOptions } from "../../lib/jobOptions";
import { Panel, Switch } from "./primitives";

export function MetadataFields({
  value,
  onChange,
}: {
  value: JobMetadataOptions;
  onChange: (next: JobMetadataOptions) => void;
}) {
  function patch(partial: Partial<JobMetadataOptions>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="数据校验">
        <SettingRow label="启用严格字段模式" hint="关键字段缺失时触发完整性校验，防止漏刮数据">
          <Switch checked={Boolean(value.strictMode)} onChange={(v) => patch({ strictMode: v })} />
        </SettingRow>
        <SettingRow label="强制校验图片结果" hint="封面或缩略图未成功刮削时视为失败">
          <Switch checked={Boolean(value.requireCover)} onChange={(v) => patch({ requireCover: v })} />
        </SettingRow>
      </Panel>
      <Panel title="元数据优化">
        <SettingRow label="使用色花堂中文标题" hint="番号匹配时优先使用色花堂中文标题">
          <Switch
            checked={Boolean(value.useForumZhTitle)}
            onChange={(v) => patch({ useForumZhTitle: v })}
          />
        </SettingRow>
        <SettingRow label="启用演员数据映射">
          <Switch
            checked={Boolean(value.enableActorMapping)}
            onChange={(v) => patch({ enableActorMapping: v })}
          />
        </SettingRow>
        <SettingRow label="启用标签数据映射">
          <Switch
            checked={Boolean(value.enableTagMapping)}
            onChange={(v) => patch({ enableTagMapping: v })}
          />
        </SettingRow>
        <SettingRow label="精简多余的换行符（简介）">
          <Switch checked={Boolean(value.trimPlot)} onChange={(v) => patch({ trimPlot: v })} />
        </SettingRow>
        <SettingRow label="自动翻译标题">
          <Switch
            checked={Boolean(value.autoTranslateTitle)}
            onChange={(v) => patch({ autoTranslateTitle: v })}
          />
        </SettingRow>
        <SettingRow label="自动翻译简介">
          <Switch
            checked={Boolean(value.autoTranslateOutline)}
            onChange={(v) => patch({ autoTranslateOutline: v })}
          />
        </SettingRow>
      </Panel>
    </div>
  );
}
