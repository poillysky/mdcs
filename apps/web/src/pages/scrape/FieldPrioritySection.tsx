import { FIELD_LABELS } from "./constants";
import type { ScrapeConfig } from "../../types";

type Props = {
  config: ScrapeConfig;
  showProviders: boolean;
  embedded: boolean;
  saving: boolean;
  onBlockSource: (field: string, sourceId: string) => void;
  onSetFieldList: (field: string, raw: string) => void;
  onSave: () => void;
};

export function FieldPrioritySection({
  config,
  showProviders,
  embedded,
  saving,
  onBlockSource,
  onSetFieldList,
  onSave,
}: Props) {
  return (
    <section className="panel" style={{ marginTop: showProviders ? 20 : 0 }}>
      <div className="panel-head">
        <h2>字段优先级</h2>
      </div>
      <div className="priority-grid">
        {Object.entries(config.fieldPriority).map(([field, sources]) => (
          <div key={field} className="priority-row">
            <span className="priority-field" title={field}>
              {FIELD_LABELS[field] ?? field}
            </span>
            <div className="chip-row">
              {sources.map((s, i) => (
                <button
                  key={`${field}-${s}`}
                  type="button"
                  className="tag sm"
                  title="点击从该字段链中屏蔽/移除"
                  onClick={() => onBlockSource(field, s)}
                >
                  {i + 1}. {s} ×
                </button>
              ))}
            </div>
            <input
              className="priority-edit"
              value={sources.join(", ")}
              onChange={(e) => onSetFieldList(field, e.target.value)}
              placeholder="源 id，逗号分隔；空=继承"
            />
          </div>
        ))}
      </div>
      <p className="hint" style={{ padding: "0 16px 12px" }}>
        点击标签可从链中移除（屏蔽该源）。空列表表示继承全局/分区源链。
      </p>
      <div style={{ padding: "0 16px 16px" }}>
        {!embedded ? (
          <button type="button" className="btn primary" disabled={saving} onClick={onSave}>
            {saving ? "保存中…" : "保存字段优先级"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
