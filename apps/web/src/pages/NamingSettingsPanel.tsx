import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../api";
import { Modal } from "../components/Modal";
import { SettingRow } from "../components/SettingRow";
import { generateNamingTemplate, hasLlmConfigured } from "../lib/llmNaming";
import { KIND_LABELS } from "../lib/labels";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

type Props = {
  notify: NotifyFn;
};

type Naming = NonNullable<ScrapeConfig["naming"]>;

type PreviewResult = {
  targetRel: string;
  fileName: string;
  relativeDir: string;
  mediaTitle?: string;
};

type FieldTab = "category" | "mosaic" | "subtitle" | "resolution";

const DEFAULT_NAMING: Naming = {
  directoryTemplate: "{category}/{studio}/{series_name}/{number}",
  mediaTitleTemplate: "{title}",
  fileNameTemplate: "{number}",
  imageNameMode: "none",
  maxDirectoryLength: 0,
  actorDisplayLimit: 3,
  nameSuffixTemplate: "",
  videoSuffixTemplate: "{mosaic}{subtitle}{resolution}{part}",
  posterCrop: "right",
  categoryLabels: {
    japan_censored: "日本有码",
    japan_gravure: "日本写真",
    japan_uncensored: "日本无码",
    japan_amateur: "素人",
    fc2: "FC2",
    china: "国产",
    western: "欧美",
    unknown: "未知",
  },
  categoryRules: [],
  mosaicLabels: {
    cracked: "无码破解",
    leak: "无码流出",
    uncensored: "无码",
    censored: "有码",
  },
  mosaicSuffixLabels: {
    cracked: "-破解",
    leak: "-流出",
    uncensored: "",
    censored: "",
  },
  subtitleLabel: "中字",
  noSubtitleLabel: "无字幕",
  subtitleSuffixLabel: "",
  subtitleAddChsSuffix: false,
  partSuffixTemplate: "-cd{part}",
  resolutionFieldTemplate: "",
  resolutionTextMap: "720P, 1080P, 4K, 8K",
  resolutionEnabled: { "720P": true, "1080P": true, "4K": true, "8K": true },
  resolutionInactiveLabel: "1080P",
  resolutionSuffixTemplate: "",
  resolutionSuffixEnabled: { "720P": true, "1080P": true, "4K": true, "8K": true },
  resolutionSource: "prefer_path",
  resolutionFallback: true,
};

const CATEGORY_KIND_ITEMS = (
  [
    "japan_censored",
    "japan_gravure",
    "japan_uncensored",
    "japan_amateur",
    "fc2",
    "china",
    "western",
  ] as const
).map((id) => [id, KIND_LABELS[id] || id] as const);

const FIELD_TABS: { id: FieldTab; label: string; field: string }[] = [
  { id: "category", label: "分类", field: "category" },
  { id: "mosaic", label: "马赛克", field: "mosaic" },
  { id: "subtitle", label: "字幕", field: "subtitle" },
  { id: "resolution", label: "分辨率", field: "resolution" },
];

