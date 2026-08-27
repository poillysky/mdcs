import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { RecordsMenuDropdown } from "../components/RecordsMenuDropdown";
import { ActorDetailView } from "../components/ActorDetailView";
import { fetchActors, fetchOpsConfig, scrapeActors, syncEmbyActors } from "../api";
import { COPY } from "../lib/messages";
import { kindLabel } from "../lib/labels";
import type { ActorRow } from "../types";
import type { NotifyFn } from "../lib/notify";

type Props = {
  path: string;
  locationSearch: string;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

type ActorsTab = "local" | "emby";

type EmbyActorRow = {
  id: string;
  name: string;
  status: "success" | "failed" | "skipped";
  detail: string;
  error: string;
};

const PAGE_SIZE = 50;

const LOCAL_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "scraped", label: "已刮削" },
  { value: "missing", label: "未刮削" },
] as const;

const EMBY_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "success", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "skipped", label: "跳过" },
] as const;

function parseActorsTab(path: string): ActorsTab {
  return path.startsWith("/actors/emby") ? "emby" : "local";
}

function parseActorName(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw).get("name")?.trim() ?? "";
}

function formatActorTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function actorInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1);
}

function localStatusClass(status: ActorRow["profileStatus"]): string {
  if (status === "scraped") return "records-pill records-pill--success";
  return "records-pill records-pill--muted";
}

function localStatusLabel(status: ActorRow["profileStatus"]): string {
  if (status === "scraped") return "已刮削";
  return "未刮削";
}

function embyStatusClass(status: EmbyActorRow["status"]): string {
  if (status === "success") return "records-pill records-pill--success";
  if (status === "failed") return "records-pill records-pill--error";
  return "records-pill records-pill--muted";
}

function embyStatusLabel(status: EmbyActorRow["status"]): string {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  return "跳过";
}

function parseEmbySyncRows(result: {
  updatedMeta: number;
  updatedImage: number;
  skipped: number;
  failed: number;
  errors?: string[];
  logs?: string[];
}): EmbyActorRow[] {
  const rows: EmbyActorRow[] = [];
  for (const log of result.logs ?? []) {
    const text = log.trim();
    if (!text) continue;
    const failed = /失败|error|fail/i.test(text);
    const skipped = /跳过|skip/i.test(text);
    rows.push({
      id: `log-${rows.length}-${text.slice(0, 24)}`,
      name: text.replace(/^\[.*?\]\s*/, "").slice(0, 80) || text,
      status: failed ? "failed" : skipped ? "skipped" : "success",
      detail: text,
      error: failed ? text : "",
    });
  }
  for (const err of result.errors ?? []) {
    const text = err.trim();
    if (!text) continue;
    rows.push({
      id: `err-${rows.length}-${text.slice(0, 24)}`,
      name: text.slice(0, 80),
      status: "failed",
      detail: "同步失败",
      error: text,
    });
  }
  if (rows.length) return rows;
  if (result.updatedMeta || result.updatedImage) {
    rows.push({
      id: "summary-ok",
      name: "媒体库演员",
      status: "success",
      detail: `元数据 ${result.updatedMeta} · 图片 ${result.updatedImage}`,
      error: "",
    });
  }
  if (result.skipped) {
    rows.push({
      id: "summary-skip",
      name: "已跳过",
      status: "skipped",
      detail: `${result.skipped} 条`,
      error: "",
    });
  }
  if (result.failed) {
    rows.push({
      id: "summary-fail",
      name: "同步失败",
      status: "failed",
      detail: `${result.failed} 条`,
      error: "",
    });
  }
  return rows;
}

