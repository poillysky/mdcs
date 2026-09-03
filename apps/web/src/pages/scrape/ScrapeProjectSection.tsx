import type { ScrapeConfig } from "../../types";

type Props = {
  config: ScrapeConfig;
  saving: boolean;
  embedded: boolean;
  onPatch: (next: Partial<ScrapeConfig>) => void;
  onSave: () => void;
};

export function ScrapeProjectSection({ config, saving, onPatch, onSave }: Props) {
  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h2>刮削开关与并发</h2>
      </div>
      <div className="panel-body">
        <label className="switch block">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onPatch({ enabled: e.target.checked })}
          />
          <span>启用在线刮削</span>
        </label>
        <label className="field">
          <span>刮削并发</span>
          <input
            type="number"
            min={1}
            max={16}
            value={config.exportFastConcurrency}
            onChange={(e) => {
              const n = Math.max(1, Number(e.target.value) || 1);
              onPatch({ exportFastConcurrency: n, exportSlowConcurrency: n });
            }}
          />
        </label>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 12 }}>
          单池并行刮削数（含过盾源）；建议 2–6，过高可能触发站点限流。
        </p>
        <label className="field">
          <span>封面策略</span>
          <select
            value={config.coverDownloadStrategy}
            onChange={(e) => onPatch({ coverDownloadStrategy: e.target.value })}
          >
            <option value="priority">按优先级</option>
            <option value="size">按尺寸</option>
          </select>
        </label>
        <button type="button" className="btn primary" disabled={saving} onClick={onSave}>
          {saving ? "保存中…" : "保存刮削配置"}
        </button>
      </div>
    </section>
  );
}
