/** 数据源站点说明（弹窗「说明」Tab） */

export type ProviderGuide = {
  summary: string;
  cover: string;
  fields: string;
  usage: string;
};

const GROUP_FALLBACK: Record<string, ProviderGuide> = {
  av: {
    summary: "日本有码 AV 元数据源。",
    cover: "封面质量与可下载性因站点/CDN 而异。",
    fields: "常见：标题、演员、片商、类型、发行日、时长、封面。",
    usage: "有码片种作为 meta 源之一；封面建议保留 javbus / dmm 作回退。",
  },
  uncensored: {
    summary: "日本无码 AV 元数据源。",
    cover: "多来自官网或聚合站图床。",
    fields: "标题、演员、片商、发行日、封面等。",
    usage: "用于无码 kind；有码番号请勿单独依赖本源。",
  },
  fc2: {
    summary: "FC2 / FC2-PPV 元数据源。",
    cover: "封面常在第三方 CDN，可能需过盾。",
    fields: "标题、简介、封面为主；片商/系列因站而异。",
    usage: "仅用于 FC2 片种；有码请用 AV 组源。",
  },
  chinese: {
    summary: "国产/麻豆等中文内容源。",
    cover: "封面随站点策略变化。",
    fields: "标题、演员、简介、封面等。",
    usage: "用于国产 kind。",
  },
  western: {
    summary: "欧美成人内容元数据源。",
    cover: "封面多来自 API 或官方图床。",
    fields: "标题、演员、简介、评分等。",
    usage: "用于欧美 kind；通常需 API Key。",
  },
  general: {
    summary: "跨品类聚合站（日/无/国产/播放等，非单一片种专源）。",
    cover: "图床因站而异；聚合站封面稳定性参差。",
    fields: "常见中文 title/plot、演员、类型、封面；片商/系列/时长视站点。",
    usage: "按片种手动加入源链作补充；勿作唯一 meta/cover 源。",
  },
};

