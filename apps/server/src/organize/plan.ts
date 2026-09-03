import path from "node:path";
import { loadScrapeConfig, resolveEffectiveKindProfile, resolveKindScrapePrefs } from "../config/loadScrape.js";
import { resolveFromRoot, toLibraryRelativePath } from "../paths.js";
import { readScrapeCache } from "../scrape/cache.js";
import type { ScrapeMeta } from "../scrape/types.js";
import type { JobOptions } from "../jobs/options.js";
import type {
  KindId,
  OnConflict,
  OrganizeConfig,
  OrganizeFallback,
  OrganizeMode,
  ResolvedKind,
} from "../types.js";
import { resolveResolutionKey } from "./resolution.js";
import { findSubtitlesForCode } from "./subtitles.js";
import {
  applyTemplate,
  buildTemplateContext,
  buildVideoNameSuffix,
  joinLibraryTarget,
} from "./template.js";
import { resolveOrganizeCoverSource } from "./coverCache.js";

function resolvePlanCover(opts: {
  meta: ScrapeMeta | null;
  projectRoot: string;
  metaDir: string;
  fileName: string;
  posterFileName: (videoFileName: string, coverExt: string) => string;
}): { coverSource: string | null; posterAbs: string | null } {
  const defaultPosterAbs = path.join(opts.metaDir, opts.posterFileName(opts.fileName, ".jpg"));
  const coverSource = resolveOrganizeCoverSource({
    meta: opts.meta,
    projectRoot: opts.projectRoot,
    posterAbsCandidate: defaultPosterAbs,
  });
  const wantsPoster = Boolean(coverSource || opts.meta?.coverUrl);
  const posterAbs = wantsPoster
    ? path.join(
        opts.metaDir,
        opts.posterFileName(
          opts.fileName,
          coverSource ? path.extname(coverSource) || ".jpg" : ".jpg",
        ),
      )
    : null;
  return { coverSource, posterAbs };
}

export type OrganizePlanItem = {
  fileId: number;
  kind: KindId;
  code: string;
  sourceAbs: string;
  sourceRel: string;
  targetAbs: string;
  targetRel: string;
  nfoAbs: string;
  posterAbs: string | null;
  coverSource: string | null;
  mode: OrganizeMode;
  fallback: OrganizeFallback;
  onConflict: OnConflict;
  mosaic: string;
  title: string;
  /** Emby/Plex 显示标题（mediaTitleTemplate） */
  mediaTitle: string;
  posterCrop: string;
  hasSubtitle: boolean;
  /** 720P/1080P/4K/8K，供水印等使用 */
  resolution: string;
  /** 分集号（文件名 cd/part），供 NFO title_cd */
  part?: string;
};

export type FileOrganizeRow = {
  id: number;
  kind: KindId;
  source_path: string;
  file_name: string;
  code: string;
  mosaic?: string | null;
  status: string;
};

function detectPartFromName(fileName: string): string {
  const base = path.parse(fileName).name;
  // 仅认 cd/part/pt，避免把番号数字当成分集
  const explicit = base.match(/(?:^|[-_\s.])(?:cd|part|pt)[-_]?(\d{1,2})(?:$|[-_\s.])/i);
  return explicit?.[1] || "";
}

