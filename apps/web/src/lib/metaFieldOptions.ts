import { resolveCoverSource } from "./metaDisplay";
import type { FileRow, ScrapeMetaView, SourceSnapshotView } from "../types";

export type MetaFieldOption = { value: string; source: string };

type MetaEditFieldLike = {
  key: string;
  value: string;
  sourceKey: string;
};

function pickField(fields: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const val = fields[key];
    if (val === undefined || val === null || val === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;
    return val;
  }
  return undefined;
}

function joinList(val: unknown, sep: string): string {
  if (!Array.isArray(val)) return val == null || val === "" ? "" : String(val);
  return val.map((v) => String(v).trim()).filter(Boolean).join(sep);
}

function formatSnapshotRating(fields: Record<string, unknown>): string {
  const rv = pickField(fields, "ratingValue");
  if (rv != null && Number.isFinite(Number(rv))) {
    const n = Number(rv);
    return n.toFixed(2).replace(/\.?0+$/, "");
  }
  const score = pickField(fields, "score");
  if (score != null && Number.isFinite(Number(score))) {
    const n = Number(score);
    return n.toFixed(2).replace(/\.?0+$/, "");
  }
  return "";
}

function coverCandidates(snapshot: SourceSnapshotView): string[] {
  return [...new Set([snapshot.coverUrl, ...(snapshot.alternateCoverUrls ?? [])].filter(Boolean))] as string[];
}

function pickCoverThumb(urls: string[]): string {
  if (!urls.length) return "";
  return urls.find((u) => /ps\.jpg(\?|$)/i.test(u)) || urls[0] || "";
}

function pickCoverPoster(urls: string[]): string {
  if (!urls.length) return "";
  return urls.find((u) => /pl\.jpg(\?|$)/i.test(u)) || urls[urls.length - 1] || urls[0] || "";
}

export function readSnapshotFieldValue(
  snapshot: SourceSnapshotView,
  fieldKey: string,
  code?: string | null,
): string {
  const fields = snapshot.fields ?? {};
  switch (fieldKey) {
    case "code":
      return code?.trim() || String(pickField(fields, "code") || "");
    case "publishNumber":
      return String(pickField(fields, "publishNumber", "productId") || "");
    case "title":
      return String(pickField(fields, "titleZh", "title") || "");
    case "originaltitle":
      return String(pickField(fields, "title") || "");
    case "plot":
      return String(pickField(fields, "plot", "outline") || "");
    case "originalPlot":
      return String(pickField(fields, "originalPlot", "plot", "outline") || "");
    case "actors":
      return joinList(pickField(fields, "actors"), "、");
    case "coverUrl": {
      const raw =
        pickCoverThumb(coverCandidates(snapshot)) || String(pickField(fields, "coverUrl") || "");
      return /^https?:\/\//i.test(raw) ? raw : "";
    }
    case "poster": {
      const raw =
        pickCoverPoster(coverCandidates(snapshot)) || String(pickField(fields, "coverUrl") || "");
      return /^https?:\/\//i.test(raw) ? raw : "";
    }
    case "extrafanart":
      return joinList(snapshot.extrafanartUrls, ", ");
    case "genres":
      return joinList(pickField(fields, "genres", "tags"), "、");
    case "premiered":
      return String(pickField(fields, "premiered") || "");
    case "runtime": {
      const rt = pickField(fields, "runtime");
      return rt == null || rt === "" ? "" : String(rt);
    }
    case "score":
      return formatSnapshotRating(fields);
    case "directors":
      return joinList(pickField(fields, "directors"), "、");
    case "series":
      return String(pickField(fields, "series") || "");
    case "studio":
      return String(pickField(fields, "studio") || "");
    case "publisher":
      return String(pickField(fields, "publisher", "studio") || "");
    case "votes":
      return String(pickField(fields, "votes") || "");
    default:
      return "";
  }
}

function resolveActiveSource(
  field: MetaEditFieldLike,
  meta: ScrapeMetaView | null,
): string {
  const fs = meta?.fieldSources ?? {};
  if (field.sourceKey === "cover") {
    return fs.cover || resolveCoverSource(meta) || meta?.source || "";
  }
  return fs[field.sourceKey] || meta?.source || "";
}

export function buildFieldSourceOptions(
  field: MetaEditFieldLike,
  meta: ScrapeMetaView | null,
  file: FileRow,
): MetaFieldOption[] {
  const snapshots = meta?.sourceSnapshots ?? {};
  const order = meta?.sourcesTried?.length
    ? meta.sourcesTried
    : Object.keys(snapshots);
  const activeSource = resolveActiveSource(field, meta);
  const options: MetaFieldOption[] = [];
  const seen = new Set<string>();

  for (const sourceId of order) {
    const snap = snapshots[sourceId];
    if (!snap) continue;
    const value = readSnapshotFieldValue(snap, field.key, meta?.code || file.code);
    if (!value) continue;
    const dedupe = `${sourceId}\0${value}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    options.push({ value, source: sourceId });
  }

  if (
    field.value &&
    !options.some((opt) => opt.value === field.value && opt.source === activeSource)
  ) {
    options.unshift({ value: field.value, source: activeSource || meta?.source || "" });
  }

  if (!options.length && field.value) {
    options.push({ value: field.value, source: activeSource || meta?.source || "" });
  }

  if (activeSource) {
    options.sort((a, b) => {
      if (a.source === activeSource) return -1;
      if (b.source === activeSource) return 1;
      return 0;
    });
  }

  return options;
}
