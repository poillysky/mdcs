import * as cheerio from "cheerio";
import { fetchText } from "../network/fetch.js";
import {
  absUrl,
  cleanTitle,
  isJunkCoverUrl,
  isJunkTitle,
  pageMentionsCode,
  pickOgImage,
  pickOgTitle,
  stdCode,
  stripTags,
} from "./htmlUtils.js";
import { prepareProviderFetch, siteFetchOpts } from "./providerSite.js";
import { buildFanzaTrailerUrl, pickBestTrailer, withHttps } from "./dmmTrailer.js";
import type { ProviderResult, ScrapeContext, ScrapeMeta, ScrapeProvider } from "../types.js";

const DEFAULT_BASE = "https://www.freejavbt.com";

/** MDCX freejavbt.get_actor 男优黑名单（只保留女优到 actors） */
const AV_MAN_NAMES = new Set([
  "貞松大輔", "鮫島", "森林原人", "黒田悠斗", "主観", "吉村卓", "野島誠", "小田切ジュン", "しみけん",
  "セツネヒデユキ", "大島丈", "玉木玲", "ウルフ田中", "ジャイアント廣田", "イセドン内村", "西島雄介",
  "平田司", "杉浦ボッ樹", "大沢真司", "ピエール剣", "羽田", "田淵正浩", "タツ", "南佳也", "吉野篤史",
  "今井勇太", "マッスル澤野", "井口", "松山伸也", "花岡じった", "佐川銀次", "およよ中野", "小沢とおる",
  "橋本誠吾", "阿部智広", "沢井亮", "武田大樹", "市川哲也", "浅野あたる", "梅田吉雄", "阿川陽志",
  "素人", "結城結弦", "畑中哲也", "堀尾", "上田昌宏", "えりぐち", "市川潤", "沢木和也", "トニー大木",
  "横山大輔", "一条真斗", "真田京", "イタリアン高橋", "中田一平", "完全主観", "イェーイ高島", "山田万次郎",
  "澤地真人", "杉山", "ゴロー", "細田あつし", "藍井優太", "奥村友真", "ザーメン二郎", "桜井ちんたろう",
  "冴山トシキ", "久保田裕也", "戸川夏也", "北こうじ", "柏木純吉", "ゆうき", "トルティーヤ鈴木", "神けんたろう",
  "堀内ハジメ", "ナルシス小林", "アーミー", "池田径", "吉村文孝", "優生", "久道実", "一馬", "辻隼人",
  "片山邦生", "Qべぇ", "志良玉弾吾", "今岡爽紫郎", "工藤健太", "原口", "アベ", "染島貢", "岩下たろう",
  "小野晃", "たむらあゆむ", "川越将護", "桜木駿", "瀧口", "TJ本田", "園田", "宮崎", "鈴木一徹", "黒人",
  "カルロス", "天河", "ぷーてゃん", "左曲かおる", "富田", "TECH", "ムールかいせ", "健太", "山田裕二",
  "池沼ミキオ", "ウサミ", "押井敬之", "浅見草太", "ムータン", "フランクフルト林", "石橋豊彦", "矢野慎二",
  "芦田陽", "くりぼ", "ダイ", "ハッピー池田", "山形健", "忍野雅一", "渋谷優太", "服部義", "たこにゃん",
  "北山シロ", "つよぽん", "山本いくお", "学万次郎", "平井シンジ", "望月", "ゆーきゅん", "頭田光", "向理来",
  "かめじろう", "高橋しんと", "栗原良", "テツ神山", "タラオ", "真琴", "滝本", "金田たかお", "平ボンド",
  "春風ドギー", "桐島達也", "中堀健二", "徳田重男", "三浦屋助六", "志戸哲也", "ヒロシ", "オクレ", "羽目白武",
  "ジョニー岡本", "幸野賀一", "インフィニティ", "ジャック天野", "覆面", "安大吉", "井上亮太", "笹木良一",
  "艦長", "軍曹", "タッキー", "阿部ノボル", "ダウ兄", "まーくん", "梁井一", "カンパニー松尾", "大塚玉堂",
  "日比野達郎", "小梅", "ダイナマイト幸男", "タケル", "くるみ太郎", "山田伸夫", "氷崎健人",
]);

