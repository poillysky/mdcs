import type { ProviderResult, ScrapeMeta, SourceId, SourceSnapshot } from "./types.js";

function pickField(fields: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const val = fields[key];
    if (val === undefined || val === null || val === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;
    return val;
  }
  return undefined;
}

function coverCandidates(snapshot: SourceSnapshot): string[] {
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

export function serializeSourceSnapshots(
  bySource: Map<SourceId, ProviderResult>,
): Record<string, SourceSnapshot> {
  const out: Record<string, SourceSnapshot> = {};
  for (const [id, result] of bySource) {
    const fields = (result.fields ?? {}) as Record<string, unknown>;
    const hasFields = Object.values(fields).some(
      (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    );
    if (
      !hasFields &&
      !result.coverUrl &&
      !result.alternateCoverUrls?.length &&
      !result.extrafanartUrls?.length &&
      result.error
    ) {
      continue;
    }
    out[id] = {
      fields,
      coverUrl: result.coverUrl ?? null,
      alternateCoverUrls: result.alternateCoverUrls,
      extrafanartUrls: result.extrafanartUrls,
      error: result.error,
    };
  }
  return out;
}

export function attachSourceSnapshots(
  meta: ScrapeMeta,
  bySource: Map<SourceId, ProviderResult>,
): ScrapeMeta {
  if (!bySource.size) return meta;
  return { ...meta, sourceSnapshots: serializeSourceSnapshots(bySource) };
}

export function readSnapshotFieldValue(
  snapshot: SourceSnapshot,
  fieldKey: string,
  code?: string | null,
): string {
  const fields = snapshot.fields ?? {};
  const joinList = (val: unknown, sep: string) => {
    if (!Array.isArray(val)) return val == null || val === "" ? "" : String(val);
    return val.map((v) => String(v).trim()).filter(Boolean).join(sep);
  };
  const formatRating = () => {
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
  };

  switch (fieldKey) {
    case "code":
      return code?.trim() || String(pickField(fields, "code") || "");
    case "publishNumber":
      return String(
        pickField(fields, "publishNumber", "productId") || "",
      );
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
    case "coverUrl":
      return pickCoverThumb(coverCandidates(snapshot)) || String(pickField(fields, "coverUrl") || "");
    case "poster":
      return pickCoverPoster(coverCandidates(snapshot)) || String(pickField(fields, "coverUrl") || "");
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
      return formatRating();
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
