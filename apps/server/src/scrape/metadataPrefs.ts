import type { ScrapeConfig, ScrapeMeta } from "./types.js";
import * as maps from "./maps.js";
import { looksChinese, resolveLlmConfig, translateText } from "./llmTranslate.js";

export type ApplyMetadataOptions = {
  signal?: AbortSignal;
};

function isPostProcessSource(source: string): boolean {
  return source === "forum" || source === "llm";
}

/** 网络刮削标题字段无有效内容（无 titleZh，title 为空或仅番号） */
function isNetworkTitleDataEmpty(meta: ScrapeMeta): boolean {
  const code = String(meta.code || "").trim().toUpperCase();
  const titleZh = meta.titleZh?.trim() || "";
  if (titleZh) return false;
  const title = meta.title?.trim() || "";
  if (!title) return true;
  if (code && title.toUpperCase() === code) return true;
  return false;
}

/** 网络刮削已提供中文标题时，不再用色花堂库覆盖 */
function hasNetworkChineseTitle(
  meta: ScrapeMeta,
  fieldSources: Record<string, string>,
): boolean {
  const zh = meta.titleZh?.trim();
  if (zh && looksChinese(zh)) {
    const src = fieldSources.titleZh;
    if (!src || !isPostProcessSource(src)) return true;
  }
  const title = meta.title?.trim();
  if (title && title !== meta.code && looksChinese(title)) {
    const src = fieldSources.title;
    if (src && !isPostProcessSource(src)) return true;
  }
  return false;
}

export function shouldApplyForumTitle(
  forumTitle: string,
  meta: ScrapeMeta,
  fieldSources: Record<string, string>,
): boolean {
  const forum = forumTitle.trim();
  if (!forum) return false;
  if (hasNetworkChineseTitle(meta, fieldSources)) return false;
  if (looksChinese(forum)) return true;
  return isNetworkTitleDataEmpty(meta);
}

/** 元数据后处理：色花堂标题 / 映射 / 校验 / 翻译 */
export async function applyMetadataPrefs(
  meta: ScrapeMeta,
  prefs: ScrapeConfig["metadata"],
  scrapeCfg?: ScrapeConfig,
  opts: ApplyMetadataOptions = {},
): Promise<ScrapeMeta> {
  let next: ScrapeMeta = { ...meta, actors: [...(meta.actors || [])], genres: [...(meta.genres || [])] };
  const fieldSources = { ...(next.fieldSources || {}) };

  // 1) 色花堂中文标题：仅补 titleZh；不覆盖原标题；网络已有中文标题时跳过
  if (prefs.useForumZhTitle) {
    const forum = maps.lookupForumTitle(next.code);
    if (forum && shouldApplyForumTitle(forum, next, fieldSources)) {
      next = { ...next, titleZh: forum };
      fieldSources.titleZh = "forum";
    }
    if (next.titleZh?.trim() && !next.title?.trim()) {
      next = { ...next, title: next.titleZh.trim() };
      if (!fieldSources.title) fieldSources.title = fieldSources.titleZh || "titleZh";
    }
  }

  // 2) 简介换行
  if (prefs.trimPlot && next.plot) {
    next = {
      ...next,
      plot: next.plot.replace(/\n{3,}/g, "\n\n").trim(),
    };
  }

  // 3) 演员 / 标签映射
  const lang = prefs.mappingLanguage || "zh-CN";
  if (prefs.enableActorMapping || next.actors?.length) {
    const mapped = maps.mapActors(next.actors || [], lang, Boolean(prefs.enableActorMapping));
    next = {
      ...next,
      actors: mapped.actors,
      actorUrls: Object.keys(mapped.actorUrls).length
        ? { ...(next.actorUrls || {}), ...mapped.actorUrls }
        : next.actorUrls,
    };
  }
  if (prefs.enableTagMapping || next.genres?.length) {
    next = {
      ...next,
      genres: maps.mapTags(next.genres || [], lang, Boolean(prefs.enableTagMapping)),
    };
  }

  // 4) LLM 翻译（需 scrapeCfg.llm）
  if (scrapeCfg && (prefs.autoTranslateTitle || prefs.autoTranslateOutline)) {
    const llm = resolveLlmConfig(scrapeCfg);
    if (llm.baseUrl) {
      const system = prefs.customSystemPrompt || undefined;
      try {
        if (prefs.autoTranslateTitle) {
          const src = (next.titleZh || next.title || "").trim();
          if (src && !looksChinese(src)) {
            const translated = await translateText({
              text: src,
              llm,
              systemPrompt: system,
              signal: opts.signal,
            });
            if (translated) {
              next = { ...next, titleZh: translated, title: translated };
              fieldSources.title = "llm";
              fieldSources.titleZh = "llm";
            }
          }
        }
        if (prefs.autoTranslateOutline && next.plot?.trim() && !looksChinese(next.plot)) {
          const translated = await translateText({
            text: next.plot,
            llm,
            systemPrompt: system,
            signal: opts.signal,
          });
          if (translated) {
            next = { ...next, plot: translated };
            fieldSources.plot = "llm";
          }
        }
        // 清掉旧占位标记
        if (next.message?.includes("translate_pending")) {
          const cleaned = next.message
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s && s !== "translate_pending")
            .join("; ");
          next = { ...next, message: cleaned || undefined };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        next = {
          ...next,
          message: next.message ? `${next.message}; translate_failed: ${msg}` : `translate_failed: ${msg}`,
        };
      }
    } else if (prefs.autoTranslateTitle || prefs.autoTranslateOutline) {
      next = {
        ...next,
        message: next.message
          ? `${next.message}; translate_skipped: 未配置 LLM`
          : "translate_skipped: 未配置 LLM",
      };
    }
  }

  next = { ...next, fieldSources };

  if (!next.ok) return next;

  // 5) 严格校验（翻译/映射之后）
  if (prefs.strictMode) {
    const titleOk = Boolean(next.title && next.title !== next.code);
    if (!titleOk) {
      return {
        ...next,
        ok: false,
        message: "严格模式：缺少有效标题",
      };
    }
  }

  if (prefs.requireCover) {
    if (!next.coverUrl && !next.coverLocal) {
      return {
        ...next,
        ok: false,
        message: "严格模式：缺少封面",
      };
    }
  }

  return next;
}