export type FreejavbtParsedDetail = {
  fields: Partial<ScrapeMeta>;
  coverUrl: string | null;
  extrafanartUrls?: string[];
};

function uniq(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const t = n.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 对齐 MDCX get_title */
export function parseFreejavbtTitle(html: string, fallbackCode: string): { title: string; number: string } {
  const rawMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const raw = rawMatch.replace(/\| FREE JAV BT/i, "").trim();
  if (!raw) return { title: "", number: fallbackCode };

  const pipeParts = raw.split("|").map((s) => s.trim());
  let number = fallbackCode;
  let title = "";
  if (pipeParts.length === 2) {
    number = pipeParts[0] || fallbackCode;
    title = pipeParts.slice(1).join("|").replace(new RegExp(number, "gi"), "").trim();
  } else {
    const sp = raw.split(/\s+/);
    if (sp.length >= 2) {
      number = sp[0] || fallbackCode;
      title = sp.slice(1).join(" ").trim();
    }
  }
  title = title
    .replace(/中文字幕/g, "")
    .replace(/無碼/g, "")
    .replace(/\\n/g, "")
    .replace(/_/g, "-")
    .replace(new RegExp(number.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "gi"), "")
    .replace(/--+/g, "-")
    .trim();
  const rawForCheck = pipeParts.length === 2 ? pipeParts.join("|") : raw;
  if (!title || /翻译错误/.test(title) || /每日更新/.test(rawForCheck)) {
    return { title: "", number };
  }
  return { title, number };
}

/** 去掉 title 末尾重复拼接的演员名（含男优，对齐 MDCX get_actor 全量名单） */
export function stripTrailingActorsFromTitle(title: string, allActors: string[]): string {
  let t = title.trim();
  if (!t || !allActors.length) return t;
  const names = [...allActors]
    .filter((n) => n && n.length >= 2)
    .sort((a, b) => b.length - a.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of names) {
      if (t.endsWith(name)) {
        t = t.slice(0, -name.length).trim();
        changed = true;
        break;
      }
      const spaced = ` ${name}`;
      if (t.endsWith(spaced)) {
        t = t.slice(0, -spaced.length).trim();
        changed = true;
        break;
      }
    }
  }
  return t.trim();
}

/** MDCX get_title 后处理 + 去尾部演员 */
export function cleanFreejavbtTitle(title: string, number: string, allActors: string[]): string {
  let t = cleanTitle(title, number);
  t = t.replace(/\s*(免费AV在线看|無料で見る|在线看)\s*$/i, "").trim();
  t = stripTrailingActorsFromTitle(t, allActors);
  if (isJunkTitle(t) || /你可能喜欢|あなたは好きかもしれません|翻译错误|每日更新/.test(t)) return "";
  return t;
}

function textAfterSpan($: cheerio.CheerioAPI, labelRe: RegExp): string {
  let found = "";
  $("span").each((_, el) => {
    const lab = stripTags($(el).text());
    if (!labelRe.test(lab)) return;
    const sib = $(el).next();
    if (sib.length) {
      found = stripTags(sib.text());
      return false;
    }
    const parent = $(el).parent();
    const b = parent.find("b").first().text();
    found = stripTags(b || parent.text().replace(lab, ""));
    return false;
  });
  return found.trim();
}

