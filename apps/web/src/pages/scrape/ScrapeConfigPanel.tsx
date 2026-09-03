import { useMemo } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { PanelSkeleton } from "../../components/ui/PanelSkeleton";
import { ProviderSettingsModal } from "../../components/ProviderSettingsModal";
import type { ProviderCatalogRow, ScrapeConfig } from "../../types";
import { FieldPrioritySection } from "./FieldPrioritySection";
import { ProviderCatalogSection } from "./ProviderCatalogSection";
import { ScrapeProjectSection } from "./ScrapeProjectSection";
import { useProviderProbe } from "./hooks/useProviderProbe";
import { useScrapeConfig } from "./hooks/useScrapeConfig";
import { emptySite } from "./providerDisplay";
import type { ScrapeConfigPanelProps } from "./types";

export function ScrapeConfigPanel({
  notify,
  variant = "sources",
  embedded = false,
  value,
  catalog: catalogProp,
  onChange,
  onActionsChange,
}: ScrapeConfigPanelProps) {
  const scrape = useScrapeConfig({
    notify,
    embedded,
    value,
    catalog: catalogProp,
    onChange,
    onActionsChange,
  });
  const probe = useProviderProbe({
    controlled: scrape.controlled,
    loading: scrape.loading,
    catalog: scrape.catalog,
    notify,
  });

  const editingRow = useMemo(
    () => (scrape.editId ? scrape.catalog.find((r) => r.id === scrape.editId) : undefined),
    [scrape.catalog, scrape.editId],
  );

  if (scrape.loading || !scrape.config) {
    return <PanelSkeleton label="加载刮削配置…" lines={6} />;
  }

  const config = scrape.config;
  const showProject = variant === "project";
  const showProviders = variant === "providers" || variant === "sources";
  const showFields = variant === "sources";
  const showSourcesShell = showProviders || showFields;
  const siteMap = config.providerSettings ?? {};
  const globalRetry = config.providerRetryDefault ?? 0;

  function onToggleEnabled(row: ProviderCatalogRow, enabled: boolean) {
    const set = new Set(config.disabledProviders ?? []);
    if (enabled) set.delete(row.id);
    else set.add(row.id);
    const disabledProviders = [...set];
    const nextCatalog = scrape.catalog.map((r) => (r.id === row.id ? { ...r, enabled } : r));
    const nextConfig = { ...config, disabledProviders };
    scrape.commit(nextConfig, nextCatalog);
    if (!scrape.controlled) {
      void scrape.save("Provider 开关已保存", nextConfig);
    }
  }

  function onToggleScrapeEnabled(enabled: boolean) {
    const nextConfig = { ...config, enabled };
    scrape.commit(nextConfig);
    if (!scrape.controlled) {
      void scrape.save(enabled ? "已启用在线刮削" : "已关闭在线刮削", nextConfig);
    }
  }

  return (
    <div
      className={`scrape-panel${showSourcesShell ? " scrape-panel-sources" : ""}${embedded ? " scrape-panel-embedded" : ""}${scrape.refreshing ? " is-refreshing" : ""}`}
    >
      {variant === "sources" && !embedded ? (
        <PageHeader
          title="数据源"
          description="全局 Provider 开关与字段优先级。各分区源链请在「监控 → 分区弹窗 → 数据源」配置。"
        />
      ) : null}

      <div className="scrape-config">
        {showProject ? (
          <ScrapeProjectSection
            config={config}
            saving={scrape.saving}
            embedded={embedded}
            onPatch={scrape.patch}
            onSave={() => void scrape.save("刮削配置已保存")}
          />
        ) : null}

        {showProviders ? (
          <ProviderCatalogSection
            embedded={embedded}
            config={config}
            catalog={scrape.catalog}
            probeStatus={probe.probeStatus}
            lastProbeAt={probe.lastProbeAt}
            probing={probe.probing}
            probingId={probe.probingId}
            onProbeAll={() => void probe.probeAll()}
            onProbeOne={(id, label) => void probe.probeOne(id, label)}
            onEdit={(id) => scrape.setEditId(id)}
            onToggleEnabled={onToggleEnabled}
            onToggleScrapeEnabled={onToggleScrapeEnabled}
          />
        ) : null}

        {showFields ? (
          <FieldPrioritySection
            config={config}
            showProviders={showProviders}
            embedded={embedded}
            saving={scrape.saving}
            onBlockSource={scrape.blockSourceFromField}
            onSetFieldList={scrape.setFieldPriorityList}
            onSave={() => void scrape.save("字段优先级已保存")}
          />
        ) : null}
      </div>

      {editingRow ? (
        <ProviderSettingsModal
          open
          title={editingRow.label}
          sourceId={editingRow.id}
          group={editingRow.group}
          access={editingRow.access}
          implemented={editingRow.implemented}
          notes={editingRow.notes}
          defaultUrl={editingRow.defaultUrl || ""}
          value={siteMap[editingRow.id]}
          defaultCooldownSec={editingRow.defaultCooldownSec ?? 0}
          globalRetryDefault={globalRetry}
          globalProxyUrl={config.proxyUrl || ""}
          needsApiKey={Boolean(editingRow.needsApiKey)}
          apiKey={editingRow.id === "theporndb" ? config.theporndbApiKey ?? "" : ""}
          onClose={() => scrape.setEditId(null)}
          onSave={(next, extras) => {
            const empty =
              !next.baseUrl &&
              !next.cookie &&
              !next.userAgent &&
              next.cooldownSec <= 0 &&
              !next.overrideRetry &&
              next.retry <= 0 &&
              !next.proxyUrl;
            const providerSettings = { ...(config.providerSettings ?? {}) };
            if (empty) delete providerSettings[editingRow.id];
            else providerSettings[editingRow.id] = { ...emptySite(), ...next };
            const patch: ScrapeConfig = { ...config, providerSettings };
            if (editingRow.id === "theporndb") {
              patch.theporndbApiKey = extras?.apiKey ?? "";
            }
            if (scrape.controlled) {
              scrape.commit(patch);
              scrape.setEditId(null);
              return;
            }
            void scrape.save("数据源设置已保存", patch);
          }}
        />
      ) : null}
    </div>
  );
}
