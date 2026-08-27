import {
  sortProviderCatalogEntries,
  type ProviderCatalogEntry,
  type ProviderGroup,
} from "./catalogTypes.js";

export type MasterSourceEntry = ProviderCatalogEntry;

type Def = Omit<MasterSourceEntry, "probePath" | "implemented" | "tier"> &
  Partial<Pick<MasterSourceEntry, "probePath" | "implemented">> & {
    probeable?: boolean;
  };

function def(d: Def): MasterSourceEntry {
  const probeable = d.probeable ?? Boolean(d.defaultUrl?.trim());
  return {
    probePath: "/",
    implemented: false,
    tier: 1,
    ...d,
    probeable,
  };
}

/**
 * 数据源 catalog（综合站 + 品类枢纽）
 * 2026-08-23：清除单厂/窄前缀站与主站冗余 API/旁路；灰区（carib/mgstage/avsex/javday/njav/miss_av）保留。
 */
export const SOURCE_CATALOG: MasterSourceEntry[] = [
  // —— 有码 AV（综合） ——
  def({ id: "javbus", label: "JavBus", group: "av", defaultUrl: "https://www.javbus.com", access: "proxy_adaptive", defaultCookie: "existmag=all; age=verified; dv=1", implemented: true, mdcx: "javbus" }),
  def({ id: "javdb", label: "JavDB", group: "av", defaultUrl: "https://javdb.com", access: "proxy_flare", defaultCooldownSec: 10, defaultCookie: "over18=1; locale=zh", implemented: true, mdcx: "javdb", notes: "强 CF；批量易超时 · 换出口或稳 Flare" }),
  def({ id: "dmm", label: "DMM", group: "av", defaultUrl: "https://www.dmm.co.jp", access: "proxy_adaptive", defaultCookie: "age_check_done=1; ckcy=1; cklg=ja; is_overseas=0", implemented: true, mdcx: "dmm" }),
  def({ id: "libredmm", label: "LibreDMM", group: "av", defaultUrl: "https://www.libredmm.com", access: "proxy_adaptive", implemented: true, mdcx: "libredmm" }),
  def({ id: "airav", label: "AirAV", group: "av", defaultUrl: "https://www.airav.wiki", access: "proxy_adaptive", implemented: true, notes: "wiki 入口 · 优先委托 airav_io" }),
  def({ id: "airav_io", label: "AirAV.io", group: "av", defaultUrl: "https://airav.io/cn", access: "proxy_adaptive", implemented: true, mdcx: "airav_cc" }),
  def({ id: "avmoo", label: "Avmoo", group: "av", defaultUrl: "https://avmoo.shop", probePath: "/cn", access: "proxy_flare", implemented: true, mdcx: "avmoo", notes: "AIO 家族 · 详情须 Flare 等 SPA 渲染" }),
  def({ id: "jav321", label: "Jav321", group: "av", defaultUrl: "https://www.jav321.com", access: "proxy_adaptive", implemented: true, mdcx: "jav321" }),
  def({
    id: "javlibrary",
    label: "JavLibrary",
    group: "av",
    defaultUrl: "https://www.javlibrary.com",
    probePath: "/cn/vl_searchbyid.php?keyword=SONE-001",
    access: "proxy_adaptive",
    implemented: true,
    mdcx: "javlibrary",
    notes: "仅日本有码 · 镜像 CN 搜索 · adaptive（镜像须 Flare）",
  }),
  def({ id: "avbase", label: "AVBase", group: "av", defaultUrl: "https://www.avbase.net", access: "proxy_adaptive", implemented: true, mdcx: "avbase" }),
  def({ id: "mgstage", label: "MGStage", group: "av", defaultUrl: "https://www.mgstage.com", access: "proxy_adaptive", defaultCookie: "adc=1", implemented: true, mdcx: "mgstage" }),
  def({ id: "freejavbt", label: "FreeJavBT", group: "av", defaultUrl: "https://www.freejavbt.com", access: "proxy_adaptive", implemented: true, mdcx: "freejavbt" }),
  def({ id: "sevenmmtv", label: "7MMTV", group: "av", defaultUrl: "https://7mmtv.sx/zh", access: "proxy_adaptive", implemented: true, mdcx: "7mmtv" }),
  def({ id: "iqqtv", label: "iQQTV", group: "av", defaultUrl: "https://iqq5.xyz/cn", access: "proxy_adaptive", implemented: true, mdcx: "iqqtv" }),
  def({
    id: "avsex",
    label: "AVSex",
    group: "av",
    defaultUrl: "https://avsex.cc",
    probePath: "/tw/search?query=sone-001",
    access: "proxy_flare",
    implemented: true,
    mdcx: "avsex",
    notes: "仅中文元数据；封面/剧照不做（CDN 不稳定）",
  }),
  def({ id: "r18dev", label: "R18.dev", group: "av", defaultUrl: "https://r18.dev", probePath: "/videos/vod/movies/detail/-/dvd_id=sone00001/json", access: "proxy_adaptive", implemented: true, mdcx: "r18dev", notes: "JSON API · 番号补零 · 免 CF" }),

  // —— 综合（跨品类聚合 · 非单一片种） ——
  def({
    id: "javday",
    label: "JavDay",
    group: "general",
    defaultUrl: "https://javday.app",
    access: "proxy_adaptive",
    implemented: true,
    mdcx: "javday",
    notes: "繁中聚合 · 日/无/国产 · URL 去横杠",
  }),
  def({
    id: "miss_av",
    label: "MissAV",
    group: "general",
    defaultUrl: "https://missav123.com",
    probePath: "/cn/sone-001",
    access: "proxy_adaptive",
    implemented: true,
    mdcx: "missav",
    notes: "播放聚合 · 日/无/国产 · 自适应（Flare→curl）",
  }),
  def({
    id: "njav",
    label: "NJAV",
    group: "general",
    defaultUrl: "https://123av.com/ja",
    probePath: "/v/sone-001",
    access: "proxy_adaptive",
    implemented: true,
    mdcx: "njav",
    notes: "123AV（原 njav.tv）· JavSP 搜索链 · 自适应",
  }),
  def({
    id: "lulubar",
    label: "LuluBar",
    group: "general",
    defaultUrl: "https://lulubar.co",
    access: "proxy_adaptive",
    implemented: true,
    mdcx: "lulubar",
    notes: "综合聚合 · 日/无/国产 · /video/bysearch → detail?id",
  }),

  // —— 无码 AV ——
  def({ id: "avsox", label: "AvSox", group: "uncensored", defaultUrl: "https://avsox.click", probePath: "/cn", access: "proxy_flare", implemented: true, mdcx: "avsox" }),
  def({ id: "carib", label: "Caribbean", group: "uncensored", defaultUrl: "https://www.caribbeancom.com", access: "proxy_adaptive", implemented: true, mdcx: "official/carib" }),

  // —— FC2 ——
  def({ id: "fc2_hub", label: "FC2 Hub", group: "fc2", defaultUrl: "https://javten.com", access: "proxy_flare", implemented: true, mdcx: "fc2hub", notes: "封面仅 fancybox；旧片 storage 可能 404，靠多源补图" }),
  def({ id: "fc2", label: "FC2", group: "fc2", defaultUrl: "https://adult.contents.fc2.com", access: "proxy_adaptive", defaultCookie: "adult_check=1", implemented: true, mdcx: "fc2" }),
  def({ id: "fd2ppv", label: "FC2-PPV", group: "fc2", defaultUrl: "https://fd2ppv.cc", access: "proxy_adaptive", implemented: true, mdcx: "fc2ppvdb" }),

  // —— 国产 ——
  def({ id: "madou", label: "Madou", group: "chinese", defaultUrl: "https://madou.club", access: "proxy_adaptive", implemented: true, mdcx: "guochan" }),
  def({ id: "madouqu", label: "Madouqu", group: "chinese", defaultUrl: "https://madouqu.com", access: "proxy_adaptive", implemented: true, mdcx: "madouqu" }),
  def({ id: "xiao_huang_shu", label: "小黄书", group: "chinese", defaultUrl: "https://xchina.co", probePath: "/search.html", access: "proxy_adaptive", implemented: true, notes: "全局代理易 403；详情须 Referer" }),
  def({ id: "hscangku", label: "黄色仓库", group: "chinese", defaultUrl: "http://hsck.net", access: "proxy_adaptive", implemented: true, mdcx: "hscangku" }),

  // —— 欧美 ——
  def({ id: "theporndb", label: "ThePornDB", group: "western", defaultUrl: "https://theporndb.net", access: "proxy_adaptive", implemented: true, needsApiKey: true, mdcx: "theporndb", notes: "REST API · 卡片须填 API Key，否则刮削失败 · 主站 theporndb.net" }),
  def({
    id: "avheat",
    label: "AVHeat",
    group: "western",
    defaultUrl: "https://avheat.shop",
    probePath: "/cn",
    access: "proxy_flare",
    implemented: true,
    mdcx: "avheat",
    notes: "AIO 家族 wav · 识别码 Series.YY.MM.DD · 详情须 Flare",
  }),
];

export const SOURCE_MASTER_LIST = SOURCE_CATALOG;

export function listMasterSourceIds(): string[] {
  return SOURCE_CATALOG.map((e) => e.id);
}

export function getMasterSource(id: string): MasterSourceEntry | undefined {
  return SOURCE_CATALOG.find((e) => e.id === id);
}

export function listCatalogByGroup(group: ProviderGroup): MasterSourceEntry[] {
  return sortProviderCatalogEntries(SOURCE_CATALOG.filter((e) => e.group === group));
}
