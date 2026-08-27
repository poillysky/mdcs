/**
 * 单站端到端：刮削 → 封面 → 硬链整理 → 命名/后缀 → 裁剪水印 → NFO
 * 默认从索引样例取番号（见 e2e-fixtures.ts），不覆盖原片商目录。
 *
 *   npx tsx scripts/e2e-sone-source.ts --id=javbus
 *   npx tsx scripts/e2e-sone-source.ts --merge          # 多源 merge（生产路径，对齐 MDC-NG）
 *   npx tsx scripts/e2e-sone-source.ts --id=carib
 *   npx tsx scripts/e2e-sone-source.ts --id=fc2_hub
 *   npx tsx scripts/e2e-sone-source.ts --list
 *   npx tsx scripts/e2e-sone-source.ts --id=fc2 --strm=media/本地索引/FC2/.../FC2-1545500.strm
 */
import fs from "node:fs";
import path from "node:path";
import { loadLibrariesConfig, resolveKind, resolveOrganizeForKind } from "../src/config/loadConfig.js";
import { loadScrapeConfig, resolveKindScrapePrefs } from "../src/config/loadScrape.js";
import { openDatabase } from "../src/db/init.js";
import { classifyFromPath } from "../src/library/classify.js";
import { applyFileTransfer } from "../src/organize/fsops.js";
import { downloadExtrafanartToDir } from "../src/organize/extrafanart.js";
import { writeMovieNfo } from "../src/organize/nfo.js";
import { buildNfoWriteContext, ensureThumbBesidePoster, metaCollectedFields } from "../src/organize/nfoCtx.js";
import { buildPlanForFile } from "../src/organize/plan.js";
import { processPosterImage, resolveWatermarkLabels } from "../src/organize/poster.js";
import { PROJECT_ROOT } from "../src/paths.js";
import { downloadCover, writeScrapeCache } from "../src/scrape/cache.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { releaseFlareSession, recycleFlareSessions } from "../src/scrape/network/flaresolverr.js";
import { scrapeCodeDetailed } from "../src/scrape/orchestrator.js";
import { getCatalogEntry } from "../src/scrape/providers/catalog.js";
import type { SourceId } from "../src/scrape/types.js";
import type { KindId } from "../src/types.js";
import { e2eOutRoot, printFixtureTable, resolveE2eFixture } from "./e2e-fixtures.js";
import { checkNfoFields, printFieldGapReport, scrapeFieldGapReport, summarizeNfoChecks } from "./nfo-e2e-checks.js";

const argv = process.argv.slice(2);
if (argv.includes("--list")) {
  printFixtureTable();
  process.exit(0);
}

const mergeMode = argv.includes("--merge");
const onlyId = (mergeMode ? "dmm" : (argv.find((a) => a.startsWith("--id="))?.slice(5) || "javbus")) as SourceId;
const runLabel = mergeMode ? "merge" : onlyId;
const strmOverride = argv.find((a) => a.startsWith("--strm="))?.slice(7);
const fixture = resolveE2eFixture(onlyId, strmOverride);
const CODE = fixture.code;
const KIND = fixture.kind;
const SOURCE_STRM = path.join(PROJECT_ROOT, fixture.sourceRel);

function rel(p: string): string {
  return path.relative(PROJECT_ROOT, p).replace(/\\/g, "/");
}

