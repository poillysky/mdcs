import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { fetchScrapeConfig, saveScrapeConfig } from "../api";
import { FolderPicker } from "../components/FolderPicker";
import { SettingRow } from "../components/SettingRow";
import type { NotifyFn } from "../lib/notify";
import type { ScrapeConfig } from "../types";

type Props = {
  notify: NotifyFn;
};

type Wm = NonNullable<ScrapeConfig["watermark"]>;
type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type Pos = "auto" | Corner;

const DEFAULT: Wm = {
  enabled: true,
  position: "top-left",
  scalePercent: 11,
  style: "default",
  style4k: "default",
  customDir: "assets/watermarks/default",
  layout: "stack",
  startPosition: "top-left",
  heightRatio: 9,
  offsetX: 0,
  offsetY: 0,
  spacing: 0,
  applyPoster: true,
  applyThumb: true,
  applyFanart: false,
  markSubtitle: true,
  markCracked: true,
  markLeak: true,
  markUncensored: true,
  markCensored: false,
  markResolution: true,
  posSubtitle: "auto",
  posCracked: "auto",
  posLeak: "auto",
  posUncensored: "auto",
  posCensored: "auto",
  posResolution: "auto",
};

const CORNER_OPTS: { value: Corner; label: string }[] = [
  { value: "top-left", label: "左上角" },
  { value: "top-right", label: "右上角" },
  { value: "bottom-left", label: "左下角" },
  { value: "bottom-right", label: "右下角" },
];

const POS_OPTS: { value: Pos; label: string }[] = [
  { value: "auto", label: "自动" },
  ...CORNER_OPTS,
];

type PreviewMark = { id: string; text: string; tone: string; file: string; pos: Pos };

const PREVIEW_ASSET = "/watermarks/default";

function Section({
  title,
  hint,
  variant,
  children,
}: {
  title: string;
  hint?: string;
  variant?: "pos";
  children: ReactNode;
}) {
  return (
    <div className={`wm-section${variant ? ` wm-section--${variant}` : ""}`}>
      <div className="wm-section-head">
        <div className="wm-section-title">{title}</div>
        {hint ? <p className="wm-section-sub">{hint}</p> : null}
      </div>
      <div className="wm-section-body">{children}</div>
    </div>
  );
}

function ChipToggle({
  checked,
  label,
  tone,
  onChange,
}: {
  checked: boolean;
  label: string;
  tone?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`wm-chip${checked ? " is-on" : ""}`}
      data-tone={tone || undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="wm-chip-dot" aria-hidden />
      <span className="wm-chip-label">{label}</span>
    </button>
  );
}

function buildPreviewMarks(w: Wm, showAll: boolean): PreviewMark[] {
  const all: PreviewMark[] = [];
  if (w.markResolution) {
    all.push({
      id: "res4k",
      text: "4K",
      tone: "res",
      file: "4k.png",
      pos: w.posResolution,
    });
    if (showAll) {
      all.push({
        id: "res8k",
        text: "8K",
        tone: "res",
        file: "8k.png",
        pos: w.posResolution,
      });
    }
  }
  if (w.markSubtitle) {
    all.push({ id: "sub", text: "字幕", tone: "sub", file: "sub.png", pos: w.posSubtitle });
  }
  if (w.markCracked) {
    all.push({ id: "cracked", text: "破解", tone: "cracked", file: "umr.png", pos: w.posCracked });
  }
  if (w.markLeak) {
    all.push({ id: "leak", text: "流出", tone: "leak", file: "leak.png", pos: w.posLeak });
  }
  if (w.markUncensored) {
    all.push({ id: "wuma", text: "无码", tone: "wuma", file: "wuma.png", pos: w.posUncensored });
  }
  if (w.markCensored) {
    all.push({ id: "youma", text: "有码", tone: "youma", file: "youma.png", pos: w.posCensored });
  }

  if (showAll) return all;

  const out: PreviewMark[] = [];
  if (w.markResolution) out.push(all.find((x) => x.id === "res4k")!);
  if (w.markSubtitle) out.push(all.find((x) => x.id === "sub")!);
  const mosaic =
    (w.markCracked && all.find((x) => x.id === "cracked")) ||
    (w.markLeak && all.find((x) => x.id === "leak")) ||
    (w.markUncensored && all.find((x) => x.id === "wuma")) ||
    (w.markCensored && all.find((x) => x.id === "youma"));
  if (mosaic) out.push(mosaic);
  return out.filter(Boolean);
}

