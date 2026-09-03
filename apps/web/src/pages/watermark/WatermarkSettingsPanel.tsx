import { useMemo, useState } from "react";
import { PanelSkeleton } from "../../components/ui/PanelSkeleton";
import { WatermarkApplySection, WatermarkMarkTypesSection } from "./WatermarkChipsSections";
import { WatermarkLayoutSection } from "./WatermarkLayoutSection";
import { WatermarkPositionSection } from "./WatermarkPositionSection";
import { WatermarkStyleSection } from "./WatermarkStyleSection";
import { buildPreviewMarks } from "./previewLayout";
import { useWatermarkConfig } from "./hooks/useWatermarkConfig";
import type { WatermarkSettingsPanelProps } from "./types";

export function WatermarkSettingsPanel(props: WatermarkSettingsPanelProps) {
  const {
    loading,
    refreshing,
    config,
    w,
    styleSelectOptions,
    embedded,
    saving,
    dirty,
    notify,
    patch,
    save,
  } = useWatermarkConfig(props);
  const [showAllPreview, setShowAllPreview] = useState(false);
  const previewMarks = useMemo(
    () => (w.enabled ? buildPreviewMarks(w, showAllPreview) : []),
    [w, showAllPreview],
  );

  if (loading && !config) {
    return <PanelSkeleton label="加载水印配置…" lines={6} />;
  }

  if (!config) {
    return <PanelSkeleton label="水印配置不可用" lines={4} />;
  }

  return (
    <div className={`watermark-settings${refreshing ? " is-refreshing" : ""}`}>
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
          <WatermarkStyleSection
            w={w}
            styleSelectOptions={styleSelectOptions}
            notify={notify}
            patch={patch}
          />
          <WatermarkLayoutSection w={w} patch={patch} />
          <WatermarkApplySection w={w} patch={patch} />
          <WatermarkMarkTypesSection w={w} patch={patch} />
          <WatermarkPositionSection
            w={w}
            previewMarks={previewMarks}
            showAllPreview={showAllPreview}
            setShowAllPreview={setShowAllPreview}
            patch={patch}
          />
        </div>
      </section>

      {embedded ? (
        <div className="page-save-row">
          <button
            type="button"
            className="btn primary"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? "保存中…" : "保存修改"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
