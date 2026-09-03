import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { RecordsMenuDropdown } from "../../components/RecordsMenuDropdown";
import { fetchActors, scrapeActors } from "../../api";
import { useCachedQuery, listQueryKey } from "../../hooks/useCachedQuery";
import { COPY } from "../../lib/messages";
import { kindLabel } from "../../lib/labels";
import type { ActorRow } from "../../types";
import type { NotifyFn } from "../../lib/notify";
import {
  actorInitial,
  formatActorTime,
  localStatusClass,
  localStatusLabel,
} from "./actorsDisplay";
import { ActorsTable } from "./ActorsTable";
import { LOCAL_STATUS_OPTIONS, PAGE_SIZE } from "./types";

export function ActorsLocalPanel({
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const listKey = useMemo(
    () => listQueryKey("actors-local", { q, page, status, pageSize: PAGE_SIZE }),
    [q, page, status],
  );
  const {
    data: listData,
    loading,
    refreshing,
    reload,
  } = useCachedQuery({
    key: listKey,
    fetcher: async () => {
      const data = await fetchActors({
        q,
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
      });
      return { actors: data.actors, total: data.total };
    },
    onError: (e) => notify("error", e, "加载演员失败"),
  });
  const actors = listData?.actors ?? [];
  const total = listData?.total ?? 0;
  const [scraping, setScraping] = useState(false);

  const load = useCallback(async () => {
    await reload({ silent: Boolean(listData) });
  }, [reload, listData]);

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
        refreshing={refreshing && !scraping}
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
