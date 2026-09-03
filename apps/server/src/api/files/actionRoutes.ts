import { Router } from "express";
import { openDatabase } from "../../db/init.js";
import { readScrapeCache } from "../../scrape/cache.js";
import { beginPipeline, endPipeline } from "../../scrape/pipelineProgress.js";
import type { KindId } from "../../types.js";
import { API_CODES } from "../codes.js";
import { sendFail, sendOk } from "../respond.js";
import { parsePipelineRunKind } from "./helpers.js";

export function registerActionRoutes(filesRouter: Router) {
filesRouter.post("/:id/rescrape", async (req, res) => {
  const db = openDatabase();
  const row = db
    .prepare(`SELECT id, kind, code FROM files WHERE id = ?`)
    .get(req.params.id) as { id: number; kind: KindId; code: string | null } | undefined;
  if (!row) {
    sendFail(res, "文件不存在", 404, "not_found");
    return;
  }

  const mode = req.body?.mode === "reorganize" ? "reorganize" : "rescrape";
  const runKind = parsePipelineRunKind(row.id, req.body?.kind, mode);
  const codeOverride = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const pageUrl = typeof req.body?.pageUrl === "string" ? req.body.pageUrl.trim() : "";
  const force = req.body?.force !== false;

  if (codeOverride) {
    db.prepare(`UPDATE files SET code = ? WHERE id = ?`).run(codeOverride, row.id);
    row.code = codeOverride;
  }
  if (!row.code) {
    sendFail(res, "无番号，无法执行", 400, API_CODES.missing_code);
    return;
  }

  try {
    const { scrapeOneFile } = await import("../../scrape/runner.js");
    const { completeScrapeWithNfo, organizeOneFile } = await import("../../organize/runner.js");

    beginPipeline(row.id, mode, runKind);

    if (mode === "reorganize") {
      try {
        const org = await organizeOneFile(row.id);
        const meta = readScrapeCache(row.code, row.kind);
        const organized = org.organized > 0;
        sendOk(res, {
          meta,
          fileId: row.id,
          mode,
          organized,
          organize: {
            organized: org.organized,
            failed: org.failed,
            skipped: org.skipped,
          },
          message: organized
            ? "已重新整理"
            : org.failed
              ? "整理失败"
              : "整理未执行（检查库路径/冲突策略）",
        });
      } finally {
        endPipeline(row.id);
      }
      return;
    }

    try {
      const scraped = await scrapeOneFile(row.id, {
        force,
        codeOverride: codeOverride || undefined,
        pageUrl: pageUrl || undefined,
      });
      if (!scraped.ok) {
        sendOk(res, {
          meta: scraped.meta,
          fileId: row.id,
          mode,
          organized: false,
          message: scraped.meta.message ?? "刮削未成功",
        });
        return;
      }

      const out = await completeScrapeWithNfo(row.id, {
        jobOptions: {
          useGlobal: { organize: false, nfo: true, watermark: true, download: true },
          organize: { onConflict: "overwrite" },
        },
      });
      const meta = readScrapeCache(row.code, row.kind) ?? scraped.meta;
      const nfoDone = out.ok;
      sendOk(res, {
        meta,
        fileId: row.id,
        mode,
        organized: nfoDone,
        organize: {
          organized: nfoDone ? 1 : 0,
          failed: out.failed ? 1 : 0,
          skipped: 0,
        },
        message: nfoDone
          ? "已重新刮削并更新封面与 NFO"
          : out.failed
            ? out.message ?? "刮削成功，NFO 生成失败"
            : "刮削成功，NFO 未写入",
      });
    } finally {
      endPipeline(row.id);
    }
  } catch (err) {
    endPipeline(row.id);
    sendFail(res, err instanceof Error ? err.message : String(err), 500, API_CODES.internal_error);
  }
});
}
