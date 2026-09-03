import nunjucks from "nunjucks";
import path from "node:path";
import type { KindId } from "../types.js";
import type { GlobalNamingConfig, ScrapeMeta } from "../scrape/types.js";
import { defaultNamingConfig } from "./namingConfig.js";
import { detectResolutionFromPath, mapResolutionText } from "./resolution.js";

const env = nunjucks.configure({ autoescape: false, throwOnUndefined: false });

env.addFilter("upper", (s: unknown) => String(s ?? "").toUpperCase());
env.addFilter("lower", (s: unknown) => String(s ?? "").toLowerCase());
env.addFilter("trim", (s: unknown) => String(s ?? "").trim());
env.addFilter("truncate", (s: unknown, n = 20) => {
  const t = String(s ?? "");
  const lim = Number(n) || 20;
  return t.length <= lim ? t : `${t.slice(0, lim)}…`;
});
env.addFilter("replace", (s: unknown, a: string, b: string) =>
  String(s ?? "").split(String(a)).join(String(b)),
);
env.addFilter("split", (s: unknown, sep = "-") => String(s ?? "").split(String(sep)));
env.addFilter("first", (v: unknown) => {
  if (Array.isArray(v)) return v[0] ?? "";
  return String(v ?? "").split(/[-_\s]/)[0] ?? "";
});
env.addFilter("last", (v: unknown) => {
  if (Array.isArray(v)) return v[v.length - 1] ?? "";
  const parts = String(v ?? "").split(/[-_\s]/);
  return parts[parts.length - 1] ?? "";
});
env.addFilter("default", (v: unknown, d = "") => {
  const s = v == null ? "" : String(v);
  return s.trim() ? s : d;
});

export type TemplateContext = Record<string, string>;

function sanitizeSegment(raw: string): string {
  return String(raw || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 180);
}

