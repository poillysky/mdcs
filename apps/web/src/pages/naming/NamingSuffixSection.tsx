import { SettingRow } from "../../components/SettingRow";
import type { NotifyFn } from "../../lib/notify";
import type { ScrapeConfig } from "../../types";
import { DEFAULT_NAMING, type Naming } from "./types";
import { Panel, TemplateInput } from "./widgets";

export function NamingSuffixSection({
  naming,
  config,
  patchNaming,
  commit,
  notify,
}: {
  naming: Naming;
  config: ScrapeConfig;
  patchNaming: (next: Partial<Naming>) => void;
  commit: (next: ScrapeConfig) => void;
  notify: NotifyFn;
}) {
  const mosaicSuf = {
    ...DEFAULT_NAMING.mosaicSuffixLabels!,
    ...naming.mosaicSuffixLabels,
  };
  const resSufEn = {
    ...DEFAULT_NAMING.resolutionSuffixEnabled!,
    ...naming.resolutionSuffixEnabled,
  };

  return (
    <Panel id="naming-suffix" title="视频命名后缀">
      <div className="naming-suffix">
        <div className="naming-suffix-lead">
          <p>
            刮削后追加到视频文件名后面。总模板里的 {"{mosaic}"} / {"{subtitle}"} /{" "}
            {"{resolution}"} / {"{part}"} 分别取下方「后缀文案」，与「字段映射」里的显示文案无关；某段留空则该段不追加。
            默认示例：破解 + 字幕后缀 -C → <code>ABC-123-破解-C.mp4</code>。
          </p>
          <div className="naming-suffix-fields">
            <span>
              <code>{"{mosaic}"}</code> 马赛克后缀
            </span>
            <span>
              <code>{"{subtitle}"}</code> 字幕后缀
            </span>
            <span>
              <code>{"{resolution}"}</code> 分辨率后缀
            </span>
            <span>
              <code>{"{part}"}</code> 分集后缀
            </span>
          </div>
        </div>

        <SettingRow
          label="视频命名后缀"
          hint="描述需求可用 ✦；推荐 {mosaic}{subtitle}{resolution}{part}"
          layout="stack"
        >
          <TemplateInput
            value={naming.videoSuffixTemplate || ""}
            onChange={(v) => patchNaming({ videoSuffixTemplate: v })}
            fieldHint="视频命名后缀模板"
            notify={notify}
            placeholder="{mosaic}{subtitle}{resolution}{part}"
          />
        </SettingRow>

        <div className="naming-suffix-sec">
          <div className="naming-suffix-sec-head">
            <span className="naming-suffix-sec-title">后缀 · 马赛克</span>
            <code>{"{mosaic}"}</code>
          </div>
          <SettingRow label="无码破解" hint="检测到无码破解时，替换后缀中的 {mosaic}">
            <input
              className="org-input"
              value={mosaicSuf.cracked || ""}
              onChange={(e) =>
                patchNaming({
                  mosaicSuffixLabels: { ...mosaicSuf, cracked: e.target.value },
                })
              }
              placeholder="-破解"
            />
          </SettingRow>
          <SettingRow label="无码流出" hint="检测到无码流出时，替换后缀中的 {mosaic}">
            <input
              className="org-input"
              value={mosaicSuf.leak || ""}
              onChange={(e) =>
                patchNaming({
                  mosaicSuffixLabels: { ...mosaicSuf, leak: e.target.value },
                })
              }
              placeholder="-流出"
            />
          </SettingRow>
          <SettingRow label="无码" hint="留空则不添加此后缀">
            <input
              className="org-input"
              value={mosaicSuf.uncensored || ""}
              onChange={(e) =>
                patchNaming({
                  mosaicSuffixLabels: {
                    ...mosaicSuf,
                    uncensored: e.target.value,
                  },
                })
              }
              placeholder="留空则不添加"
            />
          </SettingRow>
          <SettingRow label="有码" hint="留空则不添加此后缀">
            <input
              className="org-input"
              value={mosaicSuf.censored || ""}
              onChange={(e) =>
                patchNaming({
                  mosaicSuffixLabels: { ...mosaicSuf, censored: e.target.value },
                })
              }
              placeholder="留空则不添加"
            />
          </SettingRow>
        </div>

        <div className="naming-suffix-sec">
          <div className="naming-suffix-sec-head">
            <span className="naming-suffix-sec-title">后缀 · 中文字幕</span>
            <code>{"{subtitle}"}</code>
          </div>
          <SettingRow label="字幕后缀" hint="有中文字幕时填入总模板 {subtitle}；留空不追加（如 -C）">
            <input
              className="org-input"
              value={naming.subtitleSuffixLabel || ""}
              onChange={(e) => patchNaming({ subtitleSuffixLabel: e.target.value })}
              placeholder="如 -C"
            />
          </SettingRow>
          <SettingRow
            label="字幕添加 .chs"
            hint="开启后在扩展名前加 .chs，如 ABC-123.chs.srt"
          >
            <label className="switch inline">
              <input
                type="checkbox"
                checked={Boolean(naming.subtitleAddChsSuffix)}
                onChange={(e) => {
                  const on = e.target.checked;
                  commit({
                    ...config,
                    naming: { ...naming, subtitleAddChsSuffix: on },
                    download: {
                      ...config.download!,
                      subtitleAddChsSuffix: on,
                    },
                  });
                }}
              />
              <span />
            </label>
          </SettingRow>
        </div>

        <div className="naming-suffix-sec">
          <div className="naming-suffix-sec-head">
            <span className="naming-suffix-sec-title">后缀 · 分集</span>
            <code>{"{part}"}</code>
          </div>
          <SettingRow
            label="分集后缀模板"
            hint="支持 {part}（1,2,3）与 {part_letter}（A,B,C）"
            layout="stack"
          >
            <TemplateInput
              value={naming.partSuffixTemplate || "-cd{part}"}
              onChange={(v) => patchNaming({ partSuffixTemplate: v })}
              fieldHint="分集后缀"
              notify={notify}
              placeholder="-cd{part}"
            />
          </SettingRow>
        </div>

        <div className="naming-suffix-sec">
          <div className="naming-suffix-sec-head">
            <span className="naming-suffix-sec-title">后缀 · 分辨率</span>
            <code>{"{resolution}"}</code>
          </div>
          <SettingRow
            label="分辨率后缀"
            hint="总模板中的 {resolution} 取此文案；默认 -{resolution}；清空则不追加"
            layout="stack"
          >
            <TemplateInput
              value={naming.resolutionSuffixTemplate || ""}
              onChange={(v) => patchNaming({ resolutionSuffixTemplate: v })}
              fieldHint="分辨率后缀"
              notify={notify}
              placeholder="-{resolution}"
            />
          </SettingRow>
          <div className="naming-res-block naming-res-block--in-suffix">
            <div className="naming-res-block-head">
              <span className="naming-res-block-title">生效的分辨率类型</span>
              <span className="naming-res-block-hint">关闭后该分辨率不添加对应后缀</span>
            </div>
            <div className="naming-res-toggles">
              {(["720P", "1080P", "4K", "8K"] as const).map((k) => (
                <label
                  key={k}
                  className={`naming-res-toggle${resSufEn[k] !== false ? " is-on" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={resSufEn[k] !== false}
                    onChange={(e) =>
                      patchNaming({
                        resolutionSuffixEnabled: {
                          ...resSufEn,
                          [k]: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className="naming-res-toggle-mark" aria-hidden />
                  <span className="naming-res-toggle-label">{k}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <SettingRow
          label="兼容旧后缀"
          hint="分区专属仍可读；全局优先用上方总模板"
          layout="stack"
        >
          <input
            className="org-input naming-mono"
            value={naming.nameSuffixTemplate || ""}
            onChange={(e) => patchNaming({ nameSuffixTemplate: e.target.value })}
            placeholder="{mosaic}"
            spellCheck={false}
          />
        </SettingRow>
      </div>
    </Panel>
  );
}
