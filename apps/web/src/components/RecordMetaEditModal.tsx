import {
  CheckIcon,
  ChevronUpDownIcon,
  PencilSquareIcon,
} from "@heroicons/react/20/solid";
import { useEffect, useRef, useState } from "react";
import { ensureFileSourceSnapshots } from "../api";
import { Modal } from "./Modal";
import {
  resolveCoverSource,
  resolveCoverUrl,
  resolveRemotePosterUrl,
  resolvePublishNumber,
} from "../lib/metaDisplay";
import { displayFieldSource } from "../lib/labels";
import { buildFieldSourceOptions } from "../lib/metaFieldOptions";
import type { FileRow, ScrapeMetaView } from "../types";

type MetaEditField = {
  key: string;
  label: string;
  value: string;
  sourceKey: string;
  multiline?: boolean;
};

type FieldDraft = MetaEditField & {
  source: string;
  options: Array<{ value: string; source: string }>;
  editing: boolean;
  menuOpen: boolean;
};

type Props = {
  open: boolean;
  file: FileRow;
  meta: ScrapeMetaView | null;
  onClose: () => void;
  onSave?: (fields: Record<string, { value: string; source: string }>) => void | Promise<void>;
  onMetaRefresh?: (meta: ScrapeMetaView) => void;
};

function formatRating(meta: ScrapeMetaView | null): string {
  if (!meta) return "";
  if (meta.ratingValue != null) {
    const n = Number(meta.ratingValue);
    return Number.isFinite(n) ? n.toFixed(2).replace(/\.?0+$/, "") : String(meta.ratingValue);
  }
  if (meta.score != null) {
    const n = Number(meta.score);
    return Number.isFinite(n) ? n.toFixed(2).replace(/\.?0+$/, "") : String(meta.score);
  }
  return "";
}

function serializeFieldValue(value: unknown, key: string): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) {
    if (key === "extrafanart") return value.filter(Boolean).join(", ");
    return value.filter(Boolean).join("、");
  }
  return String(value);
}

function buildMetaEditFields(file: FileRow, meta: ScrapeMetaView | null): MetaEditField[] {
  const extrafanart = [...(meta?.extrafanartUrls ?? []), ...(meta?.extrafanartLocal ?? [])].filter(
    Boolean,
  );
  const coverUrl = resolveCoverUrl(meta, file);
  const posterUrl = resolveRemotePosterUrl(meta, file);
  return [
    { key: "code", label: "番号", value: meta?.code || file.code || "", sourceKey: "code" },
    {
      key: "publishNumber",
      label: "发行码",
      value: resolvePublishNumber(meta, file) || "",
      sourceKey: "publishNumber",
    },
    {
      key: "title",
      label: "标题",
      value: meta?.titleZh || meta?.title || "",
      sourceKey: "titleZh",
    },
    {
      key: "originaltitle",
      label: "原标题",
      value: meta?.title || "",
      sourceKey: "title",
      multiline: true,
    },
    { key: "plot", label: "简介", value: meta?.plot || "", sourceKey: "plot", multiline: true },
    {
      key: "originalPlot",
      label: "原简介",
      value: meta?.originalPlot || "",
      sourceKey: "originalPlot",
      multiline: true,
    },
    {
      key: "actors",
      label: "演员",
      value: serializeFieldValue(meta?.actors, "actors"),
      sourceKey: "actors",
    },
    {
      key: "coverUrl",
      label: "封面",
      value: coverUrl,
      sourceKey: "cover",
    },
    {
      key: "poster",
      label: "海报",
      value: posterUrl,
      sourceKey: "cover",
    },
    {
      key: "extrafanart",
      label: "剧照",
      value: serializeFieldValue(extrafanart, "extrafanart"),
      sourceKey: "extrafanart",
      multiline: true,
    },
    {
      key: "genres",
      label: "标签",
      value: serializeFieldValue(meta?.genres, "genres"),
      sourceKey: "genres",
    },
    { key: "premiered", label: "发布日期", value: meta?.premiered || "", sourceKey: "premiered" },
    {
      key: "runtime",
      label: "影片时长",
      value: meta?.runtime != null ? String(meta.runtime) : "",
      sourceKey: "runtime",
    },
    { key: "score", label: "用户评分", value: formatRating(meta), sourceKey: "score" },
    {
      key: "directors",
      label: "导演",
      value: serializeFieldValue(meta?.directors, "directors"),
      sourceKey: "directors",
    },
    { key: "series", label: "系列", value: meta?.series || "", sourceKey: "series" },
    { key: "studio", label: "厂商", value: meta?.studio || "", sourceKey: "studio" },
    { key: "publisher", label: "出品", value: meta?.publisher || "", sourceKey: "publisher" },
    { key: "votes", label: "想看人数", value: meta?.votes || "", sourceKey: "votes" },
  ];
}