function resolveCorner(mark: PreviewMark, index: number, w: Wm): Corner {
  const start = w.startPosition || w.position || "top-left";
  if (mark.pos !== "auto") return mark.pos;
  if (w.layout === "stack") return start;
  const order: Corner[] = ["top-left", "top-right", "bottom-right", "bottom-left"];
  const i0 = order.indexOf(start);
  const dir = w.layout === "clockwise" ? 1 : -1;
  return order[(i0 + dir * index + 8) % 4]!;
}

/** 预览尺寸：跟 heightRatio，但预览框里再缩小一档（真整理仍按配置） */
function markHeightPct(w: Wm): number {
  const r = Math.max(2, w.heightRatio || 9);
  const raw = 100 / r;
  return Math.max(4, Math.min(14, raw * 0.55));
}

/** 角标宽度约占预览框宽度的百分比（胶囊约 1.875，分辨率标约 1.11） */
function markWidthPctOfFrame(mark: PreviewMark, hPct: number): number {
  const aspect = mark.tone === "res" ? 355 / 320 : 600 / 320;
  return hPct * aspect * 1.5;
}

function placeStyle(mark: PreviewMark, index: number, w: Wm, marks: PreviewMark[]): CSSProperties {
  const corner = resolveCorner(mark, index, w);
  const ox = w.offsetX || 0;
  const oy = w.offsetY || 0;
  const gapPct = Math.max(0, w.spacing || 0) * 0.05 + 0.6;
  const hPct = markHeightPct(w);
  const sameBefore = marks
    .slice(0, index)
    .filter((m, j) => resolveCorner(m, j, w) === corner);
  const stackMode = mark.pos === "auto" && w.layout === "stack";
  const stackXPct = stackMode
    ? sameBefore.reduce((sum, m) => sum + markWidthPctOfFrame(m, hPct) + gapPct, 0)
    : 0;
  const stackYPct = stackMode ? 0 : sameBefore.length * (hPct * 0.55 + gapPct);

  const base: CSSProperties = {
    position: "absolute",
    height: `${hPct}%`,
    width: "auto",
  };

  const insetX = `calc(8px + ${ox}px)`;
  const insetY = `calc(8px + ${oy}px)`;

  if (corner === "top-left") {
    return {
      ...base,
      top: stackYPct ? `calc(${insetY} + ${stackYPct}%)` : insetY,
      left: stackXPct ? `calc(${insetX} + ${stackXPct}%)` : insetX,
    };
  }
  if (corner === "top-right") {
    return {
      ...base,
      top: stackYPct ? `calc(${insetY} + ${stackYPct}%)` : insetY,
      right: stackXPct ? `calc(${insetX} + ${stackXPct}%)` : insetX,
    };
  }
  if (corner === "bottom-left") {
    return {
      ...base,
      bottom: stackYPct ? `calc(${insetY} + ${stackYPct}%)` : insetY,
      left: stackXPct ? `calc(${insetX} + ${stackXPct}%)` : insetX,
    };
  }
  return {
    ...base,
    bottom: stackYPct ? `calc(${insetY} + ${stackYPct}%)` : insetY,
    right: stackXPct ? `calc(${insetX} + ${stackXPct}%)` : insetX,
  };
}

