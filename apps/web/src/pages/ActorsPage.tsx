import { useCallback, useEffect, useState } from "react";
import { fetchActors } from "../api";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { COPY } from "../lib/messages";
import { kindLabel } from "../lib/labels";
import type { ActorRow } from "../types";
import type { NotifyFn } from "../lib/notify";

type Props = {
  notify: NotifyFn;
};

export function ActorsPage({ notify }: Props) {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actors, setActors] = useState<ActorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActors({ q, page, pageSize });
      setActors(data.actors);
      setTotal(data.total);
    } catch (e) {
      notify("error", e, "加载演员失败");
    } finally {
      setLoading(false);
    }
  }, [q, page, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        title="演员管理"
        description="本地刮削缓存聚合；Emby 真同步请到设置 · 演员"
      />

      <div className="toolbar" style={{ marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ minWidth: 220 }}
          placeholder="搜索演员名…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              setQ(draft.trim());
            }
          }}
        />
        <button
          type="button"
          className="btn"
          onClick={() => {
            setPage(1);
            setQ(draft.trim());
          }}
        >
          搜索
        </button>
        <span className="text-muted">共 {total} 位</span>
      </div>

      {loading ? (
        <div className="empty-block">加载中…</div>
      ) : !actors.length ? (
        <EmptyState title="暂无数据" description={COPY.emptyActors} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>演员</th>
                  <th>作品数</th>
                  <th>分区</th>
                  <th>最近番号</th>
                  <th>最近刮削</th>
                </tr>
              </thead>
              <tbody>
                {actors.map((a, i) => (
                  <tr key={a.name}>
                    <td>{(page - 1) * pageSize + i + 1}</td>
                    <td>{a.name}</td>
                    <td>{a.workCount}</td>
                    <td>
                      {a.kinds.map((k) => kindLabel(k) || k).join("、") || "—"}
                    </td>
                    <td className="text-muted">{a.codes.slice(0, 5).join(", ") || "—"}</td>
                    <td className="text-muted">
                      {a.lastScrapedAt
                        ? new Date(a.lastScrapedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="toolbar" style={{ marginTop: 12, gap: 8 }}>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className="text-muted">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </>
  );
}