/** 按 sourceId 的说明；未列出的走分组默认 */
export const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  dmm: {
    summary: "日本有码官方级元数据（FANZA/DMM）。日文标题与片商信息权威。",
    cover: "DMM 高清封面（pl）质量高，下载一般稳定。",
    fields: "标题、简介、演员、片商、系列、发行日、时长、封面、剧照、预告等；评分视接口。",
    usage: "有码 meta / cover 主力。与 javbus 搭配：dmm 图、javbus 补中文或磁力无关字段。",
  },
  javbus: {
    summary: "日本有码综合站，字段齐、覆盖广。",
    cover: "封面多为 DMM CDN，本环境通常可下。",
    fields: "标题、演员、片商、类型、发行日、时长、封面、磁力页信息等。",
    usage: "有码默认 meta/cover 核心源；适合作为封面回退。",
  },
  javdb: {
    summary: "日本有码综合站，评分/想看数据较全。",
    cover: "jdbstatic CDN，需正确 Referer；偶发过盾。",
    fields: "标题、演员、片商、类型、评分、投票、发行日、封面、剧照等。",
    usage: "补 rating/votes；连接为过盾，勿作唯一源。",
  },
  libredmm: {
    summary: "DMM 公开镜像/补充 JSON，有码元数据。",
    cover: "封面常指向 DMM 图，可作 dmm 补充。",
    fields: "标题、演员、片商、发行日、时长、简介、封面等。",
    usage: "dmm 不可用时的有码备份；高清封面仍优先 dmm。",
  },
  jav321: {
    summary: "日本有码轻量站，部分页字段精简。",
    cover: "多为 DMM 图；部分条目无完整演员列表。",
    fields: "标题、发行日、封面为主；演员/类型视页面完整度。",
    usage: "有码补充源；勿单独依赖完整 NFO。",
  },
  freejavbt: {
    summary: "日本有码聚合，中文标题友好。",
    cover: "部分图床需 Referer；剧照偶发 403。",
    fields: "标题、演员、片商、类型、发行日、封面、剧照等。",
    usage: "有码 meta 补充；封面仍建议 javbus/dmm。",
  },
  iqqtv: {
    summary: "中文标题/简介优先的有码源，多镜像跳转。",
    cover: "封面质量一般，可作备选。",
    fields: "中文标题、简介、演员、类型、发行日、封面等。",
    usage: "titleZh / plot 中文优先链；勿作唯一封面源。",
  },
  airav: {
    summary: "AirAV wiki 入口；实际常委托 airav.io 镜像链。",
    cover: "封面随 airav_io 镜像。",
    fields: "中文标题、简介、演员、类型、发行日、封面等。",
    usage: "与 airav_io 同类，作中文元数据补充。",
  },
  airav_io: {
    summary: "AirAV 中文元数据；官方常跳临时镜像。",
    cover: "镜像站封面，稳定性看出口。",
    fields: "中文标题、简介、演员、类型、发行日、封面等。",
    usage: "中文 plot/title 补充；需代理+自适应过盾。",
  },
  sevenmmtv: {
    summary: "有码为主的综合站，字段较全。",
    cover: "封面一般可下。",
    fields: "标题、简介、演员、类型、片商、发行日、时长、封面等。",
    usage: "有码 meta 补充；自适应连接。",
  },
  avbase: {
    summary: "有码数据库（Next.js）；FANZA product 字段丰富。",
    cover: "多为 DMM 图，可下；剧照齐全。",
    fields: "标题、简介、演员、类型、片商、系列、发行日、时长、导演、封面、剧照、预告；无评分。",
    usage: "有码完整字段补充；SONE 等番号直链可用。",
  },
  mgstage: {
    summary: "MGS/Prestige 系有码官网（ABP、SIRO、300MIUM 等）。",
    cover: "官网图床，本环境可下。",
    fields: "标题、简介、演员、类型、片商、系列、发行日、时长、评分、投票、封面、剧照；无导演；预告 API 不稳。",
    usage: "仅 MGS 系番号；SONE 等 DMM 独占勿用本源。需 Cookie adc=1。",
  },
  avsex: {
    summary: "繁中标题/剧情优先的有码元数据源（需 Flare）。",
    cover: "不做封面。CDN（image.avsex.cc）长期 CF/403，不稳定，项目不将本源用于封面下载。",
    fields: "中文标题、简介、演员、类型、片商、上架日、时长；可解析封面/剧照 URL 但不下载。无评分/系列/导演。",
    usage: "仅作中文 meta（titleZh / plot）。封面与剧照请用 javbus / dmm 等稳定源，勿把 avsex 放进 cover 优先序。",
  },
  r18dev: {
    summary: "R18.dev JSON API，有码结构化数据。",
    cover: "封面稳定，剧照可批量下。",
    fields: "标题、演员、片商、类型、发行日、时长、封面、剧照、预告等。",
    usage: "有码可靠补充；免 CF，适合自动化。",
  },
  avmoo: {
    summary: "有码 AIO 目录站（Quasar SPA，须过盾）。",
    cover: "原图床 jp.netcdn.space（直连 curl + Referer）；失败时回退 pics.dmm.co.jp。",
    fields: "标题、演员、类型、片商/发行商/系列、导演、发行日、时长、封面、样品图。无简介/评分/预告。",
    usage: "有码补充；须 FlareSolverr。详情页 SPA 需等渲染。",
  },
  javday: {
    summary: "繁中播放聚合（日/无/国产多品类）。",
    cover: "本站 upload/vod 图床，一般可下。",
    fields: "中文标题、简介、演员、类型、封面；无片商/系列/时长/评分。",
    usage: "综合组；各 kind 可手动加入源链补中文 meta。自适应网络（代理→Flare）；URL 去横杠。",
  },
  javlibrary: {
    summary: "老牌日本有码资料站（MDCX：仅能有码）。",
    cover: "站内 jacket 图；可配合 DMM 高清回退。",
    fields: "标题(JA+CN)、演员、类型、片商、发行、导演、发行日、时长、评分、想看；无简介/剧照。",
    usage: "有码 meta 补充；须 FlareSolverr。搜索走 /ja/vl_searchbyid.php。",
  },
  miss_av: {
    summary: "MissAV 繁中播放聚合（日/无/国产多品类）。",
    cover: "fourhoi CDN 封面，本环境可下；域名易变。",
    fields: "中文标题、日文原标题、简介、女优、类型、片商、系列、导演、发行日、时长、封面。",
    usage: "综合组；各 kind 可手动加入源链补中文 meta。自适应（冷启动 Flare，复用后 curl 直链）。勿作唯一封面源。",
  },
  njav: {
    summary: "NJAV / 123AV 播放聚合（日/无/FC2 多品类，原 njav.tv 已迁 123av.com）。",
    cover: "icdn.123av.me 封面；须 Referer=详情页。",
    fields: "日文标题、出演者、ジャンル、メーカー、シリーズ、発売日、再生時間、封面。",
    usage: "综合组；对齐 JavSP 搜索链。自适应（Flare→curl）。勿作唯一 meta/cover 源。",
  },
  xiao_huang_shu: {
    summary: "小黄书 xChina：国产影片/套图聚合，搜索 HTML + 详情 JSON-LD。",
    cover: "upload.xchina.io 图床；本环境直连可下，走全局代理易 403。",
    fields: "标题、演员、片商、发行日、时长、封面；无剧情简介。",
    usage: "国产 kind 补充源。卡片代理填 null 直连；详情页须带搜索 Referer。",
  },
  carib: {
    summary: "加勒比等无码官网系。",
    cover: "官网图一般可下。",
    fields: "标题、演员、发行日、时长、封面等。",
    usage: "仅无码 kind / CARIB 等番号。",
  },
  avsox: {
    summary: "日本无码 AIO 目录（与 Avmoo 同族 Quasar SPA）。",
    cover: "file.netcdn.space 图床；加勒比等为 caribbeancom 路径。",
    fields: "中文标题/类型、演员、片商、系列、发行日、时长、封面；无 plot/评分。",
    usage: "无码 kind 补充 meta/cover；须 Flare。CARIB 等番号自动去前缀搜索；勿用 SONE 等有码样例。",
  },
  theporndb: {
    summary: "欧美元数据 API（ThePornDB）。",
    cover: "API 返回图，需有效 Key。",
    fields: "标题、演员、简介、发行日、封面等。",
    usage: "欧美 kind；必须在「参数」填 API Key。",
  },
};

export function getProviderGuide(
  id: string,
  group?: string,
  catalogNotes?: string,
): ProviderGuide {
  const specific = PROVIDER_GUIDES[id];
  if (specific) return specific;
  const base = GROUP_FALLBACK[group || ""] || GROUP_FALLBACK.av;
  if (!catalogNotes?.trim()) return base;
  return {
    ...base,
    summary: `${base.summary}\n\n${catalogNotes.trim()}`,
  };
}
