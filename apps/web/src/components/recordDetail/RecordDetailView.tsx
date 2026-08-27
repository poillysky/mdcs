import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import {
  ArrowPathIcon,
  CheckIcon,
  PencilSquareIcon,
  PhotoIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { LazyCover } from "../LazyCover";
import { CoverCropModal } from "../CoverCropModal";
import { RecordMetaEditModal } from "../RecordMetaEditModal";
import { RecordTaskActionModal } from "../RecordTaskActionModal";
import { FILE_STATUS_LABELS } from "../../lib/labels";
import {
  appendAssetCacheBust,
  resolveCoverImageSrc,
  resolveGalleryImageSrcs,
} from "../../lib/metaDisplay";
import { fetchFileGallery, fetchFilePipelineLog } from "../../api";
import type { LogRunOption, LogStep, RecordDetailViewProps } from "./types";
import {
  buildDetailFields,
  formatFieldValue,
  formatRating,
  formatRuntime,
  fullNavLabel,
  mosaicLabel,
  shortNavLabel,
} from "./detailFields";
import {
  buildLogSteps,
  parseScrapedAtMs,
  pickLatestLogRun,
  pipelineRunLabel,
  sanitizePipelineLogText,
  sortLogRunsChronological,
  toLogRunOption,
} from "./pipelineLog";
import { FieldSourceBadge } from "./FieldSourceBadge";

export function RecordDetailView({
  file,
  meta,
  loading,
  detailId,
  listItems,
  highlightSource,
  onHighlightSource,
  onClose,
  onNavigate,
  onTaskAction,
  onDelete,
  onMetaSave,
  onMetaRefresh,
  onFileRefresh,
}: RecordDetailViewProps) {
  const galleryRef = useRef<HTMLElement | null>(null);
  const [metaEditOpen, setMetaEditOpen] = useState(false);
  const [coverCropOpen, setCoverCropOpen] = useState(false);
  const [coverVersion, setCoverVersion] = useState(0);
  const [taskActionOpen, setTaskActionOpen] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<LogStep[] | null>(null);
  const [pipelineRuns, setPipelineRuns] = useState<LogRunOption[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollGenRef = useRef(0);
  const pipelineWaitRefreshRef = useRef(false);

  const stopPipelinePoll = () => {
    pollGenRef.current += 1;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const applyPipelineLog = (
    p: Awaited<ReturnType<typeof fetchFilePipelineLog>>,
    opts?: { keepSelectedRun?: boolean },
  ) => {
    const runs = (p.runs ?? []).map(toLogRunOption);
    setPipelineRuns(runs);
    // 仅 active 时保持「进行中」；结束后即使内存里还有 steps 也退出
    if (p.active) {
      const liveSteps = (p.steps ?? []).map((step) => ({
        title: step.title,
        done: step.done,
        items: (step.items ?? []).map((item) => ({
          tone: item.tone,
          text: sanitizePipelineLogText(item.text),
        })),
      }));
      setPipelineSteps(liveSteps.length ? liveSteps : []);
      setSelectedRunId("__live__");
      return true;
    }
    setPipelineSteps(null);
    if (runs.length) {
      const latest = pickLatestLogRun(runs)!;
      if (opts?.keepSelectedRun) {
        setSelectedRunId((prev) =>
          prev && prev !== "__live__" && runs.some((r) => r.id === prev) ? prev : latest.id,
        );
      } else {
        setSelectedRunId(latest.id);
      }
    } else {
      setSelectedRunId("");
    }
    return false;
  };

  const startPipelinePoll = (fileId: number) => {
    stopPipelinePoll();
    const gen = pollGenRef.current;
    pollRef.current = setInterval(() => {
      void fetchFilePipelineLog(fileId)
        .then((p) => {
          if (gen !== pollGenRef.current) return;
          const stillActive = applyPipelineLog(p);
          if (!stillActive) stopPipelinePoll();
        })
        .catch(() => {
          /* 轮询静默失败 */
        });
    }, 400);
  };

  useEffect(() => {
    setMetaEditOpen(false);
    setCoverCropOpen(false);
    setCoverVersion(0);
    setTaskActionOpen(false);
    setPipelineSteps(null);
    setPipelineRuns([]);
    setSelectedRunId("");
    setGalleryImages([]);
    stopPipelinePoll();
  }, [detailId]);

  useEffect(() => {
    if (pipelineWaitRefreshRef.current && pipelineSteps === null && !pollRef.current) {
      pipelineWaitRefreshRef.current = false;
    }
  }, [meta, file?.status, file?.organized_at, file?.scraped_at, pipelineSteps]);

  useEffect(
    () => () => {
      stopPipelinePoll();
    },
    [],
  );

  useEffect(() => {
    if (!file?.id) {
      setPipelineRuns([]);
      setSelectedRunId("");
      return;
    }
    let cancelled = false;
    void fetchFilePipelineLog(file.id)
      .then((p) => {
        if (cancelled) return;
        const stillActive = applyPipelineLog(p, { keepSelectedRun: true });
        if (stillActive) startPipelinePoll(file.id);
        else stopPipelinePoll();
      })
      .catch(() => {
        if (!cancelled) setPipelineRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [file?.id, file?.scraped_at, file?.organized_at, meta?.scrapedAt]);

  const plot = meta?.plot || meta?.originalPlot || "";

  const index = listItems.findIndex((f) => f.id === detailId);
  const prevItem = index > 0 ? listItems[index - 1] : null;
  const nextItem = index >= 0 && index < listItems.length - 1 ? listItems[index + 1] : null;

  const displayTitle = meta?.titleZh || meta?.title || file?.title || file?.code || file?.file_name || "—";
  const displayCode = meta?.code || file?.code || "";
  const heroTitle =
    displayCode && displayTitle !== displayCode
      ? `${displayCode} ${displayTitle}`
      : displayTitle;
  const rating = formatRating(meta);
  const actors = meta?.actors ?? (file?.actors ? file.actors.split(/[,，]/).map((s) => s.trim()) : []);
  const genres = meta?.genres ?? [];
  const cover = resolveCoverImageSrc(meta, file);
  const coverDisplay =
    cover && coverVersion > 0
      ? `${cover}${cover.includes("?") ? "&" : "?"}cv=${coverVersion}`
      : cover;

  // 固定字段表全量展示（空值显示 —），避免漏番号等标识字段
  const detailFields = useMemo(
    () => (file ? buildDetailFields(file, meta) : []),
    [file, meta],
  );

  const studio = meta?.studio || meta?.publisher || "";
  const series = String(meta?.series || "").trim();
  const directors = (meta?.directors ?? []).filter(Boolean);
  const directorText = directors.length ? directors.join("、") : "";

  useEffect(() => {
    if (!file) {
      setGalleryImages([]);
      return;
    }
    const fallback = resolveGalleryImageSrcs(meta, file);
    if (!file.id) {
      setGalleryImages(fallback);
      return;
    }
    let cancelled = false;
    void fetchFileGallery(file.id)
      .then((data) => {
        if (cancelled) return;
        const urls = (data.items ?? [])
          .map((item) => item.url)
          .filter(Boolean)
          .map((url) => appendAssetCacheBust(url, file, meta));
        setGalleryImages(urls.length ? urls : fallback);
      })
      .catch(() => {
        if (!cancelled) setGalleryImages(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [file, meta, file?.id, file?.scraped_at, file?.organized_at, file?.file_mtime, meta?.scrapedAt]);

  const logRunOptions = useMemo((): LogRunOption[] => {
    if (!file) return [];
    let options = [...pipelineRuns];
    const hasInitial = options.some((r) => r.kind === "initial");
    if (!hasInitial) {
      if (options.length) {
        // 无首次归档时：用时间最早的一条充当首次，勿用最新 scraped_at
        const oldest = options.reduce((best, r) => (r.at < best.at ? r : best));
        options = options.map((r) =>
          r.id === oldest.id ? { ...r, kind: "initial" as const } : r,
        );
      } else {
        options.push({
          id: `initial-${file.id}`,
          kind: "initial",
          at: parseScrapedAtMs(file, meta),
          steps: buildLogSteps(file, meta),
        });
      }
    }
    return sortLogRunsChronological(options);
  }, [file, meta, pipelineRuns]);

  const latestLogRun = useMemo(
    () => pickLatestLogRun(logRunOptions),
    [logRunOptions],
  );

  const selectedLogRun = useMemo(() => {
    if (!logRunOptions.length) return null;
    return logRunOptions.find((r) => r.id === selectedRunId) ?? latestLogRun ?? null;
  }, [logRunOptions, selectedRunId, latestLogRun]);

  const logSteps = useMemo(() => {
    if (pipelineSteps !== null) return pipelineSteps;
    return selectedLogRun?.steps ?? (file ? buildLogSteps(file, meta) : []);
  }, [file, meta, pipelineSteps, selectedLogRun]);

  useEffect(() => {
    if (pipelineSteps !== null) return;
    if (!selectedRunId && latestLogRun) {
      setSelectedRunId(latestLogRun.id);
    } else if (
      selectedRunId &&
      selectedRunId !== "__live__" &&
      logRunOptions.length &&
      !logRunOptions.some((r) => r.id === selectedRunId)
    ) {
      setSelectedRunId(latestLogRun?.id ?? "");
    }
  }, [logRunOptions, selectedRunId, pipelineSteps, latestLogRun]);

  const resultBadge = useMemo(() => {
    const status = file?.status ?? "";
    if (status === "failed" || meta?.ok === false) {
      return { label: "失败", className: "rd-status rd-status--fail" };
    }
    if (status === "done" || status === "scraped") {
      return { label: "成功", className: "rd-status rd-status--ok" };
    }
    if (status === "skipped") {
      return { label: "取消", className: "rd-status rd-status--muted" };
    }
    if (status === "scraping" || status === "organizing") {
      return { label: "处理中", className: "rd-status rd-status--pending" };
    }
    if (status === "pending" || status === "planned") {
      return { label: "等待中", className: "rd-status rd-status--pending" };
    }
    return {
      label: (FILE_STATUS_LABELS[status] ?? status) || "—",
      className: "rd-status rd-status--pending",
    };
  }, [file?.status, meta?.ok]);

  if (loading && !file) {
    return (
      <div className="record-detail">
        <div className="record-detail-nav">
          <button type="button" className="record-detail-nav-back" onClick={onClose}>
            返回列表
          </button>
        </div>
        <div className="empty-block">加载详情…</div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="record-detail">
        <div className="record-detail-nav">
          <button type="button" className="record-detail-nav-back" onClick={onClose}>
            返回列表
          </button>
        </div>
        <div className="empty-block">记录不存在</div>
      </div>
    );
  }

  const fs = meta?.fieldSources ?? {};

  return (
    <div className="record-detail">
      <nav className="record-detail-nav" aria-label="详情导航">
        <button
          type="button"
          className="record-detail-nav-side"
          disabled={!prevItem}
          title={prevItem ? fullNavLabel(prevItem) : undefined}
          onClick={() => prevItem && onNavigate(prevItem.id)}
        >
          <ChevronLeftIcon aria-hidden />
          <span>{prevItem ? shortNavLabel(prevItem) : "—"}</span>
        </button>
        <button type="button" className="record-detail-nav-back" onClick={onClose}>
          返回列表
        </button>
        <button
          type="button"
          className="record-detail-nav-side record-detail-nav-side--next"
          disabled={!nextItem}
          title={nextItem ? fullNavLabel(nextItem) : undefined}
          onClick={() => nextItem && onNavigate(nextItem.id)}
        >
          <span>{nextItem ? shortNavLabel(nextItem) : "—"}</span>
          <ChevronRightIcon aria-hidden />
        </button>
      </nav>

      <section className="record-detail-top">
        <aside className="record-detail-aside">
          <div className="record-detail-poster">
            <LazyCover src={coverDisplay} alt={heroTitle} className="record-detail-poster-img" />
          </div>
        </aside>

        <div className="record-detail-hero-main">
          <h1 className="record-detail-title">{heroTitle}</h1>
          <div className="record-detail-title-tools">
            <span className={resultBadge.className}>{resultBadge.label}</span>
            <div className="record-detail-actions">
              <button
                type="button"
                className="record-detail-icon-btn"
                title="编辑元数据"
                onClick={() => setMetaEditOpen(true)}
              >
                <PencilSquareIcon aria-hidden />
              </button>
              <button
                type="button"
                className="record-detail-icon-btn"
                title="封面裁剪"
                onClick={() => setCoverCropOpen(true)}
              >
                <PhotoIcon aria-hidden />
              </button>
              <button type="button" className="record-detail-icon-btn" title="删除" onClick={onDelete}>
                <TrashIcon aria-hidden />
              </button>
              <button
                type="button"
                className="record-detail-icon-btn"
                title="任务操作"
                onClick={() => setTaskActionOpen(true)}
              >
                <ArrowPathIcon aria-hidden />
              </button>
            </div>
          </div>

          <div className="record-detail-meta-row">
            {rating ? (
              <span className="record-detail-rating">
                <StarIcon className="record-detail-star" aria-hidden />
                {rating}
              </span>
            ) : null}
            <span className="record-detail-actors">
              {actors.length ? (
                actors.map((name, i) => (
                  <span key={name}>
                    {i > 0 ? "、" : ""}
                    <button type="button" className="record-detail-actor-link">
                      {name}
                    </button>
                  </span>
                ))
              ) : (
                <span className="record-detail-actors-unknown">未知演员</span>
              )}
            </span>
            {meta?.premiered ? <span>{meta.premiered}</span> : null}
            {meta?.runtime ? <span>{formatRuntime(meta.runtime)}</span> : null}
          </div>

          {genres.length ? (
            <div className="record-detail-tags">
              {genres.map((tag) => (
                <span key={tag} className="record-detail-tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {plot ? (
            <div className="record-detail-plot-wrap">
              <p className="record-detail-plot">{plot}</p>
            </div>
          ) : null}

          {directorText || studio || series ? (
            <p className="record-detail-credits">
              {directorText ? <span className="record-detail-credit">导演: {directorText}</span> : null}
              {directorText && (studio || series) ? (
                <span className="record-detail-credit-dot" aria-hidden>
                  ·
                </span>
              ) : null}
              {studio ? <span className="record-detail-credit">制作: {studio}</span> : null}
              {studio && series ? (
                <span className="record-detail-credit-dot" aria-hidden>
                  ·
                </span>
              ) : null}
              {series ? <span className="record-detail-credit">系列: {series}</span> : null}
            </p>
          ) : null}
        </div>
      </section>

      {galleryImages.length ? (
        <section className="record-detail-gallery" ref={galleryRef}>
          <h2 className="record-detail-gallery-title">画廊</h2>
          <div className="record-detail-gallery-track">
            {galleryImages.map((url) => (
              <a
                key={url}
                className="record-detail-gallery-item"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LazyCover src={url} alt="" className="record-detail-gallery-img" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <div className="record-detail-grid">
        <section className="record-detail-panel">
          <h2 className="record-detail-section-title">详细数据</h2>
          <div className="record-detail-table">
            {detailFields.length ? (
              detailFields.map((row) => {
                const hasCode = Boolean(meta?.code || file?.code);
                const source =
                  (row.sourceKey && fs[row.sourceKey]) ||
                  (row.key === "code" && hasCode ? "系统解析" : undefined) ||
                  (row.key === "mosaic" && !fs.mosaic
                    ? mosaicLabel(meta?.mosaic || file?.mosaic) !== "—"
                      ? "系统解析"
                      : undefined
                    : undefined);
                const val = row.value;
                const text = formatFieldValue(val);
                return (
                  <div
                    key={row.key}
                    className={`record-detail-row${row.multiline ? " is-multiline" : ""}`}
                  >
                    <div className="record-detail-row-label">{row.label}</div>
                    <div
                      className={`record-detail-row-value${row.multiline ? " is-multiline" : ""}`}
                    >
                      {row.isTags && Array.isArray(val) && val.length ? (
                        <div className="record-detail-inline-tags">
                          {val.map((tag) => (
                            <span key={String(tag)} className="record-detail-tag sm">
                              {String(tag)}
                            </span>
                          ))}
                        </div>
                      ) : row.key === "actors" && Array.isArray(val) && val.length ? (
                        <span>{val.map(String).join("、")}</span>
                      ) : row.isLink && typeof val === "string" && text !== "—" ? (
                        <a
                          href={val}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="record-detail-link record-detail-url"
                        >
                          {val}
                        </a>
                      ) : (
                        text
                      )}
                    </div>
                    <div className="record-detail-row-src">
                      {source ? (
                        <FieldSourceBadge
                          source={source}
                          active={highlightSource === source}
                          onClick={() =>
                            onHighlightSource(highlightSource === source ? null : source)
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="hint">尚无刮削缓存</p>
            )}
          </div>
        </section>

        <section className="record-detail-panel">
          <h2 className="record-detail-section-title">刮削日志</h2>
          {logRunOptions.length > 0 ? (
            <div className="record-detail-log-select-wrap">
              <select
                className="record-detail-log-select"
                aria-label="选择日志记录"
                value={
                  pipelineSteps !== null
                    ? "__live__"
                    : selectedLogRun?.id ||
                      (selectedRunId !== "__live__" ? selectedRunId : "") ||
                      latestLogRun?.id ||
                      ""
                }
                disabled={pipelineSteps !== null}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === "__live__") return;
                  setSelectedRunId(id);
                  setPipelineSteps(null);
                }}
              >
                {pipelineSteps !== null ? (
                  <option value="__live__">进行中…</option>
                ) : null}
                {logRunOptions.map((run) => (
                  <option key={run.id} value={run.id}>
                    {pipelineRunLabel(run.kind, run.at)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="record-detail-log">
            {logSteps.length === 0 && pipelineSteps !== null ? (
              <p className="hint">任务进行中，等待日志…</p>
            ) : null}
            {logSteps.map((step) => (
              <div key={step.title} className={`record-detail-log-step${step.done ? " is-done" : ""}`}>
                <div className="record-detail-log-head">
                  <span className="record-detail-log-node" aria-hidden>
                    {step.done ? <CheckIcon /> : null}
                  </span>
                  <h3>{step.title}</h3>
                </div>
                <ul className="record-detail-log-items">
                  {step.items.map((item, i) => {
                    const highlighted =
                      Boolean(highlightSource) &&
                      item.text.toLowerCase().includes(`<${highlightSource!.toLowerCase()}>`);
                    return (
                      <li
                        key={i}
                        className={`record-detail-log-item tone-${item.tone}${highlighted ? " is-highlight" : ""}`}
                      >
                        {item.text}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <RecordMetaEditModal
        open={metaEditOpen}
        file={file}
        meta={meta}
        onClose={() => setMetaEditOpen(false)}
        onSave={onMetaSave}
        onMetaRefresh={onMetaRefresh}
      />

      <CoverCropModal
        open={coverCropOpen}
        file={file}
        onClose={() => setCoverCropOpen(false)}
        onDone={(updatedAt) => {
          setCoverVersion(updatedAt);
          void onFileRefresh?.();
        }}
      />

      <RecordTaskActionModal
        open={taskActionOpen}
        file={file}
        onClose={() => setTaskActionOpen(false)}
        onConfirm={(opts) => {
          setTaskActionOpen(false);
          setPipelineSteps([]);
          setSelectedRunId("__live__");
          startPipelinePoll(file.id);
          void (async () => {
            try {
              await onTaskAction(opts);
            } finally {
              stopPipelinePoll();
              try {
                const p = await fetchFilePipelineLog(file.id);
                if (applyPipelineLog(p)) startPipelinePoll(file.id);
              } catch {
                setPipelineSteps(null);
              }
              pipelineWaitRefreshRef.current = true;
            }
          })();
        }}
      />
    </div>
  );
}
