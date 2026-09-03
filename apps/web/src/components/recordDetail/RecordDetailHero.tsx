import {
  ArrowPathIcon,
  PencilSquareIcon,
  PhotoIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { useMemo } from "react";
import { LazyCover } from "../LazyCover";
import { recordTableStatusLabel } from "../../pages/records/recordsDisplay";
import { isFilePipelineWaiting } from "../../lib/filePipelineStatus";
import { resolveCoverImageSrc } from "../../lib/metaDisplay";
import type { FileRow, ScrapeMetaView } from "../../types";
import { formatRating, formatRuntime } from "./detailFields";

type Props = {
  file: FileRow;
  meta: ScrapeMetaView | null;
  coverVersion: number;
  onEditMeta: () => void;
  onCropCover: () => void;
  onDelete: () => void;
  onTaskAction: () => void;
};

export function RecordDetailHero({
  file,
  meta,
  coverVersion,
  onEditMeta,
  onCropCover,
  onDelete,
  onTaskAction,
}: Props) {
  const plot = meta?.plot || meta?.originalPlot || "";
  const displayTitle = meta?.titleZh || meta?.title || file.title || file.code || file.file_name || "—";
  const displayCode = meta?.code || file.code || "";
  const heroTitle =
    displayCode && displayTitle !== displayCode
      ? `${displayCode} ${displayTitle}`
      : displayTitle;
  const rating = formatRating(meta);
  const actors = meta?.actors ?? (file.actors ? file.actors.split(/[,，]/).map((s) => s.trim()) : []);
  const genres = meta?.genres ?? [];
  const cover = resolveCoverImageSrc(meta, file);
  const coverDisplay =
    cover && coverVersion > 0
      ? `${cover}${cover.includes("?") ? "&" : "?"}cv=${coverVersion}`
      : cover;
  const isWaiting = isFilePipelineWaiting(file.status);

  const studio = meta?.studio || meta?.publisher || "";
  const series = String(meta?.series || "").trim();
  const directors = (meta?.directors ?? []).filter(Boolean);
  const directorText = directors.length ? directors.join("、") : "";

  const resultBadge = useMemo(() => {
    const status = file.status ?? "";
    if (status === "failed" || meta?.ok === false) {
      return { label: "失败", className: "rd-status rd-status--fail" };
    }
    if (status === "done") {
      return { label: "成功", className: "rd-status rd-status--ok" };
    }
    const label = recordTableStatusLabel(status, file);
    if (label === "取消") return { label, className: "rd-status rd-status--muted" };
    return { label, className: "rd-status rd-status--pending" };
  }, [file, meta?.ok]);

  return (
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
              onClick={onEditMeta}
            >
              <PencilSquareIcon aria-hidden />
            </button>
            <button
              type="button"
              className="record-detail-icon-btn"
              title="封面裁剪"
              onClick={onCropCover}
            >
              <PhotoIcon aria-hidden />
            </button>
            <button
              type="button"
              className="record-detail-icon-btn"
              title={isWaiting ? "等待中的记录无需删除" : "删除"}
              disabled={isWaiting}
              onClick={onDelete}
            >
              <TrashIcon aria-hidden />
            </button>
            <button
              type="button"
              className="record-detail-icon-btn"
              title="任务操作"
              onClick={onTaskAction}
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
  );
}
