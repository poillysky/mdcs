import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { Switch } from "../../components/ui/Switch";
import type { ProviderCatalogRow, ScrapeConfig } from "../../types";
import type { ProbeStatus } from "./probeStorage";
import { displayProviderName } from "./providerDisplay";

type Props = {
  row: ProviderCatalogRow;
  config: ScrapeConfig;
  catalog: ProviderCatalogRow[];
  status: ProbeStatus;
  probing: boolean;
  probingId: string | null;
  siteUrl: string;
  cooldownSec: number;
  onEdit: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onProbe: () => void;
};

export function ProviderCard({
  row,
  config,
  status,
  probing,
  probingId,
  siteUrl,
  cooldownSec: cd,
  onEdit,
  onToggleEnabled,
  onProbe,
}: Props) {
  const url = siteUrl.trim() || "—";
  const name = displayProviderName(row.id, row.label);
  const isProbingThis = probingId === row.id;
  const accessLabel = row.access === "proxy_flare" ? "过盾" : "自适应";
  const href = url !== "—" ? url : "";

  return (
    <div
      role="button"
      tabIndex={0}
      className={`src-card${row.enabled ? "" : " is-off"}${row.implemented ? "" : " is-stub"}`}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onEdit();
      }}
    >
      <div className="src-card-top">
        <div className="src-card-title">
          <strong>{name}</strong>
          {!row.implemented ? (
            <span className="src-tag src-tag--stub" title="刮削未实现">
              stub
            </span>
          ) : null}
          {row.needsApiKey &&
          row.id === "theporndb" &&
          !(config.theporndbApiKey || "").trim() ? (
            <span
              className="src-tag src-tag--needkey"
              title="请在卡片设置中填写 ThePornDB API Key，否则欧美刮削会失败"
            >
              缺 Key
            </span>
          ) : null}
          <span
            className={`src-dot src-dot--${row.enabled ? status : "off"}`}
            title={
              !row.enabled
                ? "已禁用"
                : status === "ok"
                  ? "可达"
                  : status === "fail"
                    ? "失败"
                    : status === "testing"
                      ? "测试中"
                      : "未测试"
            }
          />
        </div>
        <Switch checked={row.enabled} stopPropagation onChange={onToggleEnabled} />
      </div>
      {href ? (
        <a
          className="src-card-url"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={href}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      ) : (
        <p className="src-card-url">—</p>
      )}
      <div className="src-card-foot">
        <span className="src-card-access muted">{accessLabel}</span>
        {cd > 0 ? <span className="src-card-cd">CD: {cd}s</span> : <span />}
        <span
          role="button"
          tabIndex={row.enabled ? 0 : -1}
          className={`src-card-probe${isProbingThis ? " is-busy" : ""}${row.enabled ? "" : " is-disabled"}`}
          title={row.enabled ? "测试联通性" : "已禁用，不测通"}
          aria-label={`测试 ${name} 联通性`}
          aria-disabled={!row.enabled || probing || Boolean(probingId)}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!row.enabled || probing || probingId) return;
            onProbe();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.stopPropagation();
            e.preventDefault();
            if (!row.enabled || probing || probingId) return;
            onProbe();
          }}
        >
          <ArrowPathIcon
            className={`src-card-probe-icon${isProbingThis ? " is-spin" : ""}`}
            aria-hidden
          />
          {isProbingThis ? "测试中" : "测通"}
        </span>
      </div>
    </div>
  );
}