export function WatermarkSettingsPanel({ notify }: Props) {
  const [config, setConfig] = useState<ScrapeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAllPreview, setShowAllPreview] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchScrapeConfig();
        setConfig({
          ...data.config,
          watermark: { ...DEFAULT, ...data.config.watermark },
        });
      } catch (e) {
        notify("error", e, "加载水印配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  function patch(partial: Partial<Wm>) {
    if (!config) return;
    const next = { ...DEFAULT, ...config.watermark, ...partial };
    if (partial.heightRatio != null) {
      const r = Math.max(2, Math.min(40, Number(partial.heightRatio) || 9));
      next.heightRatio = r;
      next.scalePercent = Math.max(1, Math.min(40, Math.round(100 / r)));
    }
    if (partial.startPosition != null) {
      next.position = partial.startPosition;
    }
    setConfig({ ...config, watermark: next });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const { config: saved } = await saveScrapeConfig(config);
      setConfig({ ...saved, watermark: { ...DEFAULT, ...saved.watermark } });
      notify("ok", "水印配置已保存（整理海报时生效）");
    } catch (e) {
      notify("error", e, "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const w = useMemo(() => ({ ...DEFAULT, ...config?.watermark }), [config]);
  const previewMarks = useMemo(
    () => (w.enabled ? buildPreviewMarks(w, showAllPreview) : []),
    [w, showAllPreview],
  );

  if (loading || !config) {
    return <div className="empty-block">加载水印配置…</div>;
  }

  return (
    <div className="watermark-settings">
      <section className="mon-panel watermark-form">
        <header className="mon-panel-head">
          <h3 className="mon-panel-title">水印</h3>
          <div className="wm-head-switch">
            <span>启用</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={w.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />
              <span />
            </label>
          </div>
        </header>
        <div className={`mon-panel-body${w.enabled ? "" : " is-dimmed"}`}>
          <Section title="样式与资源">
            <SettingRow label="水印样式" hint="对应 assets/watermarks/{样式名}；自定义目录优先">
              <select
                className="org-select"
                value={w.style || "default"}
                onChange={(e) => patch({ style: e.target.value })}
              >
                <option value="default">默认</option>
              </select>
            </SettingRow>
            <SettingRow label="水印样式 (4K, 8K)" hint="分辨率角标 PNG 目录，默认与基本样式相同">
              <select
                className="org-select"
                value={w.style4k || "default"}
                onChange={(e) => patch({ style4k: e.target.value })}
              >
                <option value="default">默认</option>
              </select>
            </SettingRow>
            <SettingRow label="自定义水印" hint="目录内 PNG：youma / wuma / umr / leak / sub / 4k / 8k" layout="stack">
              <FolderPicker
                value={w.customDir || ""}
                onChange={(customDir) => patch({ customDir })}
                onError={(msg) => notify("error", msg)}
              />
            </SettingRow>
          </Section>

          <Section title="布局与几何">
            <SettingRow label="布局方式" hint="堆叠横向添加；顺/逆时针在四角依次添加">
              <select
                className="org-select"
                value={w.layout}
                onChange={(e) => patch({ layout: e.target.value as Wm["layout"] })}
              >
                <option value="stack">堆叠</option>
                <option value="clockwise">顺时针</option>
                <option value="counterclockwise">逆时针</option>
              </select>
            </SettingRow>
            <SettingRow label="起始位置" hint="第一个水印的添加位置">
              <select
                className="org-select"
                value={w.startPosition}
                onChange={(e) => patch({ startPosition: e.target.value as Corner })}
              >
                {CORNER_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SettingRow>
            <SettingRow label="缩放倍率" hint="相对海报高度的水印缩放比例">
              <input
                className="org-input org-input-sm"
                type="number"
                min={2}
                max={40}
                value={w.heightRatio}
                onChange={(e) => patch({ heightRatio: Number(e.target.value) || 9 })}
              />
            </SettingRow>
            <SettingRow label="横向偏移" hint="水印相对边缘的水平偏移">
              <input
                className="org-input org-input-sm"
                type="number"
                min={0}
                value={w.offsetX}
                onChange={(e) => patch({ offsetX: Number(e.target.value) || 0 })}
              />
            </SettingRow>
            <SettingRow label="纵向偏移" hint="水印相对边缘的垂直偏移">
              <input
                className="org-input org-input-sm"
                type="number"
                min={0}
                value={w.offsetY}
                onChange={(e) => patch({ offsetY: Number(e.target.value) || 0 })}
              />
            </SettingRow>
            <SettingRow label="间距" hint="同角多个水印之间的间距">
              <input
                className="org-input org-input-sm"
                type="number"
                min={0}
                value={w.spacing}
                onChange={(e) => patch({ spacing: Number(e.target.value) || 0 })}
              />
            </SettingRow>
          </Section>

          <Section title="图片类型">
            <div className="wm-chip-row">
              <ChipToggle
                checked={Boolean(w.applyPoster)}
                label="封面图"
                tone="poster"
                onChange={(v) => patch({ applyPoster: v })}
              />
              <ChipToggle
                checked={Boolean(w.applyThumb)}
                label="缩略图"
                tone="thumb"
                onChange={(v) => patch({ applyThumb: v })}
              />
              <ChipToggle
                checked={Boolean(w.applyFanart)}
                label="背景图"
                tone="fanart"
                onChange={(v) => patch({ applyFanart: v })}
              />
            </div>
          </Section>

          <Section title="水印类型">
            <p className="wm-section-hint">有码 / 无码 / 流出 / 破解逐级覆盖</p>
            <div className="wm-chip-row">
              <ChipToggle
                checked={Boolean(w.markSubtitle)}
                label="字幕"
                tone="sub"
                onChange={(v) => patch({ markSubtitle: v })}
              />
              <ChipToggle
                checked={Boolean(w.markCracked)}
                label="破解"
                tone="cracked"
                onChange={(v) => patch({ markCracked: v })}
              />
              <ChipToggle
                checked={Boolean(w.markLeak)}
                label="流出"
                tone="leak"
                onChange={(v) => patch({ markLeak: v })}
              />
              <ChipToggle
                checked={Boolean(w.markUncensored)}
                label="无码"
                tone="wuma"
                onChange={(v) => patch({ markUncensored: v })}
              />
              <ChipToggle
                checked={Boolean(w.markCensored)}
                label="有码"
                tone="youma"
                onChange={(v) => patch({ markCensored: v })}
              />
              <ChipToggle
                checked={Boolean(w.markResolution)}
                label="4K/8K"
                tone="res"
                onChange={(v) => patch({ markResolution: v })}
              />
            </div>
          </Section>

          <Section title="固定位置" hint="将水印固定在指定位置" variant="pos">
            <div className="wm-pos-with-preview">
              <div className="wm-pos-grid">
                {(
                  [
                    ["posSubtitle", "字幕"],
                    ["posCracked", "破解"],
                    ["posLeak", "流出"],
                    ["posUncensored", "无码"],
                    ["posCensored", "有码"],
                    ["posResolution", "4K/8K"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="wm-pos-field">
                    <span>{label}</span>
                    <select
                      className="org-select wm-pos-select"
                      value={w[key]}
                      onChange={(e) => patch({ [key]: e.target.value as Pos })}
                    >
                      {POS_OPTS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <aside className="wm-inline-preview" aria-label="水印预览">
                <div className={`wm-preview-stage${!w.enabled ? " is-off" : ""}`}>
                  <div className="wm-preview-frame">
                    <span className="wm-preview-watermark" aria-hidden>
                      预览
                    </span>
                    {!w.enabled ? (
                      <div className="wm-preview-empty">未启用水印</div>
                    ) : (
                      previewMarks.map((m, i) => (
                        <img
                          key={`${m.id}-${i}`}
                          className="wm-preview-mark"
                          src={`${PREVIEW_ASSET}/${m.file}`}
                          alt={m.text}
                          draggable={false}
                          style={placeStyle(m, i, w, previewMarks)}
                        />
                      ))
                    )}
                  </div>
                </div>
                <div className="wm-preview-foot">
                  <span className="wm-preview-foot-label">显示全部水印</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={showAllPreview}
                      onChange={(e) => setShowAllPreview(e.target.checked)}
                    />
                    <span />
                  </label>
                </div>
              </aside>
            </div>
          </Section>
        </div>
      </section>

      <div className="page-save-row">
        <button type="button" className="btn primary" disabled={saving} onClick={() => void save()}>
          {saving ? "保存中…" : "保存修改"}
        </button>
      </div>
    </div>
  );
}