export function buildPlanForFile(
  row: FileOrganizeRow,
  kind: ResolvedKind,
  opts: {
    projectRoot: string;
    onConflict: OnConflict;
    organize?: OrganizeConfig;
    jobOptions?: JobOptions;
  },
): OrganizePlanItem | null {
  if (!row.code) return null;

  const org = opts.jobOptions?.organize;
  const useGlobalOrg = opts.jobOptions?.useGlobal?.organize !== false;
  const mode = (
    (!useGlobalOrg && org?.organizeMode) ||
    kind.organizeMode
  ) as OrganizeMode;

  const overrideLibraryRoot = !useGlobalOrg && Boolean(org?.libraryRoot?.trim());
  if (mode !== "inplace" && !kind.libraryAbs && !overrideLibraryRoot) return null;

  const meta = readScrapeCache(row.code, row.kind);
  const scrapeCfg = loadScrapeConfig();
  const profile = resolveEffectiveKindProfile(row.kind, scrapeCfg);
  const kindPrefs = resolveKindScrapePrefs(row.kind, scrapeCfg);
  const naming = opts.jobOptions?.naming;
  const useGlobalNaming = opts.jobOptions?.useGlobal?.naming !== false;
  const globalNaming = scrapeCfg.naming;
  const effectiveNaming =
    !useGlobalNaming && naming
      ? { ...globalNaming, ...naming }
      : globalNaming;

  const sourceAbs = path.isAbsolute(row.source_path)
    ? row.source_path
    : resolveFromRoot(row.source_path, opts.projectRoot);

  const subPath = (
    (!opts.jobOptions?.useGlobal?.download && opts.jobOptions?.download?.subtitleLibraryPath) ||
    kindPrefs.download.subtitleLibraryPath ||
    ""
  ).trim();
  const subtitleAbs = subPath
    ? path.isAbsolute(subPath)
      ? subPath
      : resolveFromRoot(subPath, opts.projectRoot)
    : "";
  const hasSubtitle = subtitleAbs
    ? findSubtitlesForCode(subtitleAbs, row.code).length > 0
    : false;

  const resolution = resolveResolutionKey({
    naming: effectiveNaming,
    sourcePath: row.source_path,
    fileName: row.file_name,
    videoAbs: sourceAbs,
  });
  const part = detectPartFromName(row.file_name);

  const ctx = buildTemplateContext({
    kind: row.kind,
    code: row.code,
    fileName: row.file_name,
    sourcePath: row.source_path,
    mosaic: row.mosaic,
    meta,
    kindLabel: kind.label,
    naming: effectiveNaming,
    hasSubtitle,
    resolution,
    part: part || undefined,
  });

  const mediaTitle = applyTemplate(effectiveNaming.mediaTitleTemplate || "{title}", ctx, {
    forPath: false,
  });

  const dirTemplate =
    (!useGlobalNaming && naming?.directoryTemplate) ||
    profile.directoryTemplate ||
    "{category}/{studio}/{series_name}/{number}";
  const fileTemplateBase =
    (!useGlobalNaming && naming?.fileNameTemplate) ||
    profile.fileNameTemplate ||
    "{number}";

  let suffixPart = "";
  if (!useGlobalNaming && naming?.nameSuffixTemplate != null) {
    const suffix = applyTemplate(String(naming.nameSuffixTemplate || ""), ctx, {
      forPath: false,
      emptyAsBlank: true,
    }).replace(/^-+|-+$/g, "");
    suffixPart = suffix ? `-${suffix.replace(/^-/, "")}` : "";
  } else if (useGlobalNaming === false && profile.nameSuffixTemplate) {
    const suffix = applyTemplate(profile.nameSuffixTemplate, ctx, {
      forPath: false,
      emptyAsBlank: true,
    }).replace(/^-+|-+$/g, "");
    suffixPart = suffix ? `-${suffix.replace(/^-/, "")}` : "";
  } else {
    const suffix = buildVideoNameSuffix(ctx, effectiveNaming).replace(/^-+|-+$/g, "");
    if (suffix) suffixPart = suffix.startsWith("-") ? suffix : `-${suffix.replace(/^-/, "")}`;
  }
  const fileTemplate = suffixPart ? `${fileTemplateBase}${suffixPart}` : fileTemplateBase;

  const onConflict = (
    (!useGlobalOrg && org?.onConflict) ||
    opts.onConflict
  ) as OnConflict;

  const ext = path.extname(row.file_name) || ".mp4";
  const imageNameMode = effectiveNaming.imageNameMode || "none";
  const videoStem = (name: string) => path.parse(name).name;
  const posterFileName = (videoFileName: string, coverExt: string) => {
    const e = coverExt.startsWith(".") ? coverExt : `.${coverExt || "jpg"}`;
    if (imageNameMode === "none") return `poster${e}`;
    return `${videoStem(videoFileName)}-poster${e}`;
  };

  if (mode === "inplace") {
    const absDir = path.dirname(sourceAbs);
    const fileName = path.basename(sourceAbs);
    const stem = videoStem(fileName);
    const metaRoot = resolveMetadataRoot(opts.organize?.metadataDir, opts.projectRoot, absDir);
    const nfoAbs = path.join(metaRoot, `${stem}.nfo`);
    const { coverSource, posterAbs } = resolvePlanCover({
      meta,
      projectRoot: opts.projectRoot,
      metaDir: metaRoot,
      fileName,
      posterFileName,
    });
    return {
      fileId: row.id,
      kind: row.kind,
      code: row.code,
      sourceAbs,
      sourceRel: row.source_path,
      targetAbs: sourceAbs,
      targetRel: toLibraryRelativePath(sourceAbs, kind.libraryAbs) || "",
      nfoAbs,
      posterAbs,
      coverSource,
      mode,
      fallback: kind.organizeFallback,
      onConflict,
      mosaic: row.mosaic || meta?.mosaic || "",
      title: meta?.title || row.code,
      mediaTitle,
      posterCrop: profile.posterCrop || "right",
      hasSubtitle,
      resolution,
      part: part || undefined,
    };
  }

  let libraryAbs = kind.libraryAbs;
  if (!useGlobalOrg && org?.libraryRoot?.trim()) {
    const root = org.libraryRoot.trim();
    libraryAbs = path.isAbsolute(root) ? root : resolveFromRoot(root, opts.projectRoot);
  }

  const { relativeDir, fileName, absVideo, absDir } = joinLibraryTarget(
    libraryAbs,
    dirTemplate,
    fileTemplate,
    ext,
    ctx,
    { maxDirectoryLength: effectiveNaming.maxDirectoryLength || 0 },
  );
  const metaRoot = resolveMetadataRoot(opts.organize?.metadataDir, opts.projectRoot, absDir);
  const stem = videoStem(fileName);
  const metaDir =
    (opts.organize?.metadataDir || "").trim() && relativeDir
      ? path.join(metaRoot, relativeDir)
      : metaRoot;
  const nfoAbs = path.join(metaDir, `${stem}.nfo`);
  const { coverSource, posterAbs } = resolvePlanCover({
    meta,
    projectRoot: opts.projectRoot,
    metaDir,
    fileName,
    posterFileName,
  });

  const targetRel = relativeDir ? `${relativeDir}/${fileName}` : fileName;

  return {
    fileId: row.id,
    kind: row.kind,
    code: row.code,
    sourceAbs,
    sourceRel: row.source_path,
    targetAbs: absVideo,
    targetRel: targetRel.replace(/\\/g, "/"),
    nfoAbs,
    posterAbs,
    coverSource,
    mode,
    fallback: kind.organizeFallback,
    onConflict,
    mosaic: row.mosaic || meta?.mosaic || "",
    title: meta?.title || row.code,
    mediaTitle,
    posterCrop: profile.posterCrop || "right",
    hasSubtitle,
    resolution,
    part: part || undefined,
  };
}

function resolveMetadataRoot(
  metadataDir: string | undefined,
  projectRoot: string,
  fallbackAbs: string,
): string {
  const raw = (metadataDir || "").trim();
  if (!raw) return fallbackAbs;
  return path.isAbsolute(raw) ? raw : resolveFromRoot(raw, projectRoot);
}