function TemplateInput({
  value,
  onChange,
  fieldHint,
  notify,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  fieldHint: string;
  notify: NotifyFn;
  placeholder?: string;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const llmOk = hasLlmConfigured();

  function looksLikeTemplate(text: string): boolean {
    return /\{\{\s*[\w|]|\{%\s*\w+|\{[a-zA-Z_]\w*\}/.test(text);
  }

  async function onAi() {
    if (!llmOk) {
      notify("warn", "请先在「系统」设置中配置 LLM");
      return;
    }
    const raw = value.trim();
    if (!raw) {
      notify("warn", "请先在输入框填写自然语言描述，再点 ✦");
      inputRef.current?.focus();
      return;
    }
    if (looksLikeTemplate(raw)) {
      notify(
        "warn",
        "当前是模板内容。请先清空输入框，改写自然语言描述后再点 ✦",
      );
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    setBusy(true);
    try {
      const tpl = await generateNamingTemplate(raw, fieldHint);
      onChange(tpl);
      notify("ok", "已生成模板，请确认后保存");
      inputRef.current?.focus();
    } catch (e) {
      notify("error", e, "AI 生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="naming-tpl-row">
      <input
        ref={inputRef}
        className="org-input naming-mono"
        value={value}
        placeholder={placeholder || "模板，或清空后输入自然语言再点 ✦"}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <button
        type="button"
        className="btn sm naming-ai-btn"
        title={
          llmOk
            ? "读取输入框中的自然语言并生成模板"
            : "请先在系统设置配置 LLM"
        }
        disabled={!llmOk || busy}
        onClick={() => void onAi()}
      >
        {busy ? "…" : "✦"}
      </button>
    </div>
  );
}

function MapGrid({
  items,
  values,
  onChange,
}: {
  items: readonly (readonly [string, string])[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="naming-map-grid">
      {items.map(([key, label]) => (
        <label key={key} className="naming-map-cell">
          <span className="naming-map-label">{label}</span>
          <input
            className="org-input"
            value={values[key] || ""}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

function Panel({
  id,
  title,
  badge,
  children,
  lead,
}: {
  id?: string;
  title: string;
  badge?: string;
  children: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <section className="mon-panel naming-panel" id={id}>
      <header className="mon-panel-head">
        <h3 className="mon-panel-title">{title}</h3>
        {badge ? <span className="naming-badge">{badge}</span> : null}
      </header>
      <div className="mon-panel-body">
        {lead ? <div className="mon-panel-lead">{lead}</div> : null}
        {children}
      </div>
    </section>
  );
}

export function NamingSettingsPanel({ notify }: Props) {
  const [config, setConfig] = useState<ScrapeConfig | null>(null);
  const [loading, setLoading] = useState(true);
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
  }, [notify]);

  const naming = config ? ({ ...DEFAULT_NAMING, ...config.naming } as Naming) : null;

  function patchNaming(next: Partial<Naming>) {
    if (!config || !naming) return;
    setConfig({
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
                        setConfig({
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
            <button
              type="button"
              className="btn primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "保存中…" : "保存配置"}
            </button>
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

const SYNTAX_FILTERS: { code: string; desc: string }[] = [
  { code: '{{ studio | default("独立") }}', desc: "缺失时使用默认值" },
  { code: "{{ number | upper }}", desc: "转大写" },
  { code: "{{ number | lower }}", desc: "转小写" },
  { code: "{{ title | truncate(20) }}", desc: "截断超长文本" },
  { code: '{{ number | split("-") | first }}', desc: "拆分取首段" },
  { code: '{{ number | split("-") | last }}', desc: "拆分取末段" },
  { code: '{{ title | replace("A", "B") }}', desc: "替换文本" },
  { code: '{{ " text " | trim }}', desc: "去除首尾空格" },
];

const SYNTAX_CONDS: { code: string; desc: string }[] = [
  { code: "{% if series %}{{ series }}/{% endif %}", desc: "有值时才显示" },
  {
    code: "{% if director %}{{ director }}{% else %}未知{% endif %}",
    desc: "有值/无值分别处理",
  },
];

const SYNTAX_EXAMPLES: { code: string; desc: string }[] = [
  {
    code: "{{ number }}{% if publish_number %} ({{ publish_number }}){% endif %}",
    desc: "有发行号时附加括号",
  },
  {
    code: '{{ actor | default(studio | default("未知")) }}',
    desc: "多级降级：演员 → 制片方 → 固定值",
  },
  {
    code: '{{ category }}/{{ number | split("-") | first }}/{{ number }}',
    desc: "按分类和番号前缀归档",
  },
];

const SYNTAX_VARS: { name: string; desc: string }[] = [
  { name: "number", desc: "番号（如 ABS-001）" },
  { name: "publish_number", desc: "发行号（如 118abs001）" },
  { name: "series_name", desc: "番号前缀（如 ABS）" },
  { name: "serial_number", desc: "番号后缀（如 001）" },
  { name: "first_letter", desc: "番号前缀首字母（如 A）" },
  { name: "series", desc: "系列" },
  { name: "category", desc: "分类" },
  { name: "actor", desc: "演员" },
  { name: "first_actor", desc: "首位演员" },
  { name: "title", desc: "标题" },
  { name: "originaltitle", desc: "原标题" },
  { name: "year", desc: "发布年份" },
  { name: "director", desc: "导演" },
  { name: "studio", desc: "制片方" },
  { name: "publisher", desc: "发行方" },
  { name: "runtime", desc: "时长（分钟）" },
  { name: "release", desc: "发布日期" },
  { name: "source_filename", desc: "源文件名（不含扩展名）" },
  { name: "filename", desc: "源文件名别名（等同 source_filename）" },
  { name: "source_path", desc: "源文件完整路径" },
  { name: "subtitle", desc: "中文字幕标识" },
  { name: "mosaic", desc: "有码/无码标识" },
  { name: "resolution", desc: "分辨率" },
];

function NamingSyntaxDoc() {
  return (
    <div className="naming-doc">
      <div className="naming-doc-intro">
        <p>以下命名规则均支持变量模板。</p>
        <div className="naming-doc-pair">
          <div className="naming-doc-pair-card">
            <span className="naming-doc-kicker">基础</span>
            <code>{"{number}"}</code>
            <span>缺失 →「未知」</span>
          </div>
          <div className="naming-doc-pair-card">
            <span className="naming-doc-kicker">Jinja2</span>
            <code>{"{{ number }}"}</code>
            <span>缺失 → 空；支持条件 / filter</span>
          </div>
        </div>
      </div>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">常用 Filter</h4>
        <div className="naming-doc-table">
          {SYNTAX_FILTERS.map((item) => (
            <div key={item.code} className="naming-doc-row">
              <code>{item.code}</code>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">条件判断</h4>
        <div className="naming-doc-table naming-doc-table--stack">
          {SYNTAX_CONDS.map((item) => (
            <div key={item.code} className="naming-doc-row">
              <code>{item.code}</code>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">实用模板示例</h4>
        <div className="naming-doc-table naming-doc-table--stack">
          {SYNTAX_EXAMPLES.map((item) => (
            <div key={item.code} className="naming-doc-row">
              <code>{item.code}</code>
              <span>{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">AI 辅助生成</h4>
        <div className="naming-doc-ai">
          <p>
            配置 LLM 后，输入框右侧会出现 <strong>✦</strong>
            。先清空输入框，写入自然语言描述，再点 ✦，将读取输入框内容并生成 Jinja2
            模板（可与基础 {"{field}"} 混写）。
          </p>
          <p className="naming-doc-ai-ex">
            例：按分类、演员分目录，但分类包含 FC2 和素人时不需要演员目录
          </p>
        </div>
      </section>

      <section className="naming-doc-sec">
        <h4 className="naming-doc-h">可用变量</h4>
        <div className="naming-doc-vars">
          {SYNTAX_VARS.map((v) => (
            <div key={v.name} className="naming-doc-var">
              <code>{v.name}</code>
              <span>{v.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