function looksJinja(template: string): boolean {
  return /\{\{|\{%/.test(template);
}

/**
 * 混写兼容：先保护 {{ }} / {% %}，再替换基础 {field}，最后渲染 Jinja。
 * 基础缺字段：路径省略段 / 非路径「未知」；Jinja 缺字段仍为空。
 */
export function applyTemplate(
  template: string,
  ctx: TemplateContext,
  opts?: { forPath?: boolean; emptyAsBlank?: boolean },
): string {
  const forPath = opts?.forPath ?? true;
  const tpl = String(template || "");
  if (!tpl) {
    return forPath || opts?.emptyAsBlank ? "" : "未知";
  }

  const jinjaBlocks: string[] = [];
  // 保护 Jinja 块，避免内部被 {field} 误伤
  let stage = tpl.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, (block) => {
    const i = jinjaBlocks.length;
    jinjaBlocks.push(block);
    return `\u0000J${i}\u0000`;
  });

  stage = stage.replace(/\{(\w+)\}/g, (_, key: string) => {
    const raw = ctx[key] ?? "";
    if (!raw && !forPath && !opts?.emptyAsBlank) return "未知";
    return sanitizeSegment(raw);
  });

  stage = stage.replace(/\u0000J(\d+)\u0000/g, (_, i: string) => jinjaBlocks[Number(i)] ?? "");

  let out = stage;
  if (jinjaBlocks.length > 0 || looksJinja(stage)) {
    try {
      out = env.renderString(stage, ctx);
    } catch {
      out = stage;
    }
  }

  if (forPath) {
    out = out
      .split(/[/\\]+/)
      .map((s) => sanitizeSegment(s.trim()))
      .filter(Boolean)
      .join("/");
  } else {
    out = sanitizeSegment(out.replace(/\s+/g, " ").trim());
    if (!out && !opts?.emptyAsBlank) out = "未知";
  }
  return out;
}

function parseCodeParts(code: string): {
  series_name: string;
  serial_number: string;
  first_letter: string;
} {
  const c = String(code || "").trim().toUpperCase();
  const m = c.match(/^([A-Z0-9]+?)[-_]?(\d+[A-Z0-9]*)$/i);
  if (m) {
    const series_name = m[1]!.toUpperCase();
    return {
      series_name,
      serial_number: m[2]!,
      first_letter: series_name[0] || "U",
    };
  }
  return {
    series_name: c,
    serial_number: "",
    first_letter: (c[0] || "U").toUpperCase(),
  };
}

function resolveMosaicLabel(
  mosaicRaw: string,
  labels: GlobalNamingConfig["mosaicLabels"],
): string {
  const m = mosaicRaw || "";
  if (/破解/.test(m)) return labels.cracked;
  if (/流出/.test(m)) return labels.leak;
  if (/无码/.test(m)) return labels.uncensored;
  if (/有码/.test(m)) return labels.censored;
  return m;
}

function resolveMosaicSuffix(
  mosaicRaw: string,
  labels: GlobalNamingConfig["mosaicSuffixLabels"],
): string {
  const m = mosaicRaw || "";
  if (/破解/.test(m)) return labels.cracked;
  if (/流出/.test(m)) return labels.leak;
  if (/无码/.test(m)) return labels.uncensored;
  if (/有码/.test(m)) return labels.censored;
  return "";
}

function resolveCategory(
  kind: KindId,
  code: string,
  sourcePath: string,
  naming: GlobalNamingConfig,
  kindLabel?: string,
): string {
  for (const rule of naming.categoryRules || []) {
    if (!rule.pattern) continue;
    try {
      const re = new RegExp(rule.pattern, "i");
      if (re.test(sourcePath) || re.test(code)) return rule.category;
    } catch {
      /* ignore bad regex */
    }
  }
  const labels = naming.categoryLabels;
  const map: Record<string, string> = {
    japan_censored: labels.japan_censored,
    japan_gravure: labels.japan_gravure || labels.japan_censored,
    japan_uncensored: labels.japan_uncensored,
    japan_amateur: labels.japan_amateur,
    fc2: labels.fc2,
    china: labels.china,
    western: labels.western,
  };
  return map[kind] || kindLabel || labels.unknown || kind;
}

export function buildTemplateContext(input: {
  kind: KindId;
  code: string;
  fileName: string;
  sourcePath: string;
  mosaic?: string | null;
  meta?: ScrapeMeta | null;
  kindLabel?: string;
  naming?: GlobalNamingConfig | null;
  hasSubtitle?: boolean;
  part?: number | string;
  /** 已解析的分辨率档位（720P/1080P/4K/8K）；不传则仅从路径猜测 */
  resolution?: string;
}): TemplateContext {
  const naming = input.naming ? { ...defaultNamingConfig(), ...input.naming } : defaultNamingConfig();
  const meta = input.meta;
  const actors = meta?.actors ?? [];
  const limit = naming.actorDisplayLimit > 0 ? naming.actorDisplayLimit : 3;
  const actorText =
    actors.length > limit ? "多人作品" : actors.length ? actors.join(", ") : "";
  const premiered = meta?.premiered || "";
  const year = premiered.slice(0, 4);
  const series = meta?.series || "";
  const originalTitle = meta?.title || input.code;
  const title = meta?.titleZh?.trim() || originalTitle;
  const parts = parseCodeParts(input.code);
  const mosaicRaw = input.mosaic || meta?.mosaic || "";
  const mosaic = resolveMosaicLabel(mosaicRaw, naming.mosaicLabels);
  const mosaic_suffix = resolveMosaicSuffix(mosaicRaw, naming.mosaicSuffixLabels);

  const hasSub = Boolean(input.hasSubtitle);
  const subtitle = hasSub ? naming.subtitleLabel : naming.noSubtitleLabel;
  const subtitle_suffix = hasSub ? naming.subtitleSuffixLabel : "";

  let detectedRes =
    input.resolution || detectResolutionFromPath(input.sourcePath, input.fileName);
  const enabled = naming.resolutionEnabled || {};
  let fieldKey = detectedRes;
  if (fieldKey && enabled[fieldKey as keyof typeof enabled] === false) {
    fieldKey = naming.resolutionInactiveLabel || fieldKey;
  }
  const resolutionText = mapResolutionText(fieldKey, naming.resolutionTextMap);
  const resolution =
    naming.resolutionFieldTemplate
      ? applyTemplate(
          naming.resolutionFieldTemplate,
          { resolution: resolutionText, resolution_text: resolutionText },
          { forPath: false, emptyAsBlank: true },
        ) || resolutionText
      : resolutionText;

  const partNum = input.part != null && String(input.part) !== "" ? String(input.part) : "";
  const partLetter = partNum
    ? String.fromCharCode(64 + Math.min(26, Math.max(1, Number(partNum) || 1)))
    : "";
  const part_suffix = partNum
    ? applyTemplate(
        naming.partSuffixTemplate || "",
        { part: partNum, part_letter: partLetter },
        { forPath: false, emptyAsBlank: true },
      )
    : "";

  const suffixResOk =
    Boolean(detectedRes) &&
    naming.resolutionSuffixEnabled?.[
      detectedRes as keyof typeof naming.resolutionSuffixEnabled
    ] !== false;
  const suffixText = mapResolutionText(detectedRes, naming.resolutionTextMap);
  const resolution_suffix =
    suffixResOk && naming.resolutionSuffixTemplate
      ? applyTemplate(
          naming.resolutionSuffixTemplate,
          { resolution: suffixText, resolution_text: suffixText },
          { forPath: false, emptyAsBlank: true },
        )
      : "";

  const directors = meta?.directors?.filter(Boolean) ?? [];
  return {
    number: input.code,
    publish_number: String(meta?.publishNumber || "").trim(),
    series_name: parts.series_name || series,
    serial_number: parts.serial_number,
    first_letter: parts.first_letter,
    series,
    category: resolveCategory(input.kind, input.code, input.sourcePath, naming, input.kindLabel),
    actor: actorText,
    first_actor: actors[0] || "",
    title,
    originaltitle: originalTitle,
    titleZh: meta?.titleZh || "",
    year: /^\d{4}$/.test(year) ? year : "",
    director: directors.join(", "),
    studio: meta?.studio || "",
    publisher: meta?.publisher || "",
    runtime: meta?.runtime != null ? String(meta.runtime) : "",
    release: premiered,
    premiered,
    source_filename: path.parse(input.fileName).name,
    filename: path.parse(input.fileName).name,
    source_path: input.sourcePath,
    subtitle,
    subtitle_suffix,
    mosaic,
    mosaic_suffix,
    resolution,
    resolution_text: resolutionText,
    resolution_suffix,
    part: partNum,
    part_letter: partLetter,
    part_suffix,
  };
}

/** 组装视频文件名后缀（分段） */
export function buildVideoNameSuffix(ctx: TemplateContext, naming: GlobalNamingConfig): string {
  const tpl = naming.videoSuffixTemplate || naming.nameSuffixTemplate || "";
  if (!tpl) {
    // 无总模板时按 mosaic/subtitle/resolution/part 后缀字段拼接
    const parts = [ctx.mosaic_suffix, ctx.subtitle_suffix, ctx.resolution_suffix, ctx.part_suffix].filter(
      Boolean,
    );
    return parts.join("");
  }
  // 后缀模板里 {mosaic} 用后缀文案
  const suffixCtx: TemplateContext = {
    ...ctx,
    mosaic: ctx.mosaic_suffix || "",
    subtitle: ctx.subtitle_suffix || "",
    resolution: ctx.resolution_suffix || "",
    part: ctx.part_suffix || "",
  };
  return applyTemplate(tpl, suffixCtx, { forPath: false, emptyAsBlank: true });
}

export function joinLibraryTarget(
  libraryAbs: string,
  dirTemplate: string,
  fileTemplate: string,
  ext: string,
  ctx: TemplateContext,
  opts?: { maxDirectoryLength?: number },
): { relativeDir: string; fileName: string; absVideo: string; absDir: string } {
  let relativeDir = applyTemplate(dirTemplate, ctx, { forPath: true });
  const maxLen = opts?.maxDirectoryLength ?? 0;
  if (maxLen > 0 && relativeDir.length > maxLen) {
    // 超长时尝试缩短 title 再渲染一次
    const shortTitle = (ctx.title || "").slice(0, Math.max(8, Math.floor((ctx.title || "").length / 2)));
    relativeDir = applyTemplate(dirTemplate, { ...ctx, title: shortTitle }, { forPath: true });
    if (relativeDir.length > maxLen) relativeDir = relativeDir.slice(0, maxLen);
  }
  let baseName = applyTemplate(fileTemplate, ctx, { forPath: false });
  if (!baseName) baseName = ctx.number || "unknown";
  const fileName = `${baseName}${ext.startsWith(".") ? ext : `.${ext}`}`;
  const absDir = relativeDir ? path.join(libraryAbs, ...relativeDir.split("/")) : libraryAbs;
  const absVideo = path.join(absDir, fileName);
  return { relativeDir, fileName, absVideo, absDir };
}
