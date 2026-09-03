import { useState } from "react";
import { SettingRow } from "../../components/SettingRow";
import {
  CATEGORY_KIND_ITEMS,
  DEFAULT_NAMING,
  FIELD_TABS,
  type FieldTab,
  type Naming,
} from "./types";
import { MapGrid, Panel } from "./widgets";

export function NamingFieldMapsPanel({
  naming,
  patchNaming,
}: {
  naming: Naming;
  patchNaming: (next: Partial<Naming>) => void;
}) {
  const [fieldTab, setFieldTab] = useState<FieldTab>("category");
  const cat = { ...DEFAULT_NAMING.categoryLabels!, ...naming.categoryLabels };
  const mosaic = { ...DEFAULT_NAMING.mosaicLabels!, ...naming.mosaicLabels };
  const resEn = { ...DEFAULT_NAMING.resolutionEnabled!, ...naming.resolutionEnabled };
  const rules = naming.categoryRules || [];

  return (
    <Panel id="naming-fields" title="字段映射">
      <div className="naming-field-tabs" role="tablist">
        {FIELD_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={fieldTab === t.id}
            className={`naming-field-tab${fieldTab === t.id ? " is-active" : ""}`}
            onClick={() => setFieldTab(t.id)}
          >
            <span>{t.label}</span>
            <code>{`{${t.field}}`}</code>
          </button>
        ))}
      </div>

      <div className="naming-field-pane">
        {fieldTab === "category" ? (
          <>
            <MapGrid
              items={CATEGORY_KIND_ITEMS}
              values={cat}
              onChange={(key, value) =>
                patchNaming({ categoryLabels: { ...cat, [key]: value } })
              }
            />
            <div className="naming-subblock">
              <div className="naming-subblock-head">
                <span>自定义规则</span>
                <span className="naming-subblock-hint">正则匹配路径/番号，按序首条命中</span>
              </div>
              <div className="naming-rules">
                {rules.map((r, i) => (
                  <div key={r.id || i} className="naming-rule-row">
                    <input
                      className="org-input naming-mono"
                      placeholder="正则，如 FC2"
                      value={r.pattern}
                      onChange={(e) => {
                        const next = rules.map((x, j) =>
                          j === i ? { ...x, pattern: e.target.value } : x,
                        );
                        patchNaming({ categoryRules: next });
                      }}
                    />
                    <input
                      className="org-input"
                      placeholder="写入的分类名"
                      value={r.category}
                      onChange={(e) => {
                        const next = rules.map((x, j) =>
                          j === i ? { ...x, category: e.target.value } : x,
                        );
                        patchNaming({ categoryRules: next });
                      }}
                    />
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() =>
                        patchNaming({
                          categoryRules: rules.filter((_, j) => j !== i),
                        })
                      }
                    >
                      删
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn sm"
                  onClick={() =>
                    patchNaming({
                      categoryRules: [
                        ...rules,
                        { id: `r_${Date.now()}`, pattern: "", category: "" },
                      ],
                    })
                  }
                >
                  + 添加规则
                </button>
              </div>
            </div>
          </>
        ) : null}

        {fieldTab === "mosaic" ? (
          <MapGrid
            items={
              [
                ["cracked", "无码破解"],
                ["leak", "无码流出"],
                ["uncensored", "无码"],
                ["censored", "有码"],
              ] as const
            }
            values={mosaic}
            onChange={(key, value) =>
              patchNaming({ mosaicLabels: { ...mosaic, [key]: value } })
            }
          />
        ) : null}

        {fieldTab === "subtitle" ? (
          <div className="naming-pair-grid">
            <SettingRow label="有字幕时">
              <input
                className="org-input"
                value={naming.subtitleLabel || ""}
                onChange={(e) => patchNaming({ subtitleLabel: e.target.value })}
              />
            </SettingRow>
            <SettingRow label="无字幕时">
              <input
                className="org-input"
                value={naming.noSubtitleLabel || ""}
                onChange={(e) => patchNaming({ noSubtitleLabel: e.target.value })}
              />
            </SettingRow>
          </div>
        ) : null}

        {fieldTab === "resolution" ? (
          <div className="naming-res">
            <SettingRow
              label="分辨率字段配置"
              hint="自动检测后替换命名中的 {resolution}；留空则用下方显示方式"
              layout="stack"
            >
              <input
                className="org-input naming-mono"
                value={naming.resolutionFieldTemplate || ""}
                onChange={(e) =>
                  patchNaming({ resolutionFieldTemplate: e.target.value })
                }
                placeholder={"留空则使用 '{resolution_text}'"}
                spellCheck={false}
              />
            </SettingRow>

            <SettingRow
              label="分辨率显示方式"
              hint="用于替换上方的 {resolution_text}"
              layout="stack"
            >
              <select
                className="org-input"
                value={
                  [
                    "720P, 1080P, 4K, 8K",
                    "720p, 1080p, 2160p, 4320p",
                    "HD, FHD, 4K, 8K",
                  ].includes(naming.resolutionTextMap || "")
                    ? naming.resolutionTextMap
                    : naming.resolutionTextMap || "720P, 1080P, 4K, 8K"
                }
                onChange={(e) => patchNaming({ resolutionTextMap: e.target.value })}
              >
                <option value="720P, 1080P, 4K, 8K">720P, 1080P, 4K, 8K</option>
                <option value="720p, 1080p, 2160p, 4320p">
                  720p, 1080p, 2160p, 4320p
                </option>
                <option value="HD, FHD, 4K, 8K">HD, FHD, 4K, 8K</option>
                {naming.resolutionTextMap &&
                ![
                  "720P, 1080P, 4K, 8K",
                  "720p, 1080p, 2160p, 4320p",
                  "HD, FHD, 4K, 8K",
                ].includes(naming.resolutionTextMap) ? (
                  <option value={naming.resolutionTextMap}>
                    {naming.resolutionTextMap}
                  </option>
                ) : null}
              </select>
            </SettingRow>

            <div className="naming-res-block">
              <div className="naming-res-block-head">
                <span className="naming-res-block-title">生效的分辨率类型</span>
                <span className="naming-res-block-hint">
                  关闭后该档使用「未生效」字段替换
                </span>
              </div>
              <div className="naming-res-toggles">
                {(["720P", "1080P", "4K", "8K"] as const).map((k) => (
                  <label
                    key={k}
                    className={`naming-res-toggle${resEn[k] !== false ? " is-on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={resEn[k] !== false}
                      onChange={(e) =>
                        patchNaming({
                          resolutionEnabled: { ...resEn, [k]: e.target.checked },
                        })
                      }
                    />
                    <span className="naming-res-toggle-mark" aria-hidden />
                    <span className="naming-res-toggle-label">{k}</span>
                  </label>
                ))}
              </div>
            </div>

            <SettingRow
              label="未生效分辨率字段"
              hint="检测到的分辨率不在生效名单时，替换 {resolution}"
              layout="stack"
            >
              <input
                className="org-input"
                value={naming.resolutionInactiveLabel || ""}
                onChange={(e) =>
                  patchNaming({ resolutionInactiveLabel: e.target.value })
                }
                placeholder="1080P"
              />
            </SettingRow>

            <div className="naming-res-block naming-res-block--detect">
              <div className="naming-res-block-head">
                <span className="naming-res-block-title">分辨率信息获取</span>
              </div>
              <SettingRow label="获取方式" layout="stack">
                <select
                  className="org-input"
                  value={naming.resolutionSource || "prefer_path"}
                  onChange={(e) =>
                    patchNaming({
                      resolutionSource: e.target.value as Naming["resolutionSource"],
                    })
                  }
                >
                  <option value="prefer_path">优先使用文件名和路径中信息</option>
                  <option value="prefer_probe">优先使用视频真实分辨率</option>
                  <option value="path">仅文件名和路径</option>
                  <option value="probe">仅视频真实分辨率</option>
                </select>
              </SettingRow>
              <SettingRow label="Fallback 模式" hint="主方式无效时尝试其他方式">
                <label className="switch inline">
                  <input
                    type="checkbox"
                    checked={naming.resolutionFallback !== false}
                    onChange={(e) =>
                      patchNaming({ resolutionFallback: e.target.checked })
                    }
                  />
                  <span />
                </label>
              </SettingRow>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
