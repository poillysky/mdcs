import { useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { RecordsMenuDropdown } from "../../components/RecordsMenuDropdown";
import { syncEmbyActors } from "../../api";
import { useSharedOpsConfig } from "../../hooks/useSharedOpsConfig";
import type { NotifyFn } from "../../lib/notify";
import {
  actorInitial,
  embyStatusClass,
  embyStatusLabel,
  parseEmbySyncRows,
} from "./actorsDisplay";
import { ActorsTable } from "./ActorsTable";
import { EMBY_STATUS_OPTIONS, type EmbyActorRow } from "./types";

export function ActorsEmbyPanel({ notify }: { notify: NotifyFn }) {
  const { config, refreshing, reload } = useSharedOpsConfig({
    onError: (e) => notify("error", e, "加载 Emby 配置失败"),
  });
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [rows, setRows] = useState<EmbyActorRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const connReady = Boolean(
    config?.actors?.embyUrl?.trim() && config?.actors?.embyApiKey?.trim(),
  );

  async function runLibraryScan() {
    setSyncing(true);
    try {
      const result = await syncEmbyActors();
      const next = parseEmbySyncRows(result);
      setRows(next);
      notify(
        "ok",
        `同步完成：元数据 ${result.updatedMeta} / 图片 ${result.updatedImage} / 本地导入 ${result.fromLocal ?? 0} / 跳过 ${result.skipped} / 失败 ${result.failed}（共 ${result.total}）`,
      );
    } catch (e) {
      notify("error", e, "媒体库检索失败");
    } finally {
      setSyncing(false);
    }
  }

  const q = searchInput.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (q && !row.name.toLowerCase().includes(q) && !row.detail.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rows, status, q]);

  const ids = filtered.map((r) => r.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const statusLabel = EMBY_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "全部";

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(ids) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const emptyText = connReady
    ? "点击「媒体库检索」从 Emby 拉取演员并刮削头像"
    : "请先在设置 · 演员中填写 Emby 地址和 API Key";

  return (
    <section className="panel records-shell">
      <header className="records-page-head">
        <div className="records-page-title-row">
          <h1 className="records-page-title">
            <span className="records-page-title-main">演员管理</span>
            <span className="records-page-title-suffix">— Emby 刮削</span>
          </h1>
          <span className="records-page-count">
            共 <strong>{filtered.length}</strong> 条记录
          </span>
        </div>
        <div className="records-page-head-bar">
          <div className="records-page-search">
            <MagnifyingGlassIcon className="records-page-search-icon" aria-hidden />
            <input
              className="records-page-search-input"
              placeholder="搜索演员名称"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <RecordsMenuDropdown
            className="records-menu--status"
            closeOnSelect
            label={
              <>
                <span className="records-menu-trigger-prefix">任务状态:</span>
                <span className="records-menu-trigger-value">{statusLabel}</span>
                <ChevronDownIcon className="records-menu-chevron" aria-hidden />
              </>
            }
            items={EMBY_STATUS_OPTIONS.map((o) => ({
              id: o.value,
              label: o.label,
              checked: status === o.value,
            }))}
            onSelect={setStatus}
          />
          <div className="records-page-head-meta">
            <div className="records-page-actions">
              <button
                type="button"
                className="btn primary solid actors-scan-btn"
                disabled={syncing || !connReady}
                onClick={() => void runLibraryScan()}
              >
                <ArrowPathIcon aria-hidden />
                媒体库检索
              </button>
              <button
                type="button"
                className="records-icon-btn"
                title="刷新"
                disabled={syncing || refreshing}
                onClick={() => void reload()}
              >
                <ArrowPathIcon aria-hidden />
              </button>
              <button
                type="button"
                className="records-icon-btn records-icon-btn--danger"
                title="删除"
                disabled
              >
                <TrashIcon aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </header>

      <ActorsTable
        loading={syncing}
        refreshing={refreshing && rows.length > 0}
        emptyText={syncing ? "正在从 Emby 检索演员…" : emptyText}
        colCount={11}
        allSelected={allSelected}
        onToggleAll={toggleAll}
      >
        {filtered.map((row, i) => (
          <tr key={row.id}>
            <td className="records-col-check">
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                onChange={(e) => toggleOne(row.id, e.target.checked)}
              />
            </td>
            <td className="records-col-index">{i + 1}</td>
            <td className="actors-col-avatar">
              <span className="actors-avatar actors-avatar--emby" aria-hidden>
                {actorInitial(row.name)}
              </span>
            </td>
            <td className="actors-col-name">{row.name}</td>
            <td className="actors-col-status">
              <span className={embyStatusClass(row.status)}>{embyStatusLabel(row.status)}</span>
            </td>
            <td className="actors-col-backdrop">
              <span className="actors-backdrop-ph">Emby</span>
            </td>
            <td className="actors-col-detail" title={row.detail}>
              {row.detail}
            </td>
            <td className="records-col-time">—</td>
            <td className="records-col-time">—</td>
            <td className="actors-col-error" title={row.error || undefined}>
              {row.error || "—"}
            </td>
            <td className="records-col-op">—</td>
          </tr>
        ))}
      </ActorsTable>
    </section>
  );
}
