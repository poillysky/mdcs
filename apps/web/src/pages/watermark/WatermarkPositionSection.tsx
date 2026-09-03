import { POS_OPTS, type Pos, type PreviewMark, type Wm } from "./types";
import { PREVIEW_ASSET, placeStyle } from "./previewLayout";
import { Section } from "./widgets";

export function WatermarkPositionSection({
  w,
  previewMarks,
  showAllPreview,
  setShowAllPreview,
  patch,
}: {
  w: Wm;
  previewMarks: PreviewMark[];
  showAllPreview: boolean;
  setShowAllPreview: (v: boolean) => void;
  patch: (partial: Partial<Wm>) => void;
}) {
  return (
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
  );
}