async function downloadCoverLogged(
  urls: string[],
  kind: KindId,
  code: string,
  pageUrl?: string,
): Promise<{ file: string | null; error: string | null; usedUrl?: string }> {
  const candidates = [...new Set(urls.filter(Boolean))];
  if (!candidates.length) return { file: null, error: "无 coverUrl" };
  let lastErr: string | null = null;
  for (const url of candidates) {
    try {
      const local = await downloadCover(code, kind, url, {
        force: true,
        sourceId: onlyId,
        pageUrl,
      });
      if (local) return { file: local, error: null, usedUrl: url };
      lastErr = "downloadCover 未写出文件";
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  return { file: null, error: lastErr };
}

async function main() {
  initScrapeNetworkStores();
  const cfg = loadScrapeConfig(true);
  const libs = loadLibrariesConfig(true);
  const kind = resolveKind(KIND, libs);
  if (!kind) throw new Error(`未解析到 kind: ${KIND}`);

  const outRoot = e2eOutRoot(fixture, runLabel as SourceId);
  fs.mkdirSync(outRoot, { recursive: true });

  console.log(`=== ${CODE} 端到端 [${runLabel}] kind=${KIND} ===`);
  console.log(`源: ${rel(SOURCE_STRM)}`);
  console.log(`输出库: ${rel(outRoot)}\n`);

  console.log(`[1] 刮削…${mergeMode ? "（多源 merge，无 metaSourcesOverride）" : ""}`);
  const flareE2e = !mergeMode && getCatalogEntry(onlyId)?.access === "proxy_flare";
  const scrapeTimeoutMs = mergeMode ? 180_000 : flareE2e ? 180_000 : 90_000;
  const detail = await scrapeCodeDetailed(CODE, KIND, {
    force: true,
    channel: "auto",
    ...(mergeMode ? {} : { metaSourcesOverride: [onlyId] }),
    signal: AbortSignal.timeout(scrapeTimeoutMs),
  });
  let meta = detail.meta;
  const coverUrl = meta.coverUrl || detail.bySource.get(onlyId)?.coverUrl || null;
  console.log(
    `  ok=${meta.ok} source=${meta.source} tried=${(meta.sourcesTried || []).join(",") || onlyId}`,
  );
  console.log(`  title=${meta.title}`);
  if (meta.titleZh) console.log(`  titleZh=${meta.titleZh} (from ${meta.fieldSources?.titleZh || "?"})`);
  console.log(`  studio=${meta.studio || "—"} series=${meta.series || "—"}`);
  console.log(`  actors=${(meta.actors || []).join(",") || "—"} genres=${(meta.genres || []).slice(0, 6).join(",")}`);
  console.log(`  coverUrl=${coverUrl || "—"}`);
  if (mergeMode && meta.fieldSources) {
    console.log(`  fieldSources=${JSON.stringify(meta.fieldSources)}`);
  }
  if (!meta.ok) {
    const err =
      meta.message ||
      detail.bySource.get(onlyId)?.error ||
      [...detail.bySource.values()].find((r) => r.error)?.error ||
      "无数据";
    console.error(`  FAIL: ${err}`);
    process.exitCode = 1;
    return;
  }

  console.log("[2] 封面…");
  let coverErr: string | null = null;
  const providerHit = detail.bySource.get(onlyId);
  const coverCandidates = [
    coverUrl,
    ...(providerHit?.alternateCoverUrls || []),
  ].filter((u): u is string => Boolean(u));
  if (coverCandidates.length) {
    const got = await downloadCoverLogged(coverCandidates, KIND, CODE, meta.website || undefined);
    coverErr = got.error;
    if (got.file) {
      meta = { ...meta, coverUrl: got.usedUrl || coverUrl, coverLocal: got.file };
    }
    console.log(`  local=${got.file ? rel(got.file) : "no"} ${got.error ? `err=${got.error}` : `bytes=${fs.statSync(got.file!).size}`}`);
  } else {
    coverErr = "无 coverUrl";
    console.log("  无 coverUrl");
  }
  writeScrapeCache(meta);

  const classified = classifyFromPath(fixture.sourceRel, path.basename(SOURCE_STRM), CODE, libs.organize.crackKeywords);
  const sourceRel = fixture.sourceRel;
  const db = openDatabase();
  db.prepare(`
    INSERT INTO files (kind, source_path, file_name, file_size, file_mtime, code, mosaic, status)
    VALUES (@kind, @source_path, @file_name, @file_size, @file_mtime, @code, @mosaic, 'scraped')
    ON CONFLICT(source_path) DO UPDATE SET
      code = excluded.code, mosaic = excluded.mosaic, status = 'scraped', kind = excluded.kind
  `).run({
    kind: KIND,
    source_path: sourceRel,
    file_name: path.basename(SOURCE_STRM),
    file_size: fs.statSync(SOURCE_STRM).size,
    file_mtime: Math.floor(fs.statSync(SOURCE_STRM).mtimeMs),
    code: CODE,
    mosaic: classified.mosaic || (KIND === "fc2" ? "无码" : KIND === "china" ? "无码" : "有码"),
  });
  const row = db
    .prepare(`SELECT id, kind, source_path, file_name, code, mosaic, status FROM files WHERE source_path = ?`)
    .get(sourceRel) as {
    id: number;
    kind: typeof KIND;
    source_path: string;
    file_name: string;
    code: string;
    mosaic: string;
    status: string;
  };

  const jobOptions = {
    useGlobal: { organize: false as const },
    organize: {
      organizeMode: "hardlink",
      libraryRoot: outRoot,
      onConflict: "overwrite",
    },
  };

  console.log("[3] 整理计划…");
  const organize = resolveOrganizeForKind(KIND, libs);
  const plan = buildPlanForFile(row, kind, {
    projectRoot: PROJECT_ROOT,
    onConflict: "overwrite",
    organize,
    jobOptions,
  });
  if (!plan) throw new Error("未生成整理计划");
  console.log(`  dir/file = ${plan.targetRel}`);
  console.log(`  mosaic=${plan.mosaic} resolution=${plan.resolution || "—"} subtitle=${plan.hasSubtitle}`);
  console.log(`  suffix in file = ${path.parse(plan.targetAbs).name.replace(CODE, "") || "(空，配置后缀模板为空)"}`);

  console.log("[4] 文件转移…");
  const transfer = applyFileTransfer({
    sourceAbs: plan.sourceAbs,
    targetAbs: plan.targetAbs,
    mode: plan.mode,
    fallback: plan.fallback,
    onConflict: plan.onConflict,
  });
  console.log(`  ${transfer.ok ? "OK" : "FAIL"} action=${transfer.action} ${transfer.message || rel(transfer.targetAbs)}`);
  if (!transfer.ok) {
    process.exitCode = 1;
    return;
  }

  const kindPrefs = resolveKindScrapePrefs(KIND, cfg);

  const wmLabels = resolveWatermarkLabels(
    plan.mosaic || meta.mosaic,
    plan.hasSubtitle,
    kindPrefs.watermark,
    plan.resolution,
  );
  console.log(
    `[5] 海报 crop=${plan.posterCrop} watermark.enabled=${kindPrefs.watermark.enabled} labels=${wmLabels.map((l) => l.id).join(",") || "(无：有码角标关闭且无字幕/4K)"}`,
  );
  let thumbAbs: string | null = null;
  if (plan.coverSource && plan.posterAbs) {
    await processPosterImage(plan.coverSource, plan.posterAbs, {
      cropMode: plan.posterCrop || "none",
      cropRatio: kindPrefs.download.cropRatio,
      cropIndependentPoster: kindPrefs.download.cropIndependentPoster,
      preferCropResult: kindPrefs.download.preferCropResult,
      watermark: kindPrefs.watermark,
      mosaic: plan.mosaic || meta.mosaic,
      hasSubtitle: plan.hasSubtitle,
      resolution: plan.resolution,
      imageKind: "poster",
      overwriteImages: true,
    });
    const st = fs.statSync(plan.posterAbs);
    console.log(`  poster ${rel(plan.posterAbs)} ${st.size} bytes`);
    thumbAbs = ensureThumbBesidePoster(plan.posterAbs);
    if (thumbAbs) console.log(`  thumb ${rel(thumbAbs)}`);
  } else {
    console.log("  跳过海报（无本地封面）");
  }

  let extrafanartLocal: string[] = [];
  if (meta.extrafanartUrls?.length && plan.posterAbs) {
    console.log(`[5b] 剧照 extrafanart ×${meta.extrafanartUrls.length}…`);
    extrafanartLocal = await downloadExtrafanartToDir(path.dirname(plan.posterAbs), meta.extrafanartUrls, {
      referer: meta.website,
      sourceId: meta.fieldSources?.extrafanart || meta.fieldSources?.cover || meta.source || onlyId,
      force: true,
    });
    meta = { ...meta, extrafanartLocal };
    writeScrapeCache(meta);
    console.log(`  saved=${extrafanartLocal.length} dir=${rel(path.join(path.dirname(plan.posterAbs), "extrafanart"))}`);
  }

  writeMovieNfo(plan.nfoAbs, meta, {
    mergeStrategy: kindPrefs.nfo.mergeStrategy,
    nfo: kindPrefs.nfo,
    mediaTitle: plan.mediaTitle,
    ctx: buildNfoWriteContext({
      meta,
      mediaTitle: plan.mediaTitle,
      hasSubtitle: plan.hasSubtitle,
      resolution: plan.resolution || undefined,
      mosaic: plan.mosaic || meta.mosaic,
      posterAbs: plan.posterAbs,
      thumbAbs,
      cdPart: plan.part ? `CD${plan.part}` : undefined,
    }),
  });
  console.log(`[6] NFO → ${rel(plan.nfoAbs)}`);

  const nfoText = fs.readFileSync(plan.nfoAbs, "utf8");
  const collected = metaCollectedFields(meta);
  const nfoFieldChecks = checkNfoFields(nfoText, CODE, kindPrefs.nfo, collected);
  const nfoSummary = summarizeNfoChecks(nfoFieldChecks);

  const gap = scrapeFieldGapReport(meta, kindPrefs.nfo);

  const nfoTitle = pickXmlTag(nfoText, "title");
  const titleHasChinese = /[\u4e00-\u9fff]/.test(nfoTitle);

  const report = {
    source: runLabel,
    mode: mergeMode ? "merge" : "single",
    kind: KIND,
    code: CODE,
    sourceStrm: fixture.sourceRel,
    scrapeOk: meta.ok,
    merge: mergeMode
      ? {
          sourcesTried: meta.sourcesTried,
          fieldSources: meta.fieldSources,
          titleZh: meta.titleZh || null,
          nfoTitle,
          titleHasChinese,
        }
      : undefined,
    coverUrl,
    coverLocal: meta.coverLocal || null,
    coverError: coverErr,
    transfer: { ok: transfer.ok, action: transfer.action, target: rel(transfer.targetAbs) },
    naming: {
      directoryTemplate: kindPrefs.naming?.directoryTemplate || cfg.naming.directoryTemplate,
      fileNameTemplate: kindPrefs.naming?.fileNameTemplate || cfg.naming.fileNameTemplate,
      videoSuffixTemplate: cfg.naming.videoSuffixTemplate,
      targetRel: plan.targetRel,
    },
    watermark: {
      enabled: kindPrefs.watermark.enabled,
      crop: plan.posterCrop,
      labels: wmLabels.map((l) => l.id),
      poster: plan.posterAbs && fs.existsSync(plan.posterAbs) ? rel(plan.posterAbs) : null,
    },
    nfo: {
      requiredOk: nfoSummary.requiredOk,
      gap,
      required: nfoSummary.required,
      optionalPresent: nfoSummary.optionalPresent,
      optionalMissing: nfoSummary.optionalMissing,
      collectedCount: nfoSummary.collectedCount,
      collected,
      all: nfoFieldChecks,
    },
  };
  fs.writeFileSync(path.join(outRoot, "e2e-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("\n清单:");
  console.log(`  1.文件转移 ${transfer.ok ? "通过" : "失败"} (${transfer.action})`);
  console.log(`  2.文件夹/文件命名 ${plan.targetRel}`);
  console.log(`  3.封面 ${meta.coverLocal ? "通过" : "失败"} 水印 ${wmLabels.length ? wmLabels.map((l) => l.id).join(",") : "配置未出角标"}`);
  printFieldGapReport(runLabel, meta, kindPrefs.nfo, nfoSummary);
  if (mergeMode) {
    console.log(`\n  merge NFO title 含中文: ${titleHasChinese ? "是" : "否"} (${nfoTitle.slice(0, 40)}…)`);
    if (!titleHasChinese && meta.titleZh) {
      console.warn("  WARN: meta 有 titleZh 但 NFO title 未含中文");
      process.exitCode = 1;
    }
  }

  // 单站脚本结束：关掉本进程 Chrome，并清远端孤儿，避免 Flare 只开不关卡死
  if (flareE2e) {
    await releaseFlareSession("e2e-done");
    await recycleFlareSessions({ keepOwned: false });
  }
}

function pickXmlTag(xml: string, name: string): string {
  const cdata = xml.match(new RegExp(`<${name}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${name}>`, "i"));
  if (cdata?.[1] != null) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return plain?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
}

await main();
