import { PageHeader } from "../components/ui/PageHeader";
import { LazyCover } from "../components/LazyCover";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchFileDetail,
  fetchFiles,
  rescrapeFile,
  retryFiles,
  scrapeCode,
} from "../api";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { FILE_STATUS_LABELS, formatTime, kindLabel } from "../lib/labels";
import { COPY } from "../lib/messages";
import type { NotifyFn } from "../lib/notify";
import type { FileRow, KindRow, ScrapeMetaView } from "../types";

type Props = {
  kinds: KindRow[];
  notify: NotifyFn;
};

const PAGE_SIZE = 30;

const META_FIELDS: Array<{ key: keyof ScrapeMetaView; label: string }> = [
  { key: "title", label: "标题" },
  { key: "titleZh", label: "中文标题" },
  { key: "plot", label: "简介" },
  { key: "actors", label: "演员" },
  { key: "genres", label: "标签" },
  { key: "studio", label: "片商" },
  { key: "publisher", label: "发行" },
  { key: "series", label: "系列" },
  { key: "premiered", label: "发行日" },
  { key: "runtime", label: "时长" },
  { key: "mosaic", label: "马赛克" },
  { key: "coverUrl", label: "封面" },
];

function formatFieldValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

export function RecordsPage({ kinds, notify }: Props) {
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailFile, setDetailFile] = useState<FileRow | null>(null);
  const [detailMeta, setDetailMeta] = useState<ScrapeMetaView | null>(null);
  const [highlightSource, setHighlightSource] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState("");
  const [debugKind, setDebugKind] = useState("japan_censored");
  const [debugBusy, setDebugBusy] = useState(false);
  const [debugJson, setDebugJson] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFiles({
        kind: kind || undefined,
        status: status || undefined,
        q: q.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setFiles(data.files);
      setTotal(data.total);
    } catch (e) {
      notify("error", e, "加载刮削记录失败");
    } finally {
      setLoading(false);
    }
  }, [kind, status, q, page, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!kinds.length) return;
    if (!debugKind) setDebugKind(kinds[0].id);
  }, [kinds, debugKind]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const idsOnPage = useMemo(() => files.map((f) => f.id), [files]);

  async function openDetail(id: number) {
    setDetailId(id);
    setHighlightSource(null);
    try {
      const data = await fetchFileDetail(id);
      setDetailFile(data.file);
      setDetailMeta(data.meta);
    } catch (e) {
      notify("error", e, "加载详情失败");
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetailFile(null);
    setDetailMeta(null);
    setHighlightSource(null);
  }

  async function batchRetry() {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      const r = await retryFiles(ids);
      notify("ok", `已重置 ${r.updated} 条为待处理`);
      setSelected(new Set());
      void load();
    } catch (e) {
      notify("error", e, "批量重试失败");
    }
  }

  async function doRescrape(id: number) {
    try {
      const r = await rescrapeFile(id, true);
      notify(r.meta.ok ? "ok" : "warn", r.meta.ok ? "重刮成功" : r.meta.message || "重刮未成功");
      void load();
      if (detailId === id) void openDetail(id);
    } catch (e) {
      notify("error", e, "重刮失败");
    }
  }

  async function runDebug(force = false) {
    if (!debugCode.trim()) return;
    setDebugBusy(true);
    setDebugJson("");
    try {
      const { meta } = await scrapeCode({
        code: debugCode.trim(),
        kind: debugKind,
        force,
        channel: "auto",
      });
      setDebugJson(JSON.stringify(meta, null, 2));
      notify(
        (meta as { ok?: boolean }).ok ? "ok" : "warn",
        (meta as { message?: string }).message || "调试完成",
      );
      void load();
    } catch (e) {
      notify("error", e, "调试刮削失败");
    } finally {
      setDebugBusy(false);
    }
  }

  if (detailId != null && detailFile) {
    const fs = detailMeta?.fieldSources ?? {};
    const runs = detailMeta?.sourceRuns ?? [];
    return (
      <div className="records-detail">
        <PageHeader
          title={detailFile.code || detailFile.file_name}
          description={`${kindLabel(detailFile.kind)} · ${FILE_STATUS_LABELS[detailFile.status] ?? detailFile.status}`}
        />
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <button type="button" className="btn" onClick={closeDetail}>
            ← 返回列表
          </button>
          <button type="button" className="btn primary" onClick={() => void doRescrape(detailFile.id)}>
            强制重刮
          </button>
        </div>
        <div className="records-detail-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>字段与来源</h2>
            </div>
            <div className="panel-body">
              {META_FIELDS.map(({ key, label }) => {
                const src = fs[key === "coverUrl" ? "cover" : String(key)];
                const val = detailMeta ? detailMeta[key] : undefined;
                return (
                  <div key={String(key)} className="records-field-row">
                    <div className="records-field-label">{label}</div>
                    <div className="records-field-value">
                      {key === "coverUrl" && typeof val === "string" && val ? (
                        <LazyCover
                          src={val}
                          alt="封面"
                          style={{ maxWidth: 160, maxHeight: 220, objectFit: "cover" }}
                        />
                      ) : (
                        formatFieldValue(val)
                      )}
                    </div>
                    {src ? (
                      <button
                        type="button"
                        className={`tag sm${highlightSource === src ? " active" : ""}`}
                        onClick={() => setHighlightSource(src === highlightSource ? null : src)}
                      >
                        {src}
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                );
              })}
              {!detailMeta ? <p className="hint">尚无刮削缓存</p> : null}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>源时间线</h2>
            </div>
            <div className="panel-body">
              {runs.length === 0 ? (
                <p className="hint">无 sourceRuns（可能来自旧缓存）</p>
              ) : (
                <ul className="records-timeline">
                  {runs.map((r, i) => (
                    <li
                      key={`${r.id}-${i}`}
                      className={`records-run${highlightSource === r.id ? " highlight" : ""}${r.ok ? "" : " fail"}`}
                    >
                      <strong>{r.id}</strong>
                      <span className="tag sm">{r.channel}</span>
                      <span>{r.ms}ms</span>
                      <span>{r.ok ? "ok" : r.error || "fail"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint" style={{ marginTop: 12 }}>
                路径：{detailFile.source_path}
                {detailFile.mosaic ? ` · mosaic=${detailFile.mosaic}` : ""}
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="刮削记录" description="筛选、批量重试与字段来源时间线" />

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>单番号调试</h2>
        </div>
        <div className="panel-body form-grid two">
          <label>
            <span>番号</span>
            <input value={debugCode} onChange={(e) => setDebugCode(e.target.value)} placeholder="SSIS-001" />
          </label>
          <label>
            <span>分区</span>
            <select value={debugKind} onChange={(e) => setDebugKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <div className="toolbar" style={{ gridColumn: "1 / -1" }}>
            <button type="button" className="btn primary" disabled={debugBusy} onClick={() => void runDebug(false)}>
              {debugBusy ? "刮削中…" : "刮削"}
            </button>
            <button type="button" className="btn" disabled={debugBusy} onClick={() => void runDebug(true)}>
              强制重刮
            </button>
          </div>
          {debugJson ? (
            <pre className="code-block" style={{ gridColumn: "1 / -1", maxHeight: 240, overflow: "auto" }}>
              {debugJson}
            </pre>
          ) : null}
        </div>
      </section>

      <div className="toolbar" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
          <option value="">全部分区</option>
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>{k.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          {Object.entries(FILE_STATUS_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <input
          style={{ minWidth: 180 }}
          value={q}
          placeholder="搜索番号/路径/标题"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setPage(1); void load(); }
          }}
        />
        <button type="button" className="btn" onClick={() => { setPage(1); void load(); }}>
          搜索
        </button>
        <button type="button" className="btn" disabled={!selected.size} onClick={() => void batchRetry()}>
          批量重试 ({selected.size})
        </button>
      </div>

      {loading ? (
        <div className="empty-block">加载中…</div>
      ) : files.length === 0 ? (
        <EmptyState title="暂无刮削记录" description={COPY.emptyRecords} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={idsOnPage.length > 0 && idsOnPage.every((id) => selected.has(id))}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const id of idsOnPage) {
                          if (e.target.checked) next.add(id);
                          else next.delete(id);
                        }
                        return next;
                      });
                    }}
                  />
                </th>
                <th>番号</th>
                <th>标题</th>
                <th>分区</th>
                <th>状态</th>
                <th>mosaic</th>
                <th>来源</th>
                <th>时间</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(f.id);
                          else next.delete(f.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td>
                    <button type="button" className="linkish" onClick={() => void openDetail(f.id)}>
                      {f.code || "—"}
                    </button>
                  </td>
                  <td className="ellipsis" title={f.title || f.file_name}>
                    {f.title || f.file_name}
                  </td>
                  <td>{kindLabel(f.kind)}</td>
                  <td>
                    <StatusBadge status={f.status} map={FILE_STATUS_LABELS} />
                  </td>
                  <td>{f.mosaic || "—"}</td>
                  <td>{f.scrape_source || "—"}</td>
                  <td>{f.scraped_at ? formatTime(f.scraped_at) : "—"}</td>
                  <td>
                    <button type="button" className="btn sm" onClick={() => void doRescrape(f.id)}>
                      重刮
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <span className="text-muted">
            {page} / {pageCount}（共 {total}）
          </span>
          <button
            type="button"
            className="btn"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      ) : null}
    </>
  );
}