function sourceBadgeClass(source: string): string {
  const s = source.toLowerCase();
  if (!source || s === "custom" || s === "自定义") return "rd-src rd-src--custom";
  if (s === "dmm") return "rd-src rd-src--dmm";
  if (s.includes("airav")) return "rd-src rd-src--airav";
  if (s.includes("javbus")) return "rd-src rd-src--javbus";
  if (s.includes("jav321") || s.includes("mgstage") || s.includes("javlibrary")) {
    return "rd-src rd-src--jav";
  }
  if (s.includes("freejav")) return "rd-src rd-src--free";
  if (s.includes("miss_av") || s.includes("missav")) return "rd-src rd-src--miss";
  if (s.includes("fc2")) return "rd-src rd-src--fc2";
  if (s.includes("系统") || s === "system") return "rd-src rd-src--sys";
  if (s === "forum") return "rd-src rd-src--custom";
  return "rd-src";
}

function buildDrafts(file: FileRow, meta: ScrapeMetaView | null): FieldDraft[] {
  const fs = meta?.fieldSources ?? {};
  const fallbackSource = meta?.source || "";
  const coverSource = resolveCoverSource(meta);
  return buildMetaEditFields(file, meta).map((field) => {
    const source =
      field.sourceKey === "cover"
        ? fs[field.sourceKey] || coverSource || fallbackSource
        : fs[field.sourceKey] || fallbackSource;
    const options = buildFieldSourceOptions(field, meta, file);
    const matched =
      options.find((opt) => opt.source === source && opt.value === field.value) ||
      options.find((opt) => opt.source === source) ||
      options[0];
    return {
      ...field,
      value: matched?.value ?? field.value,
      source: matched?.source ?? source,
      options,
      editing: false,
      menuOpen: false,
    };
  });
}

