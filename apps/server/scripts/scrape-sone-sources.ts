/**
 * 对照 mdc 目录：用 SONE-001 逐源刮削，写入 SONE-001/_scrap/{source}/
 * 不覆盖原有 .nfo / poster / thumb / strm。
 *
 *   npx tsx scripts/scrape-sone-sources.ts
 *   npx tsx scripts/scrape-sone-sources.ts --id=javbus
 */
import fs from "node:fs";
import path from "node:path";
import { loadScrapeConfig } from "../src/config/loadScrape.js";
import { writeMovieNfo } from "../src/organize/nfo.js";
import { buildNfoWriteContext, ensureThumbBesidePoster } from "../src/organize/nfoCtx.js";
import { PROJECT_ROOT } from "../src/paths.js";
import { fetchBuffer } from "../src/scrape/network/fetch.js";
import { initScrapeNetworkStores } from "../src/scrape/network/init.js";
import { SOURCE_CATALOG } from "../src/scrape/providers/catalog.js";
import { getProvider } from "../src/scrape/providers/index.js";
import type { ProviderResult, ScrapeMeta, SourceId } from "../src/scrape/types.js";

const CODE = "SONE-001";
const KIND = "japan_censored" as const;
const OUT_ROOT = path.join(
  PROJECT_ROOT,
  "media",
  "片商目录",
  "日本有码",
  "SONE",
  CODE,
  "_scrap",
);

const onlyId = process.argv.find((a) => a.startsWith("--id="))?.slice(5);

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} 超过 ${ms / 1000}s 未返回`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function resultToMeta(r: ProviderResult): ScrapeMeta {
  const f = r.fields || {};
  const title = String(f.title || f.titleZh || "").trim() || CODE;
  const coverUrl = r.coverUrl || f.coverUrl || null;
  const hasData = Boolean(
    (f.title && f.title !== CODE) ||
      f.titleZh ||
      f.plot ||
      (f.actors && f.actors.length) ||
      coverUrl,
  );
  return {
    code: CODE,
    kind: KIND,
    title,
    titleZh: f.titleZh,
    plot: f.plot,
    premiered: f.premiered,
    studio: f.studio,
    publisher: f.publisher,
    series: f.series,
    actors: f.actors || [],
    genres: f.genres || [],
    runtime: f.runtime ?? null,
    directors: f.directors,
    trailerUrl: f.trailerUrl,
    website: f.website,
    score: f.score ?? null,
    ratingValue: f.ratingValue ?? null,
    ratingMax: f.ratingMax,
    ratingSource: f.ratingSource,
    votes: f.votes ?? null,
    originalPlot: f.originalPlot,
    coverUrl,
    source: r.source,
    sourcesTried: [r.source],
    fieldSources: {},
    scrapedAt: new Date().toISOString(),
    ok: !r.error && hasData,
    message: r.error,
  };
}

async function saveCover(
  dir: string,
  url: string | null | undefined,
  sourceId: string,
): Promise<string | null> {
  if (!url) return null;
  try {
    const { cookieForUrl } = await import("../src/scrape/network/sourceCookies.js");
    const referer = `${new URL(url).origin}/`;
    const buf = await fetchBuffer(url, {
      timeoutMs: 30_000,
      referer,
      cookie: cookieForUrl(url, sourceId),
    });
    if (!buf?.length) return null;
    const ext = url.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
    const name = ext.startsWith("jp") ? "thumb.jpg" : `thumb.${ext}`;
    const abs = path.join(dir, name);
    fs.writeFileSync(abs, buf);
    return name;
  } catch (err) {
    console.error(`  cover fail: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main() {
  initScrapeNetworkStores();
  const cfg = loadScrapeConfig(true);
  const nfoCfg = cfg.nfo;
  const list = SOURCE_CATALOG.filter(
    (e) => e.implemented && (!onlyId || e.id === onlyId),
  );
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  const summary: Array<Record<string, unknown>> = [];
  console.log(`=== ${CODE} 逐源刮削 ${list.length} 站 → ${OUT_ROOT} ===\n`);

  for (const entry of list) {
    const dir = path.join(OUT_ROOT, entry.id);
    fs.mkdirSync(dir, { recursive: true });
    process.stdout.write(`[${entry.id}] `);
    const provider = getProvider(entry.id as SourceId);
    const started = Date.now();
    let result: ProviderResult | null = null;
    try {
      result = await withTimeout(
        provider!.scrape({
          code: CODE,
          kind: KIND,
          metaSources: [entry.id as SourceId],
          coverSources: [entry.id as SourceId],
          signal: AbortSignal.timeout(28_000),
        }),
        30_000,
        entry.id,
      );
    } catch (err) {
      result = {
        source: entry.id,
        fields: {},
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    const r = result || {
      source: entry.id,
      fields: {},
      ms: Date.now() - started,
      error: "无返回",
    };
    const meta = resultToMeta(r);
    const coverFile = meta.ok ? await saveCover(dir, meta.coverUrl, entry.id) : null;
    const nfoPath = path.join(dir, `${CODE}.nfo`);
    let posterAbs: string | null = null;
    let thumbAbs: string | null = null;
    if (coverFile) {
      const thumb = path.join(dir, coverFile);
      posterAbs = path.join(dir, "poster.jpg");
      if (thumb !== posterAbs && fs.existsSync(thumb)) {
        fs.copyFileSync(thumb, posterAbs);
      }
      thumbAbs = ensureThumbBesidePoster(posterAbs);
    }
    if (meta.ok && nfoCfg) {
      writeMovieNfo(nfoPath, meta, {
        nfo: nfoCfg,
        mergeStrategy: "prefer_scraped",
        ctx: buildNfoWriteContext({
          meta,
          posterAbs,
          thumbAbs,
        }),
      });
    }
    fs.writeFileSync(
      path.join(dir, "result.json"),
      `${JSON.stringify(
        {
          id: entry.id,
          label: entry.label,
          ok: meta.ok,
          ms: r.ms,
          error: r.error || null,
          fields: r.fields,
          coverUrl: meta.coverUrl,
          coverFile,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const fieldKeys = Object.keys(r.fields || {}).filter((k) => {
      const v = (r.fields as Record<string, unknown>)[k];
      return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);
    });
    const row = {
      id: entry.id,
      ok: meta.ok,
      ms: r.ms,
      error: r.error || null,
      fields: fieldKeys,
      cover: Boolean(coverFile),
    };
    summary.push(row);
    console.log(
      meta.ok
        ? `OK ${r.ms}ms fields=${fieldKeys.join(",") || "—"} cover=${coverFile || "no"}`
        : `FAIL ${r.ms}ms ${String(r.error || "无有效字段").slice(0, 80)}`,
    );
  }

  fs.writeFileSync(
    path.join(OUT_ROOT, "summary.json"),
    `${JSON.stringify({ code: CODE, kind: KIND, at: new Date().toISOString(), results: summary }, null, 2)}\n`,
    "utf8",
  );
  const okN = summary.filter((s) => s.ok).length;
  console.log(`\n完成 ${okN}/${summary.length} 有数据 → ${OUT_ROOT}`);
}

await main();