function metaByLabel($: cheerio.CheerioAPI, re: RegExp): { text: string; links: string[] } {
  let text = "";
  const links: string[] = [];
  $(".single-video-meta").each((_, el) => {
    const $el = $(el);
    const lab = stripTags($el.children("span").first().text());
    if (!re.test(lab)) return;
    $el.find("a").each((__, a) => {
      const n = stripTags($(a).text());
      if (n && n.length < 60 && !links.includes(n)) links.push(n);
    });
    const spans = $el.children("span");
    text = spans.length >= 2 ? stripTags(spans.last().text()) : stripTags($el.text().replace(lab, ""));
  });
  if (!text && !links.length) text = textAfterSpan($, re);
  return { text, links };
}

function isActressLink(className: string): boolean {
  return /(^|\s)actress(\s|$)/i.test(className);
}

function parseFreejavbtAllActors($: cheerio.CheerioAPI): string[] {
  const all: string[] = [];
  $("a").each((_, el) => {
    const $el = $(el);
    if (
      $el.closest(
        ".related, .sidebar, #related, .you-may-like, .recommend, .ranking, .footer, .comment",
      ).length
    ) {
      return;
    }
    const cls = $el.attr("class") || "";
    if (!isActressLink(cls)) return;
    const n = stripTags($el.text());
    if (n && n !== "?" && !/暫無/.test(n) && !all.includes(n)) all.push(n);
  });
  return all;
}

/** 优先取详情 meta 行「演员」，避免全页 actress 链接污染（如推荐区附加名） */
function parseFreejavbtMetaActors($: cheerio.CheerioAPI): string[] {
  return uniq(
    metaByLabel($, /演员|女優|出演|スター|AV女優|女优|女優名/).links.filter((n) => !AV_MAN_NAMES.has(n)),
  );
}

/** 标题正文中出现的演员名（单体作常见仅 1 人；过滤页内附加推荐演员） */
export function pickActorsReferencedInTitle(title: string, candidates: string[]): string[] {
  if (!title.trim() || !candidates.length) return [];
  const inTitle = candidates.filter((n) => n.length >= 2 && title.includes(n));
  return uniq(inTitle);
}

function parseFreejavbtActors($: cheerio.CheerioAPI, title: string): string[] {
  const metaActors = parseFreejavbtMetaActors($);
  const pool = metaActors.length
    ? metaActors
    : parseFreejavbtAllActors($).filter((n) => !AV_MAN_NAMES.has(n));
  const referenced = pickActorsReferencedInTitle(title, pool);
  if (referenced.length) return referenced;
  return pool;
}

function parseFreejavbtPremiered($: cheerio.CheerioAPI): string | undefined {
  const dateRaw =
    metaByLabel($, /日期|発売日|公開日|发行日|發行日/).text ||
    metaByLabel($, /日期|発売日|公開日|发行日|發行日/).links.join(" ");
  let scoped = dateRaw;
  if (!scoped) {
    const info = $(".single-video-info, .single-video-meta").first();
    if (info.length) {
      const local = cheerio.load(info.html() || "");
      scoped =
        textAfterSpan(local, /日期|発売日|公開日|发行日|發行日/) ||
        metaByLabel(local, /日期|発売日|公開日|发行日|發行日/).text;
    }
  }
  const dm = scoped.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!dm) return undefined;
  const premiered = `${dm[1]}-${dm[2]!.padStart(2, "0")}-${dm[3]!.padStart(2, "0")}`;
  const today = new Date();
  const release = new Date(`${premiered}T00:00:00Z`);
  // 明显未来日期（站点脏数据）丢弃，交给其它源 fieldPriority 补
  if (release.getTime() > today.getTime() + 45 * 24 * 3600 * 1000) return undefined;
  return premiered;
}