function MetaFieldRow({
  fieldKey,
  field,
  onPatch,
}: {
  fieldKey: string;
  field: FieldDraft;
  onPatch: (key: string, patch: Partial<FieldDraft>) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!field.menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        onPatch(fieldKey, { menuOpen: false });
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [field.menuOpen, fieldKey, onPatch]);

  const selectedSource = field.source === "custom" ? "custom" : field.source;
  const menuOptions = [
    ...field.options,
    ...(field.options.some((o) => o.source === "custom")
      ? []
      : [{ value: field.value, source: "custom" as const }]),
  ];

  return (
    <div className="rd-meta-field">
      <label className="rd-meta-field-label">{field.label}</label>
      <div className="rd-meta-field-row">
        <div className={`rd-meta-input-shell${field.editing ? " is-editing" : ""}`}>
          {field.multiline ? (
            <textarea
              className="rd-meta-input"
              rows={field.key === "extrafanart" ? 4 : 3}
              value={field.value}
              placeholder="—"
              readOnly={!field.editing}
              onChange={(e) => onPatch(fieldKey, { value: e.target.value, source: "custom" })}
            />
          ) : (
            <input
              className="rd-meta-input"
              type="text"
              value={field.value}
              placeholder="—"
              readOnly={!field.editing}
              onChange={(e) => onPatch(fieldKey, { value: e.target.value, source: "custom" })}
            />
          )}
          <div className="rd-meta-source-wrap" ref={wrapRef}>
            <button
              type="button"
              className="rd-meta-source-trigger"
              onClick={() => onPatch(fieldKey, { menuOpen: !field.menuOpen })}
            >
              <span className={sourceBadgeClass(selectedSource)}>{displayFieldSource(selectedSource)}</span>
              <ChevronUpDownIcon aria-hidden />
            </button>
            {field.menuOpen ? (
              <div className="rd-meta-source-menu" role="listbox">
                {menuOptions.map((opt, i) => {
                  const active =
                    field.source === opt.source ||
                    (field.source === "custom" && opt.source === "custom");
                  return (
                    <button
                      key={`${opt.source}-${i}`}
                      type="button"
                      className={`rd-meta-source-option${active ? " is-active" : ""}`}
                      onClick={() =>
                        onPatch(fieldKey, {
                          value: opt.value,
                          source: opt.source,
                          editing: opt.source === "custom",
                          menuOpen: false,
                        })
                      }
                    >
                      <span className="rd-meta-source-option-value">{opt.value || "—"}</span>
                      <span className={sourceBadgeClass(opt.source)}>{displayFieldSource(opt.source)}</span>
                      {active ? <CheckIcon className="rd-meta-source-check" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className={`rd-meta-edit-btn${field.editing ? " is-active" : ""}`}
          title={field.editing ? "锁定" : "编辑"}
          onClick={() =>
            onPatch(fieldKey, {
              editing: !field.editing,
              source: field.editing ? field.source : "custom",
            })
          }
        >
          <PencilSquareIcon aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function RecordMetaEditModal({ open, file, meta, onClose, onSave, onMetaRefresh }: Props) {
  const [liveMeta, setLiveMeta] = useState<ScrapeMetaView | null>(meta);
  const [drafts, setDrafts] = useState<FieldDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLiveMeta(meta);
  }, [open, meta]);

  useEffect(() => {
    if (!open) return;
    setDrafts(buildDrafts(file, liveMeta));
  }, [open, file, liveMeta]);

  useEffect(() => {
    if (!open) return;
    const count = meta?.sourceSnapshots ? Object.keys(meta.sourceSnapshots).length : 0;
    if (count > 0) return;
    let cancelled = false;
    setSnapshotsLoading(true);
    void ensureFileSourceSnapshots(file.id)
      .then((data) => {
        if (cancelled) return;
        setLiveMeta(data.meta);
        onMetaRefresh?.(data.meta);
      })
      .catch(() => {
        /* 保留当前单源数据，不阻断编辑 */
      })
      .finally(() => {
        if (!cancelled) setSnapshotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, file.id, meta, onMetaRefresh]);

  function patchField(key: string, patch: Partial<FieldDraft>) {
    setDrafts((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    if (onSave) {
      setSaving(true);
      try {
        const payload = Object.fromEntries(
          drafts.map((d) => [d.key, { value: d.value, source: d.source }]),
        );
        await onSave(payload);
      } finally {
        setSaving(false);
      }
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      title="编辑元数据"
      variant="sheet"
      padded
      className="modal-meta-edit"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className="btn primary solid"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "更新中…" : "更新"}
          </button>
        </>
      }
    >
      <div className="rd-meta-form">
        {snapshotsLoading ? (
          <p className="rd-meta-form-hint">正在加载各数据源字段…</p>
        ) : null}
        {drafts.map((field) => (
          <MetaFieldRow
            key={field.key}
            fieldKey={field.key}
            field={field}
            onPatch={patchField}
          />
        ))}
      </div>
    </Modal>
  );
}