export function ActorsPage({ path, locationSearch, onNavigate, notify }: Props) {
  const tab = parseActorsTab(path);
  const detailName = tab === "local" ? parseActorName(locationSearch) : "";

  if (detailName) {
    return (
      <ActorDetailView
        name={detailName}
        onClose={() => onNavigate("/actors")}
        onNavigate={onNavigate}
        notify={notify}
      />
    );
  }

  return (
    <div className="actors-page">
      <div className="settings-tabs actors-tabs" role="tablist" aria-label="演员管理分类">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "local"}
          className={`settings-tab${tab === "local" ? " active" : ""}`}
          onClick={() => onNavigate("/actors")}
        >
          刮削缓存
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "emby"}
          className={`settings-tab${tab === "emby" ? " active" : ""}`}
          onClick={() => onNavigate("/actors/emby")}
        >
          Emby 刮削
        </button>
      </div>
      {tab === "emby" ? (
        <ActorsEmbyPanel notify={notify} />
      ) : (
        <ActorsLocalPanel onNavigate={onNavigate} notify={notify} />
      )}
    </div>
  );
}

function ActorsLocalPanel({
  onNavigate,
  notify,
}: {
  onNavigate: (path: string) => void;
  notify: NotifyFn;
}) {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actors, setActors] = useState<ActorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActors({
        q,
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
      });
      setActors(data.actors);
      setTotal(data.total);
    } catch (e) {
      notify("error", e, "加载演员失败");
    } finally {
      setLoading(false);
    }
  }, [q, page, status, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchInput.trim() === q) return;
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, q]);

  useEffect(() => {
    setSelected(new Set());
  }, [q, page, status]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const namesOnPage = actors.map((a) => a.name);
  const allSelected = namesOnPage.length > 0 && namesOnPage.every((n) => selected.has(n));
  const statusLabel = LOCAL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "全部";
  const rows = actors;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(namesOnPage) : new Set());
  }

  function toggleOne(name: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  async function runScrape(mode: "selected" | "missing") {
    setScraping(true);
    try {
      const result =
        mode === "selected"
          ? await scrapeActors({ names: [...selected] })
          : await scrapeActors({ missingOnly: true, limit: 100 });
      notify(
        "ok",
        `刮削完成：成功 ${result.ok} / 跳过 ${result.skipped} / 失败 ${result.failed}（共 ${result.total}）`,
      );
      setSelected(new Set());
      await load();
    } catch (e) {
      notify("error", e, mode === "selected" ? "刮削选中失败" : "刮削缺失失败");
    } finally {
      setScraping(false);
    }
  }

  return (
    <section className="panel records-shell">
      <header className="records-page-head">
        <div className="records-page-title-row">
          <h1 className="records-page-title">
            <span className="records-page-title-main">演员管理</span>
            <span className="records-page-title-suffix">— 刮削缓存</span>
          </h1>
          <span className="records-page-count">
            共 <strong>{total}</strong> 位演员
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
            items={LOCAL_STATUS_OPTIONS.map((o) => ({
              id: o.value,
              label: o.label,
              checked: status === o.value,
            }))}
            onSelect={(id) => {
              setStatus(id);
              setPage(1);
            }}
          />
          <div className="records-page-head-meta">
            <div className="records-page-actions">
              <button
                type="button"
                className="btn sm primary solid"
                disabled={loading || scraping || selected.size === 0}
                onClick={() => void runScrape("selected")}
              >
                刮削选中
              </button>
              <button
                type="button"
                className="btn sm"
                disabled={loading || scraping}
                onClick={() => void runScrape("missing")}
              >
                刮削缺失
              </button>
              <button
                type="button"
                className="records-icon-btn"
                title="刷新"
                disabled={loading || scraping}
                onClick={() => void load()}
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
        loading={loading || scraping}
        emptyText={scraping ? "正在刮削演员档案…" : COPY.emptyActors}
        colCount={11}
        allSelected={allSelected}
        onToggleAll={toggleAll}
      >
        {rows.map((a, i) => (
          <tr
            key={a.name}
            className="records-row-clickable"
            onClick={() => onNavigate(`/actors?name=${encodeURIComponent(a.name)}`)}
          >
            <td className="records-col-check" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected.has(a.name)}
                onChange={(e) => toggleOne(a.name, e.target.checked)}
              />
            </td>
            <td className="records-col-index">{(page - 1) * PAGE_SIZE + i + 1}</td>
            <td className="actors-col-avatar">
              {a.avatarUrl ? (
                <img className="actors-avatar actors-avatar--img" src={a.avatarUrl} alt="" />
              ) : (
                <span className="actors-avatar" aria-hidden>
                  {actorInitial(a.name)}
                </span>
              )}
            </td>
            <td className="actors-col-name">{a.name}</td>
            <td className="actors-col-status">
              <span className={localStatusClass(a.profileStatus)}>
                {localStatusLabel(a.profileStatus)}
              </span>
            </td>
            <td className="actors-col-backdrop">—</td>
            <td className="actors-col-detail" title={a.overview || a.codes.join("、")}>
              {a.overview?.trim()
                ? a.overview
                : `${a.workCount} 部 · ${a.kinds.map((k) => kindLabel(k) || k).join("、") || "—"}`}
            </td>
            <td className="records-col-time">—</td>
            <td className="records-col-time">
              {formatActorTime(a.profileScrapedAt ?? a.lastScrapedAt)}
            </td>
            <td className="actors-col-error">—</td>
            <td className="records-col-op">查看</td>
          </tr>
        ))}
      </ActorsTable>

      {pageCount > 1 || total > 0 ? (
        <div className="pagination records-pagination">
          <button
            type="button"
            className="btn sm ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← 上一页
          </button>
          <span className="records-page-indicator">{page}</span>
          <button
            type="button"
            className="btn sm ghost"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页 →
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ActorsEmbyPanel({ notify }: { notify: NotifyFn }) {
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [rows, setRows] = useState<EmbyActorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connReady, setConnReady] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOpsConfig();
      const a = data.config.actors;
      setConnReady(Boolean(a?.embyUrl?.trim() && a?.embyApiKey?.trim()));
    } catch (e) {
      notify("error", e, "加载 Emby 配置失败");
      setConnReady(false);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

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
                disabled={loading || syncing || !connReady}
                onClick={() => void runLibraryScan()}
              >
                <ArrowPathIcon aria-hidden />
                媒体库检索
              </button>
              <button
                type="button"
                className="records-icon-btn"
                title="刷新"
                disabled={loading || syncing}
                onClick={() => void loadConfig()}
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
        loading={loading || syncing}
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

function ActorsTable({
  loading,
  emptyText,
  colCount,
  allSelected,
  onToggleAll,
  children,
}: {
  loading: boolean;
  emptyText: string;
  colCount: number;
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  children: ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="records-table-wrap">
      <table className="records-table data-table actors-table">
        <colgroup>
          <col className="records-col-check" />
          <col className="records-col-index" />
          <col className="actors-col-avatar" />
          <col className="actors-col-name" />
          <col className="actors-col-status" />
          <col className="actors-col-backdrop" />
          <col className="actors-col-detail" />
          <col className="records-col-time" />
          <col className="records-col-time" />
          <col className="actors-col-error" />
          <col className="records-col-op" />
        </colgroup>
        <thead>
          <tr>
            <th className="records-col-check">
              <input
                type="checkbox"
                aria-label="全选"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th className="records-col-index">#</th>
            <th className="actors-col-avatar">头像</th>
            <th className="actors-col-name">演员名称</th>
            <th className="actors-col-status">状态</th>
            <th className="actors-col-backdrop">背景图</th>
            <th className="actors-col-detail">详细信息</th>
            <th className="records-col-time">创建时间</th>
            <th className="records-col-time">完成时间</th>
            <th className="actors-col-error">错误信息</th>
            <th className="records-col-op">操作</th>
          </tr>
        </thead>
        <tbody>
          {loading && !hasRows ? (
            <tr>
              <td colSpan={colCount} className="empty">
                加载中…
              </td>
            </tr>
          ) : !hasRows ? (
            <tr>
              <td colSpan={colCount} className="empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