function parseFreejavbtGenres($: cheerio.CheerioAPI): string[] {
  const tags: string[] = [];
  const push = (raw: string) => {
    const item = raw.trim().replace(/^#+/, "").replace(/，/g, "");
    if (item && !tags.includes(item)) tags.push(item);
  };
  $('a[class*="genre"], a[href*="/genre/"], a[href*="/genres/"], a[href*="/tag/"]').each((_, el) => {
    push(stripTags($(el).text()));
  });
  const fromMeta = metaByLabel($, /类别|類別|ジャンル|类型|類型/).links
    .filter((n) => !/同一|動画|视频|更多/i.test(n));
  for (const n of fromMeta) push(n);
  return tags.slice(0, 40);
}

function parseFreejavbtCover(html: string, pageUrl: string): string | null {
  const $ = cheerio.load(html);
  const candidates: string[] = [];
  $("img.video-cover").each((_, el) => {
    const src = $(el).attr("data-src") || $(el).attr("src");
    if (src) candidates.push(src);
  });
  const og = pickOgImage(html);
  if (og) candidates.push(og);
  $('img.lazyload[data-src*="/samples/"]').each((_, el) => {
    const src = $(el).attr("data-src");
    if (src) candidates.push(src);
  });
  for (const raw of candidates) {
    const url = absUrl(raw, pageUrl);
    if (url && url.startsWith("http") && !/no_preview_lg/i.test(url) && !isJunkCoverUrl(url)) {
      return url;
    }
  }
  return null;
}

/** MDCX get_extrafanart — tile-item 剧照，跳过 preview 锚点 */
function parseFreejavbtExtrafanart(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  coverUrl: string | null,
): string[] {
  const urls: string[] = [];
  $("a.tile-item").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.includes("#preview-video")) return;
    const url = absUrl(href, pageUrl);
    if (!url || !url.startsWith("http") || isJunkCoverUrl(url)) return;
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(url) && !/\/samples\//i.test(url)) return;
    if (coverUrl && url === coverUrl) return;
    if (!urls.includes(url)) urls.push(url);
  });
  return urls;
}

