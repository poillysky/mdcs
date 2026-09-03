import { FolderPicker } from "../FolderPicker";
import { SettingRow } from "../SettingRow";
import type { JobDownloadOptions } from "../../lib/jobOptions";
import type { NotifyFn } from "../../lib/notify";
import { Panel, Switch } from "./primitives";

export function DownloadFields({
  value,
  onChange,
  notify,
  variant = "full",
}: {
  value: JobDownloadOptions;
  onChange: (next: JobDownloadOptions) => void;
  notify: NotifyFn;
  variant?: "full" | "kind";
}) {
  const dl = value;

  function patch(partial: Partial<JobDownloadOptions>) {
    const next = { ...dl, ...partial };
    if (typeof partial.amazonHdPoster === "boolean") {
      next.skipAmazon = !partial.amazonHdPoster;
    } else if (typeof partial.skipAmazon === "boolean") {
      next.amazonHdPoster = !partial.skipAmazon;
    }
    onChange(next);
  }

  return (
    <div className="advanced-job-settings">
      <Panel title="下载内容">
        <SettingRow
          label="海报 / 封面图 / poster"
          hint="整理时写入 poster.jpg"
        >
          <Switch checked={Boolean(dl.downloadPoster)} onChange={(v) => patch({ downloadPoster: v })} />
        </SettingRow>
        <SettingRow label="缩略图 / thumb" hint="建议开启；整理时写入 thumb.jpg">
          <Switch checked={Boolean(dl.downloadThumb)} onChange={(v) => patch({ downloadThumb: v })} />
        </SettingRow>
        <SettingRow
          label="剧照 / extrafanart"
          hint="整理时下载剧照到 extrafanart/ 目录"
        >
          <Switch checked={Boolean(dl.downloadFanart)} onChange={(v) => patch({ downloadFanart: v })} />
        </SettingRow>
      </Panel>
      {variant === "full" ? (
        <Panel title="缩略图下载策略">
          <SettingRow label="选图策略" hint="多候选时按数据源优先级或图片体积">
            <select
              className="org-select"
              value={dl.coverDownloadStrategy || "priority"}
              onChange={(e) => patch({ coverDownloadStrategy: e.target.value })}
            >
              <option value="priority">根据字段优先级</option>
              <option value="size">根据图片质量（较慢）</option>
            </select>
          </SettingRow>
        </Panel>
      ) : null}
      <Panel title="高清海报">
        <SettingRow label="Amazon 高清海报" hint="用标题/番号搜 Amazon JP DVD 高清图">
          <Switch checked={Boolean(dl.amazonHdPoster)} onChange={(v) => patch({ amazonHdPoster: v })} />
        </SettingRow>
        <SettingRow label="Tenhow 高清海报" hint="用演员名在 tenhow.net 检索 ASIN 高清图">
          <Switch checked={Boolean(dl.tenhowHdPoster)} onChange={(v) => patch({ tenhowHdPoster: v })} />
        </SettingRow>
        <SettingRow label="DMM 优先高清">
          <Switch
            checked={Boolean(dl.preferHighResPoster)}
            onChange={(v) => patch({ preferHighResPoster: v })}
          />
        </SettingRow>
        <SettingRow label="Amazon 严格模式" hint="Amazon 失败且无 Tenhow 兜底时中止刮削">
          <Switch
            checked={Boolean(dl.amazonStrictMode)}
            disabled={!dl.amazonHdPoster}
            onChange={(v) => patch({ amazonStrictMode: v })}
          />
        </SettingRow>
      </Panel>
      <Panel title="字幕与裁剪">
        <SettingRow label="字幕库路径" layout="stack">
          <FolderPicker
            value={dl.subtitleLibraryPath || ""}
            onChange={(relative) => patch({ subtitleLibraryPath: relative })}
            onError={(msg) => notify("error", msg, "读取目录失败")}
          />
        </SettingRow>
        <SettingRow label="海报裁剪比例">
          <select
            className="org-select"
            value={dl.cropRatio || "full"}
            onChange={(e) =>
              patch({
                cropRatio: e.target.value === "emby" ? "emby" : "full",
              })
            }
          >
            <option value="full">完整</option>
            <option value="emby">Emby 竖版</option>
          </select>
        </SettingRow>
        <SettingRow label="独立裁剪海报">
          <Switch
            checked={Boolean(dl.cropIndependentPoster)}
            onChange={(v) => patch({ cropIndependentPoster: v })}
          />
        </SettingRow>
        <SettingRow label="优先使用裁剪结果">
          <Switch
            checked={Boolean(dl.preferCropResult)}
            onChange={(v) => patch({ preferCropResult: v })}
          />
        </SettingRow>
      </Panel>
    </div>
  );
}
