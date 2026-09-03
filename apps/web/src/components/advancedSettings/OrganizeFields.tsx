import { type ReactNode } from "react";
import { FolderPicker } from "../FolderPicker";
import { SettingRow } from "../SettingRow";
import type { JobOrganizeCleanupOptions, JobOrganizeOptions } from "../../lib/jobOptions";
import type { NotifyFn } from "../../lib/notify";
import { ORGANIZE_MODES } from "./organizeModes";
import { Panel, Switch, TagListEditor } from "./primitives";

export function OrganizeFields({
  value,
  onChange,
  notify,
  header,
  variant = "full",
}: {
  value: JobOrganizeOptions;
  onChange: (next: JobOrganizeOptions) => void;
  notify: NotifyFn;
  header?: ReactNode;
  /** kind：仅分区可持久化的整理字段；full：与设置·整理对齐的完整项 */
  variant?: "full" | "kind";
}) {
  const org = value;
  const modeHint = ORGANIZE_MODES.find((m) => m.value === org.organizeMode)?.hint;
  const cleanupOff = !org.cleanup?.enabled;
  const full = variant === "full";

  function patch(partial: Partial<JobOrganizeOptions>) {
    onChange({ ...org, ...partial });
  }

  function patchCleanup(partial: Partial<JobOrganizeCleanupOptions>) {
    patch({ cleanup: { ...org.cleanup, ...partial } });
  }

  return (
    <div className="advanced-job-settings">
      {header}
      <Panel title="整理模式">
        <SettingRow label="整理方式" hint={modeHint}>
          <select
            className="org-select"
            value={org.organizeMode}
            onChange={(e) => patch({ organizeMode: e.target.value })}
          >
            {ORGANIZE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="硬链/软链失败降级" hint="跨盘或权限失败时：复制继续，或直接失败">
          <select
            className="org-select"
            value={org.organizeFallback}
            onChange={(e) => patch({ organizeFallback: e.target.value })}
          >
            <option value="copy">降级为复制</option>
            <option value="fail">直接失败</option>
          </select>
        </SettingRow>
        {full ? (
          <SettingRow label="冲突策略">
            <select
              className="org-select"
              value={org.onConflict}
              onChange={(e) => patch({ onConflict: e.target.value })}
            >
              <option value="skip">跳过</option>
              <option value="overwrite">覆盖</option>
              <option value="rename">重命名</option>
            </select>
          </SettingRow>
        ) : null}
      </Panel>

      <Panel title="路径与覆盖">
        <SettingRow
          label="元数据目录"
          hint="视频以外文件放到另外的目录；留空则与视频同目录"
          layout="stack"
        >
          <FolderPicker
            value={org.metadataDir || ""}
            onChange={(relative) => patch({ metadataDir: relative })}
            onError={(msg) => notify("error", msg, "读取目录失败")}
          />
        </SettingRow>
        <SettingRow
          label="刮削出错时删除元数据目录"
          hint="开启后，刮削失败时删除已创建的封面/缓存与独立元数据子目录"
        >
          <Switch
            checked={Boolean(org.deleteMetadataOnFail)}
            onChange={(v) => patch({ deleteMetadataOnFail: v })}
          />
        </SettingRow>
        {full ? (
          <>
            <SettingRow label="覆盖目标目录视频和字幕" hint="目标已有视频/字幕时是否覆盖">
              <Switch
                checked={Boolean(org.overwriteVideoSubtitle)}
                onChange={(v) => patch({ overwriteVideoSubtitle: v })}
              />
            </SettingRow>
            <SettingRow label="覆盖目标目录图片" hint="目标已有海报/图片时是否覆盖">
              <Switch
                checked={Boolean(org.overwriteImages)}
                onChange={(v) => patch({ overwriteImages: v })}
              />
            </SettingRow>
          </>
        ) : (
          <p className="set-section-sub">
            冲突策略、扫描过滤与自动清理请在「设置 → 整理」全局配置；关闭「使用全局」后本分区仅覆盖上方整理参数。
          </p>
        )}
      </Panel>

      {full ? (
        <>
          <Panel title="扫描与识别过滤">
            <SettingRow label="文件大小过滤 (MB)" hint="小于此体积忽略；影响目录监控与扫描">
              <input
                className="org-input-sm"
                type="number"
                min={0}
                value={org.minFileSizeMb ?? 0}
                onChange={(e) => patch({ minFileSizeMb: Number(e.target.value) || 0 })}
              />
            </SettingRow>
            <SettingRow label="文件类型白名单" hint="仅列表内后缀视为视频" layout="stack">
              <TagListEditor
                values={org.videoExtensions ?? []}
                onChange={(videoExtensions) => patch({ videoExtensions })}
                placeholder="如 mp4"
              />
            </SettingRow>
            <SettingRow label="文件名黑名单" hint="文件名含条目则忽略" layout="stack">
              <TagListEditor
                values={org.filenameBlacklist ?? []}
                onChange={(filenameBlacklist) => patch({ filenameBlacklist })}
              />
            </SettingRow>
            <SettingRow
              label="文件名垃圾信息过滤"
              hint='解析番号时剔除；正则以 "r:" 开头'
              layout="stack"
            >
              <TagListEditor
                values={org.junkFilters ?? []}
                onChange={(junkFilters) => patch({ junkFilters })}
                placeholder="如 1080p 或 r:pattern"
              />
            </SettingRow>
            <SettingRow label="破解关键词" hint="匹配文件名与路径，不区分大小写" layout="stack">
              <TagListEditor
                values={org.crackKeywords ?? []}
                onChange={(crackKeywords) => patch({ crackKeywords })}
              />
            </SettingRow>
          </Panel>

          <Panel
            title="自动清理源目录"
            danger
            off={cleanupOff}
            headExtra={
              <Switch
                checked={Boolean(org.cleanup?.enabled)}
                onChange={(v) => patchCleanup({ enabled: v })}
              />
            }
          >
            <SettingRow label="白名单保护" hint="视频与补充白名单类型不会被清理">
              <Switch
                checked={org.cleanup?.whitelistProtect !== false}
                onChange={(v) => patchCleanup({ whitelistProtect: v })}
              />
            </SettingRow>
            <SettingRow label="删除小文件" hint="按上方体积规则">
              <Switch
                checked={Boolean(org.cleanup?.deleteSmallFiles)}
                onChange={(v) => patchCleanup({ deleteSmallFiles: v })}
              />
            </SettingRow>
            <SettingRow label="删除非白名单类型">
              <Switch
                checked={Boolean(org.cleanup?.deleteNonWhitelist)}
                onChange={(v) => patchCleanup({ deleteNonWhitelist: v })}
              />
            </SettingRow>
            <SettingRow label="删除黑名单命中">
              <Switch
                checked={Boolean(org.cleanup?.deleteBlacklist)}
                onChange={(v) => patchCleanup({ deleteBlacklist: v })}
              />
            </SettingRow>
            <SettingRow label="补充白名单后缀" hint="白名单保护开启时额外保留" layout="stack">
              <TagListEditor
                values={org.cleanup?.extraWhitelistExt ?? []}
                onChange={(extraWhitelistExt) => patchCleanup({ extraWhitelistExt })}
                placeholder="如 nfo, jpg"
              />
            </SettingRow>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
