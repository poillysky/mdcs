import { ArrowPathIcon } from "@heroicons/react/20/solid";
import type { ProviderCatalogRow, ScrapeConfig } from "../../types";
import { PROVIDER_UI_GROUPS } from "./constants";
import type { ProbeStatus } from "./probeStorage";
import { ProviderCard } from "./ProviderCard";
import { displayProviderName, formatAgo, sortProviderRows } from "./providerDisplay";

type Props = {
  embedded: boolean;
  config: ScrapeConfig;
  catalog: ProviderCatalogRow[];
  probeStatus: Record<string, ProbeStatus>;
  lastProbeAt: number | null;
  probing: boolean;
  probingId: string | null;
  onProbeAll: () => void;
  onProbeOne: (id: string, label: string) => void;
  onEdit: (id: string) => void;
  onToggleEnabled: (row: ProviderCatalogRow, enabled: boolean) => void;
  onToggleScrapeEnabled?: (enabled: boolean) => void;
};

export function ProviderCatalogSection({
  embedded,
  config,
  catalog,
  probeStatus,
  lastProbeAt,
  probing,
  probingId,
  onProbeAll,
  onProbeOne,
  onEdit,
  onToggleEnabled,
  onToggleScrapeEnabled,
}: Props) {
  const siteMap = config.providerSettings ?? {};

  return (
    <section className="src-mgmt">
      <header className="src-mgmt-head">
        <div>
          {!embedded ? <h1>数据源管理</h1> : null}
          <p>可点击卡片进行详细设置；自动测通为每天 01:00 一次（停留本页时）</p>
          {onToggleScrapeEnabled ? (
            <label className="switch block src-mgmt-scrape-enabled">
              <input
                type="checkbox"
                checked={config.enabled !== false}
                onChange={(e) => onToggleScrapeEnabled(e.target.checked)}
              />
              <span>启用在线刮削</span>
            </label>
          ) : null}
        </div>
        <div className="src-mgmt-actions">
          <span className="src-mgmt-ago">状态更新时间: {formatAgo(lastProbeAt)}</span>
          <button
            type="button"
            className="btn src-mgmt-test"
            disabled={probing || Boolean(probingId)}
            onClick={onProbeAll}
          >
            <ArrowPathIcon className="src-mgmt-test-icon" aria-hidden />
            {probing ? "测试中…" : "测试全部"}
          </button>
        </div>
      </header>

      <div className="src-groups">
        {PROVIDER_UI_GROUPS.map((g) => {
          const rows = sortProviderRows(catalog.filter((r) => r.group === g.id));
          if (!rows.length) return null;
          return (
            <section key={g.id} className="src-group">
              <h2 className="src-group-title">{g.label}</h2>
              <div className="src-card-grid">
                {rows.map((row) => {
                  const site = siteMap[row.id];
                  const url = (site?.baseUrl || row.defaultUrl || "").trim() || "—";
                  const cd = site?.cooldownSec ?? row.defaultCooldownSec ?? 0;
                  return (
                    <ProviderCard
                      key={row.id}
                      row={row}
                      config={config}
                      catalog={catalog}
                      status={probeStatus[row.id] ?? "unknown"}
                      probing={probing}
                      probingId={probingId}
                      siteUrl={url}
                      cooldownSec={cd}
                      onEdit={() => onEdit(row.id)}
                      onToggleEnabled={(enabled) => onToggleEnabled(row, enabled)}
                      onProbe={() => onProbeOne(row.id, displayProviderName(row.id, row.label))}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
