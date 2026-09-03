import { SettingRow } from "../../components/SettingRow";
import type { NotifyFn } from "../../lib/notify";
import type { Naming } from "./types";
import { Panel, TemplateInput } from "./widgets";

export function NamingCorePanel({
  naming,
  patchNaming,
  notify,
}: {
  naming: Naming;
  patchNaming: (next: Partial<Naming>) => void;
  notify: NotifyFn;
}) {
  return (
    <Panel id="naming-core" title="核心命名" badge="常用">
      <SettingRow label="目录命名规则" hint="刮削成功后创建的相对目录" layout="stack">
        <TemplateInput
          value={naming.directoryTemplate}
          onChange={(v) => patchNaming({ directoryTemplate: v })}
          fieldHint="目录路径"
          notify={notify}
        />
      </SettingRow>
      <SettingRow label="视频命名规则" layout="stack">
        <TemplateInput
          value={naming.fileNameTemplate || "{number}"}
          onChange={(v) => patchNaming({ fileNameTemplate: v })}
          fieldHint="视频文件名"
          notify={notify}
        />
      </SettingRow>
      <SettingRow label="Emby / Plex 标题" layout="stack">
        <TemplateInput
          value={naming.mediaTitleTemplate || "{title}"}
          onChange={(v) => patchNaming({ mediaTitleTemplate: v })}
          fieldHint="媒体库显示标题"
          notify={notify}
        />
      </SettingRow>
      <div className="naming-pair-grid">
        <SettingRow label="目录最大长度" hint="0 = 不限">
          <input
            className="org-input-sm"
            type="number"
            min={0}
            value={naming.maxDirectoryLength ?? 0}
            onChange={(e) =>
              patchNaming({
                maxDirectoryLength: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </SettingRow>
        <SettingRow label="演员数量上限" hint="超出则显示「多人作品」">
          <input
            className="org-input-sm"
            type="number"
            min={0}
            value={naming.actorDisplayLimit ?? 3}
            onChange={(e) =>
              patchNaming({
                actorDisplayLimit: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </SettingRow>
      </div>
      <SettingRow label="图片命名">
        <select
          className="org-input"
          value={naming.imageNameMode === "video" ? "video" : "none"}
          onChange={(e) =>
            patchNaming({
              imageNameMode: e.target.value === "video" ? "video" : "none",
            })
          }
        >
          <option value="none">不添加前缀（poster.jpg）</option>
          <option value="video">添加视频前缀（视频名-poster.jpg）</option>
        </select>
      </SettingRow>
    </Panel>
  );
}
