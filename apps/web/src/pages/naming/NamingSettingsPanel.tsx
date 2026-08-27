import { useEffect, useRef, useState } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../../api";
import { Modal } from "../../components/Modal";
import { SettingRow } from "../../components/SettingRow";
import type { ScrapeConfig } from "../../types";
import {
  CATEGORY_KIND_ITEMS,
  DEFAULT_NAMING,
  FIELD_TABS,
  type FieldTab,
  type Naming,
  type PreviewResult,
  type Props,
} from "./types";
import { MapGrid, Panel, TemplateInput } from "./widgets";
import { NamingSyntaxDoc } from "./NamingSyntaxDoc";

export function NamingSettingsPanel({
  notify,
  embedded = false,
  value,
  onChange,
}: Props) {
  const controlled = embedded && Boolean(value) && Boolean(onChange);
  const [config, setConfig] = useState<ScrapeConfig | null>(null);
  const [loading, setLoading] = useState(!controlled);
  const [saving, setSaving] = useState(false);
  const [fieldTab, setFieldTab] = useState<FieldTab>("category");
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testCode, setTestCode] = useState("SSIS-001");
  const [testMosaic, setTestMosaic] = useState("有码");
  const [testHasSub, setTestHasSub] = useState(false);
  const [testResolution, setTestResolution] = useState("1080P");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!controlled || !value) return;
    const mergedNaming = {
      ...DEFAULT_NAMING,
      ...value.naming,
      subtitleAddChsSuffix: Boolean(
        value.naming?.subtitleAddChsSuffix ?? value.download?.subtitleAddChsSuffix,
      ),
    };
    setConfig({ ...value, naming: mergedNaming });
    setLoading(false);
  }, [controlled, value]);

  useEffect(() => {
    if (controlled) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchScrapeConfig();
        const mergedNaming = {
          ...DEFAULT_NAMING,
          ...data.config.naming,
          subtitleAddChsSuffix: Boolean(
            data.config.naming?.subtitleAddChsSuffix ??
              data.config.download?.subtitleAddChsSuffix,
          ),
        };
        setConfig({
          ...data.config,
          naming: mergedNaming,
        });
      } catch (e) {
        notify("error", e, "加载命名配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [controlled, notify]);

  const naming = config ? ({ ...DEFAULT_NAMING, ...config.naming } as Naming) : null;

  function commit(next: ScrapeConfig) {
    setConfig(next);
    if (controlled) onChange?.(next);
  }

  function patchNaming(next: Partial<Naming>) {
    if (!config || !naming) return;
    commit({
      ...config,
      naming: { ...naming, ...next },
    });
  }

  async function save() {
    if (!config || !naming) return;
    setSaving(true);
    try {
      const next: ScrapeConfig = {
        ...config,
        naming,
        download: {
          ...config.download!,
          subtitleAddChsSuffix: Boolean(
            naming.subtitleAddChsSuffix ?? config.download?.subtitleAddChsSuffix,
          ),
        },
      };
      const { config: saved } = await saveScrapeConfig(next);
      setConfig({
        ...saved,
        naming: { ...DEFAULT_NAMING, ...saved.naming },
      });
      notify("ok", "全局命名配置已保存（分区未开专属时生效）");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    if (!naming) return;
    try {
      const res = await fetch("/api/organize/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "japan_censored",
          code: testCode,
          mosaic: testMosaic,
          hasSubtitle: testHasSub,
          resolution: testResolution,
          directoryTemplate: naming.directoryTemplate,
          fileNameTemplate: naming.fileNameTemplate,
          nameSuffixTemplate: naming.nameSuffixTemplate || "",
          videoSuffixTemplate: naming.videoSuffixTemplate,
          naming,
          title: `${testCode} 测试标题`,
          studio: "S1",
          series: "系列测试",
          actors: ["演员A", "演员B"],
        }),
      });
      const json = (await res.json()) as { ok: boolean; data?: PreviewResult; message?: string };
      if (!json.ok || !json.data) throw new Error(json.message || "预览失败");
      setPreview(json.data);
    } catch (e) {
      notify("error", e, "命名测试失败");
    }
  }

  function exportNaming() {
    if (!naming) return;
    const blob = new Blob([JSON.stringify(naming, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mdcs-naming-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("ok", "命名配置已导出");
  }

  function importNaming(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result || "{}")) as Partial<Naming>;
        patchNaming({ ...DEFAULT_NAMING, ...raw });
        notify("ok", "已导入，请确认后保存");
      } catch (e) {
        notify("error", e, "导入失败");
      }
    };
    reader.readAsText(file);
  }

  if (loading || !config || !naming) {
    return <div className="empty-block">加载命名配置…</div>;
  }

  const cat = { ...DEFAULT_NAMING.categoryLabels!, ...naming.categoryLabels };
  const mosaic = { ...DEFAULT_NAMING.mosaicLabels!, ...naming.mosaicLabels };
  const mosaicSuf = { ...DEFAULT_NAMING.mosaicSuffixLabels!, ...naming.mosaicSuffixLabels };
  const resEn = { ...DEFAULT_NAMING.resolutionEnabled!, ...naming.resolutionEnabled };
  const resSufEn = {
    ...DEFAULT_NAMING.resolutionSuffixEnabled!,
    ...naming.resolutionSuffixEnabled,
  };
  const rules = naming.categoryRules || [];

  return (
    <div className="naming-settings">
      <div className="naming-main">
          <button
            type="button"
            className="naming-syntax naming-syntax-trigger"
            onClick={() => setSyntaxOpen(true)}
          >
            <div className="naming-syntax-top">
              <div className="naming-syntax-title">模板语法</div>
              <span className="naming-syntax-more">查看完整说明</span>
            </div>
            <div className="naming-syntax-chips">
              <code className="naming-chip">{"{number}"}</code>
              <code className="naming-chip">{"{{ number }}"}</code>
              <code className="naming-chip">{"{% if %}"}</code>
              <code className="naming-chip">filter</code>
            </div>
            <p className="naming-syntax-note">
              以下命名规则均支持变量模板。点击展开 Filter、条件判断、实用示例与可用变量。
            </p>
          </button>

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
                    <SettingRow
                      label="Fallback 模式"
                      hint="主方式无效时尝试其他方式"
                    >
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

          <Panel id="naming-suffix" title="视频命名后缀">
            <div className="naming-suffix">
              <div className="naming-suffix-lead">
                <p>
                  刮削后追加到视频文件名后面。下方用 {"{}"} 配置各段；字段不存在则忽略。
                  默认示例：破解无码中字 →{" "}
                  <code>ABC-123-破解-C.mp4</code>（需将字幕后缀设为{" "}
                  <code>-C</code>）。
                </p>
                <div className="naming-suffix-fields">
                  <span>
                    <code>{"{mosaic}"}</code> 马赛克
                  </span>
                  <span>
                    <code>{"{subtitle}"}</code> 中文字幕
                  </span>
                  <span>
                    <code>{"{resolution}"}</code> 分辨率
                  </span>
                  <span>
                    <code>{"{part}"}</code> 分集
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
                <SettingRow
                  label="无码破解"
                  hint="检测到无码破解时，替换后缀中的 {mosaic}"
                >
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
                <SettingRow
                  label="无码流出"
                  hint="检测到无码流出时，替换后缀中的 {mosaic}"
                >
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
                <SettingRow
                  label="字幕后缀"
                  hint="有中文字幕时替换 {subtitle}；留空不追加"
                >
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
                  hint="自动检测后替换后缀中的 {resolution}；留空不追加"
                  layout="stack"
                >
                  <TemplateInput
                    value={naming.resolutionSuffixTemplate || ""}
                    onChange={(v) => patchNaming({ resolutionSuffixTemplate: v })}
                    fieldHint="分辨率后缀"
                    notify={notify}
                    placeholder="如 -{resolution}"
                  />
                </SettingRow>
                <div className="naming-res-block naming-res-block--in-suffix">
                  <div className="naming-res-block-head">
                    <span className="naming-res-block-title">生效的分辨率类型</span>
                    <span className="naming-res-block-hint">
                      关闭后该分辨率不添加对应后缀
                    </span>
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

          <div className="page-save-row naming-actions">
            <button type="button" className="btn" onClick={exportNaming}>
              导出
            </button>
            <button type="button" className="btn" onClick={() => fileImportRef.current?.click()}>
              导入
            </button>
            <input
              ref={fileImportRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importNaming(f);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn" onClick={() => setTestOpen(true)}>
              命名测试
            </button>
            {!embedded ? (
              <button
                type="button"
                className="btn primary"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "保存中…" : "保存配置"}
              </button>
            ) : null}
          </div>
      </div>

      <Modal
        open={syntaxOpen}
        title="模板语法"
        wide
        onClose={() => setSyntaxOpen(false)}
        footer={
          <button type="button" className="btn primary" onClick={() => setSyntaxOpen(false)}>
            知道了
          </button>
        }
      >
        <NamingSyntaxDoc />
      </Modal>

      <Modal
        open={testOpen}
        title="命名测试"
        subtitle="用当前未保存的模板规则预览路径与标题"
        onClose={() => setTestOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setTestOpen(false)}>
              关闭
            </button>
            <button type="button" className="btn primary" onClick={() => void runPreview()}>
              生成预览
            </button>
          </>
        }
      >
        <div className="naming-test-modal">
          <div className="naming-test-modal-grid">
            <label className="naming-test-field">
              <span>番号</span>
              <input
                className="org-input"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
              />
            </label>
            <label className="naming-test-field">
              <span>马赛克</span>
              <input
                className="org-input"
                value={testMosaic}
                onChange={(e) => setTestMosaic(e.target.value)}
              />
            </label>
            <label className="naming-test-field">
              <span>分辨率</span>
              <select
                className="org-input"
                value={testResolution}
                onChange={(e) => setTestResolution(e.target.value)}
              >
                {["720P", "1080P", "4K", "8K"].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="naming-test-switch">
              <span>有字幕</span>
              <label className="switch inline">
                <input
                  type="checkbox"
                  checked={testHasSub}
                  onChange={(e) => setTestHasSub(e.target.checked)}
                />
                <span />
              </label>
            </label>
          </div>
          <div className={`naming-preview${preview ? " has-result" : ""}`}>
            {preview ? (
              <>
                <div className="naming-preview-row">
                  <span>路径</span>
                  <code>{preview.targetRel}</code>
                </div>
                <div className="naming-preview-row">
                  <span>标题</span>
                  <code>{preview.mediaTitle || "-"}</code>
                </div>
              </>
            ) : (
              <p className="naming-preview-empty">填写样例后点「生成预览」</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

