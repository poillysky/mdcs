/**
 * みんなのAV（minnano-av.com）演员档案刮削
 * 对齐 references/mdcx-diy/mdcx/tools/minnano_crawler.py
 */
import * as cheerio from "cheerio";
import { fetchText } from "../scrape/network/fetch.js";
import { mapActors } from "../scrape/maps.js";

const BASE = "https://www.minnano-av.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type MinnanoActorInfo = {
  minnanoId: string;
  name: string;
  aliases: string[];
  birthday: string;
  birthplace: string;
  height: string;
  bust: string;
  waist: string;
  hip: string;
  cup: string;
  blood: string;
  agency: string;
  career: string;
  debut: string;
  twitter: string;
  tags: string[];
  overview: string;
  url: string;
};

function parseSize(sizeStr: string): Pick<
  MinnanoActorInfo,
  "height" | "bust" | "waist" | "hip" | "cup"
> {
  const result = { height: "", bust: "", waist: "", hip: "", cup: "" };
  if (!sizeStr) return result;
  for (const part of sizeStr.split(/[ /／]/).map((s) => s.trim()).filter(Boolean)) {
    let m = /^T(\d+)/.exec(part);
    if (m) {
      result.height = m[1]!;
      continue;
    }
    m = /^B(\d+)\((.+?)カップ?\)/.exec(part);
    if (m) {
      result.bust = m[1]!;
      result.cup = m[2]!;
      continue;
    }
    m = /^W(\d+)/.exec(part);
    if (m) {
      result.waist = m[1]!;
      continue;
    }
    m = /^H(\d+)/.exec(part);
    if (m) {
      result.hip = m[1]!;
    }
  }
  return result;
}

function parseBirthday(raw: string): string {
  const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(raw);
  if (!m) return "";
  return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
}

function nameMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  if ([...a].every((c) => b.includes(c))) return true;
  if ([...b].every((c) => a.includes(c))) return true;
  return false;
}

function buildOverview(info: {
  debut: string;
  career: string;
  height: string;
  cup: string;
  agency: string;
}): string {
  const parts: string[] = [];
  if (info.debut) parts.push(`出道作品：${info.debut}`);
  if (info.career) parts.push(`活动期间：${info.career}`);
  if (info.height) parts.push(`身高：${info.height}cm`);
  if (info.cup) parts.push(`罩杯：${info.cup}`);
  if (info.agency) parts.push(`事务所：${info.agency}`);
  return parts.join("\n");
}

function buildTags(info: {
  cup: string;
  height: string;
  bust: string;
  waist: string;
  hip: string;
  career: string;
  pageTags: string[];
}): string[] {
  const tags: string[] = [...info.pageTags];
  if (info.cup) tags.push(`罩杯:${info.cup}`);
  if (info.height) tags.push(`身高:${info.height}cm`);
  if (info.bust || info.waist || info.hip) {
    tags.push(`三围:${[info.bust, info.waist, info.hip].filter(Boolean).join("/")}`);
  }
  if (info.career) {
    tags.push(`生涯:${info.career.replace(/年/g, "").replace(/\s+/g, "").replace(/-/g, "~")}`);
  }
  return [...new Set(tags.filter(Boolean))];
}