/** MDCX get_trailer — preview-video source → DMM litevideo mp4 */
function parseFreejavbtTrailer($: cheerio.CheerioAPI, html: string): string | undefined {
  const sources: string[] = [];
  $("video#preview-video source, video.preview source, .preview video source").each((_, el) => {
    const src = withHttps($(el).attr("src") || "");
    if (src) sources.push(src);
  });
  for (const sel of ["video#preview-video", "video.preview", ".preview video"]) {
    const direct = withHttps($(sel).first().attr("src") || "");
    if (direct) sources.push(direct);
  }
  const embed = html.match(
    /https?:\/\/[^"'\s<>]+(?:dmm\.co\.jp|cc\d+\.dmm\.co\.jp)[^"'\s<>]*(?:\.mp4|playlist\.m3u8)/i,
  );
  if (embed?.[0]) sources.push(embed[0]);
  return pickBestTrailer(sources.map((s) => buildFanzaTrailerUrl(s) || s));
}

/** 从详情 HTML 解析（L1 单测 + scrape 共用，对齐 MDCX test_freejavbt.py） */
export function parseFreejavbtDetailHtml(
  html: string,
  code: string,
  pageUrl: string,
): FreejavbtParsedDetail | { error: string } {
  const $ = cheerio.load(html);
  if (
    !html.includes("single-video-info col-12") &&
    !$(".single-video-meta").length &&
    !pickOgImage(html)
  ) {
    return { error: "非详情页" };
  }

  const std = stdCode(code);
  const allActors = parseFreejavbtAllActors($);
  const { title: rawTitle, number } = parseFreejavbtTitle(html, std);
  const title = cleanFreejavbtTitle(rawTitle, number || std, allActors);
  const actorTitleHint = title || rawTitle;

  const premiered = parseFreejavbtPremiered($);

  const runtimeRaw =
    textAfterSpan($, /时长|時長|収録時間|再生時間/) || metaByLabel($, /时长|収録時間|再生時間/).text;
  const runtime = Number(runtimeRaw.match(/(\d+)/)?.[1] || 0) || null;

  const series =
    textAfterSpan($, /系列|シリーズ/) ||
    metaByLabel($, /系列|シリーズ/).links[0] ||
    metaByLabel($, /系列|シリーズ/).text ||
    "";
  const directors = uniq(
    [textAfterSpan($, /导演|導演|監督/), ...metaByLabel($, /导演|導演|監督/).links].filter(Boolean),
  );
  const studio = textAfterSpan($, /制作|製作|メーカー/) || metaByLabel($, /制作|製作|メーカー/).text || "";
  const publisher = textAfterSpan($, /发行|發行/) || metaByLabel($, /发行|發行/).text || "";
  const actors = parseFreejavbtActors($, actorTitleHint);
  const genres = parseFreejavbtGenres($);
  const coverUrl = parseFreejavbtCover(html, pageUrl);
  const extrafanartUrls = parseFreejavbtExtrafanart($, pageUrl, coverUrl);
  const trailerUrl = parseFreejavbtTrailer($, html);

  if (!title && !genres.length && !actors.length && !coverUrl) {
    return { error: "未找到标题" };
  }

  return {
    fields: {
      title: title || undefined,
      actors,
      genres,
      directors: directors.length ? directors : undefined,
      series: series || undefined,
      studio: studio || undefined,
      publisher: publisher || undefined,
      premiered,
      runtime: runtime && runtime > 0 ? runtime : null,
      website: pageUrl,
      trailerUrl,
    },
    coverUrl,
    extrafanartUrls: extrafanartUrls.length ? extrafanartUrls : undefined,
  };
}

async function scrapeFreejavbtDetail(code: string, signal?: AbortSignal): Promise<ProviderResult> {
  const started = Date.now();
  const site = await prepareProviderFetch("freejavbt", DEFAULT_BASE);
  const base = site.baseUrl;
  if (!base) return { source: "freejavbt", fields: {}, ms: Date.now() - started, error: "未配置网站地址" };
  const std = stdCode(code);
  const slugs = [std];
  const fc2 = std.match(/FC2[-_]?PPV[-_]?(\d+)/i) || std.match(/^FC2[-_]?(\d+)$/i);
  if (fc2) slugs.unshift(`FC2-PPV-${fc2[1]}`, `FC2-${fc2[1]}`);

  for (const slug of [...new Set(slugs)]) {
    for (const path of [
      `/${encodeURIComponent(slug)}`,
      `/zh/${encodeURIComponent(slug)}`,
      `/${encodeURIComponent(slug)}/`,
      `/ja/${encodeURIComponent(slug)}`,
    ]) {
      const url = `${base.replace(/\/$/, "")}${path}`;
      let html: string;
      try {
        html = await fetchText(
          url,
          siteFetchOpts(site, { signal, referer: `${base}/`, timeoutMs: 18000 }),
        );
      } catch {
        continue;
      }
      if (!html || html.length < 800) continue;
      if (
        /あなたは好きかもしれません|你可能喜欢|404|找不到/i.test(html) &&
        !pageMentionsCode(html, std) &&
        !pageMentionsCode(html, slug)
      ) {
        return { source: "freejavbt", fields: {}, ms: Date.now() - started, error: "未找到" };
      }
      if (!pageMentionsCode(html, std) && !pageMentionsCode(html, slug)) continue;

      const parsed = parseFreejavbtDetailHtml(html, std, url);
      if ("error" in parsed) continue;

      const { coverUrl, fields, extrafanartUrls } = parsed;
      if (!fields.title && !coverUrl && !fields.actors?.length) continue;

      return {
        source: "freejavbt",
        fields,
        coverUrl,
        extrafanartUrls,
        ms: Date.now() - started,
      };
    }
  }
  return { source: "freejavbt", fields: {}, ms: Date.now() - started, error: "未找到" };
}

export const freejavbtProvider: ScrapeProvider = {
  id: "freejavbt",
  async scrape(ctx: ScrapeContext): Promise<ProviderResult | null> {
    try {
      return await scrapeFreejavbtDetail(ctx.code, ctx.signal);
    } catch (err) {
      return {
        source: "freejavbt",
        fields: {},
        ms: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