export function parseMinnanoPage(html: string, minnanoId: string): MinnanoActorInfo | null {
  const $ = cheerio.load(html);
  let name = "";
  let aliases: string[] = [];
  let birthdayRaw = "";
  let sizeRaw = "";
  let blood = "";
  let place = "";
  let agency = "";
  let career = "";
  let debut = "";
  let blog = "";

  let profileHtml = "";
  $("table").each((_, el) => {
    if (profileHtml) return;
    const rows = $(el).find("tr");
    if (rows.length < 2) return;
    const first = rows.first().find("td,th").first().text();
    if (first.includes("（")) profileHtml = $.html(el) || "";
  });

  if (profileHtml) {
    const $p = cheerio.load(profileHtml);
    const h2 = $p("h2").first().text().trim();
    const nm = /^(.+?)\s+（/.exec(h2);
    if (nm) name = nm[1]!.trim();

    $p("tr").each((_, tr) => {
      const label = $p(tr).find("span").first().text().trim();
      const p = $p(tr).find("p").first();
      if (!label || !p.length) return;
      const value = p.text().replace(/\s+/g, " ").trim();
      if (label === "別名") {
        const alias = value.replace(/\s*（.+）$/, "").trim();
        if (alias) aliases.push(alias);
      } else if (label === "生年月日") birthdayRaw = value;
      else if (label === "サイズ") sizeRaw = value;
      else if (label === "血液型") {
        const m = /([A-Z]+)/.exec(value);
        if (m) blood = `${m[1]}型`;
      } else if (label === "出身地") place = value;
      else if (label === "所属事務所") agency = value;
      else if (label === "AV出演期間") career = value;
      else if (label === "デビュー作品") {
        debut = value.replace(/（\d{4}年\d{1,2}月\s*\d{1,2}日）$/, "").trim();
      } else if (label === "ブログ") blog = value;
    });
  }

  if (!name) {
    const title = $("title").text().trim();
    if (title && !title.includes("みんなのAV")) name = title;
  }

  const pageTags: string[] = [];
  $(".tagarea a").each((_, a) => {
    const t = $(a).text().trim();
    if (t) pageTags.push(t);
  });

  const size = parseSize(sizeRaw);
  const birthday = parseBirthday(birthdayRaw);
  let twitter = "";
  const tw = /twitter\.com\/([^/\s]+)/i.exec(blog);
  if (tw) twitter = tw[1]!;

  const url = `${BASE}/actress${minnanoId}.html`;
  const overview = buildOverview({
    debut,
    career,
    height: size.height,
    cup: size.cup,
    agency,
  });

  return {
    minnanoId,
    name,
    aliases,
    birthday,
    birthplace: place,
    height: size.height,
    bust: size.bust,
    waist: size.waist,
    hip: size.hip,
    cup: size.cup,
    blood,
    agency,
    career,
    debut,
    twitter,
    tags: buildTags({ ...size, career, pageTags }),
    overview,
    url,
  };
}

function actorNameHits(info: MinnanoActorInfo, searchName: string): boolean {
  const keys = [info.name, ...info.aliases].map((s) => s.trim()).filter(Boolean);
  for (const k of keys) {
    if (k === searchName) return true;
    if (nameMatches(searchName, k)) return true;
    if (k.includes(searchName) || searchName.includes(k)) return true;
  }
  return false;
}

function extractMinnanoIdFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  const canon = String($('link[rel="canonical"]').attr("href") || "");
  let m = /actress(\d+)/.exec(canon);
  if (m) return m[1]!;
  const og = String($('meta[property="og:url"]').attr("content") || "");
  m = /actress(\d+)/.exec(og);
  if (m) return m[1]!;
  // 详情页主体里的自链
  const profile = $(".act-profile").html() || "";
  m = /actress(\d+)\.html/.exec(profile);
  if (m) return m[1]!;
  // 页面前部高频 actressID（详情直出时标题区会反复出现）
  const head = html.slice(0, 25000);
  const counts = new Map<string, number>();
  for (const hit of head.matchAll(/actress(\d+)\.html/g)) {
    const id = hit[1]!;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [id, n] of counts) {
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}

function looksLikeProfilePage(html: string): boolean {
  return (
    html.includes("act-profile") &&
    (html.includes("生年月日") || html.includes("サイズ") || html.includes("別名"))
  );
}

async function fetchDetail(
  mid: string,
  expectName: string,
  signal?: AbortSignal,
): Promise<{ id: string; html: string } | null> {
  const detailUrl = `${BASE}/actress${mid}.html`;
  const html = await fetchText(detailUrl, {
    signal,
    referer: `${BASE}/`,
    userAgent: UA,
    access: "proxy_adaptive",
  });
  if (!html) return null;
  if (expectName) {
    const parsed = parseMinnanoPage(html, mid);
    if (parsed && actorNameHits(parsed, expectName)) return { id: mid, html };
    if (!html.includes(expectName)) {
      const $ = cheerio.load(html);
      const title = $("title").text();
      if (!nameMatches(expectName, title) && !title.includes(expectName)) {
        return null;
      }
    }
  }
  return { id: mid, html };
}

/** 搜索并拉取演员详情 */
export async function fetchMinnanoActor(
  actorName: string,
  opts: { signal?: AbortSignal } = {},
): Promise<MinnanoActorInfo | null> {
  const rawName = String(actorName || "").trim();
  if (!rawName) return null;

  // 简中 / 日文映射名都试一遍
  const mappedZh = mapActors([rawName], "zh-CN", true);
  const mappedJa = mapActors([rawName], "ja", true);
  const searchNames = [
    ...new Set(
      [rawName, mappedZh.actors[0], mappedJa.actors[0]].filter(
        (x): x is string => Boolean(x && x.trim()),
      ),
    ),
  ];

  for (const searchName of searchNames) {
    const searchUrl = `${BASE}/search_result.php?search_scope=actress&search_word=${encodeURIComponent(searchName)}&search=+Go+`;
    let html: string;
    try {
      html = await fetchText(searchUrl, {
        signal: opts.signal,
        referer: `${BASE}/`,
        userAgent: UA,
        access: "proxy_adaptive",
      });
    } catch {
      continue;
    }
    if (!html) continue;

    // 站点有时对改名演员直接返回详情页（别名命中）
    if (looksLikeProfilePage(html)) {
      const mid = extractMinnanoIdFromHtml(html);
      if (mid) {
        const parsed = parseMinnanoPage(html, mid);
        if (parsed && actorNameHits(parsed, searchName)) return parsed;
      }
    }

    const $ = cheerio.load(html);
    const candidates: Array<{ id: string; text: string; score: number }> = [];
    const seen = new Set<string>();
    $("a[href]").each((_, a) => {
      const href = String($(a).attr("href") || "");
      const text = $(a).text().trim();
      if (!href.includes("actress") || /ranking|works|list/.test(href)) return;
      const m = /actress(\d+)/.exec(href);
      if (!m || !text) return;
      // 过滤分享按钮文案
      if (/^(ツイート|LINE|Share|共有)/i.test(text)) return;
      const id = m[1]!;
      const key = `${id}:${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      let score = 0;
      if (text === searchName) score += 100;
      else if (nameMatches(searchName, text)) score += 40;
      const parentText = $(a).closest("tr,td,li,div").text();
      if (parentText.includes(searchName)) score += 30;
      candidates.push({ id, text, score });
    });

    candidates.sort((a, b) => b.score - a.score);

    // 先走高分链接
    for (const c of candidates.filter((x) => x.score > 0).slice(0, 8)) {
      try {
        const detail = await fetchDetail(c.id, searchName, opts.signal);
        if (!detail) continue;
        const parsed = parseMinnanoPage(detail.html, detail.id);
        if (parsed && actorNameHits(parsed, searchName)) return parsed;
      } catch {
        /* next */
      }
    }

    // 兜底：按出现次数取前几个 ID，打开详情用别名校验（处理改名）
    const idRank = new Map<string, number>();
    for (const c of candidates) {
      idRank.set(c.id, (idRank.get(c.id) || 0) + 1);
    }
    const topIds = [...idRank.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    for (const id of topIds) {
      if (candidates.some((c) => c.id === id && c.score > 0)) continue;
      try {
        const detail = await fetchDetail(id, searchName, opts.signal);
        if (!detail) continue;
        const parsed = parseMinnanoPage(detail.html, detail.id);
        if (parsed && actorNameHits(parsed, searchName)) return parsed;
      } catch {
        /* next */
      }
    }
  }
  return null;
}
