# AVSex — 测试记录

> UI 卡片：**T2 有码 AV 组** · `proxy_flare`  
> 最后实测：2026-08-22 17:20 (UTC+8)

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `avsex` |
| 分组 | AV（T2） |
| 连接方式 | `proxy_flare` |
| 默认 URL | https://avsex.cc |
| Provider | `apps/server/src/scrape/providers/avsex.ts` |
| 实现状态 | ✅ 已实现 |
| MDCX 参考 | `references/mdcx-diy/mdcx/crawlers/avsex.py` |

## MDCX 对照（先分析再测 — 2026-08-22）

| 项 | MDCX | MDCS |
|----|------|-------|
| 搜索 | `/tw/search?query={lower}` | ✅ 同 |
| thumb | 详情 `-2.jpg` 横版 | ✅ `coverUrl` |
| poster | 搜索 `-1.jpg` 竖版 | ✅ `alternateCoverUrls` |
| `image_download` | `False`（刮削不下图） | 刮削后 `downloadCover` |
| poster 合并 | `poster_website` 含 avsex | `coverSources` 含 avsex（非 cover 优先第一） |
| studio | `studio_website_exclude: avsex` | ✅ fieldPriority.studio 无 avsex |
| 剧照 | `extrafanart_website_exclude` | 解析有，NFO 未写 |
| 图片下载 | `async_client` 遇 CF 自动 bypass | `coverDownload.ts` 暖站+curl+CDN 过盾；**当前环境 CDN 仍 403/挑战页** |
| 测通 | 无 SPECIAL_CHECK_PATHS（默认首页） | 搜索页 + 冷启动补 session create |

**封面结论**：MDCX 无 avsex Referer 特判；靠**通用 HTTP 客户端 CF bypass**。MDCS 已实现同语义链路（`coverDownload.ts`），但 `image.avsex.cc` 在本环境 Flare+curl 仍拿不到 JPEG（FS 返回 446B 挑战页）。**单源 E2E 封面可能失败**；有码 kind 应保留 javbus/jav321 作 cover 回退。

---

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | FlareSolverr 过盾 |
| 测通 | `GET /tw/search?query=sone-001`（与刮削同路，优于首页 `/`） |
| 搜索 | `GET /tw/search?query={code.lower()}` |
| 详情 | 搜索命中 `/tw/video/detail/{id}` |
| 解析 | cheerio · `h1.sr-only` 标题 · `dl dt/dd` 元数据 · 劇情簡介 |
| 封面 | og:image / video poster / 搜索页 poster 兜底 |
| 双语 | 站点繁中为主；`title` 与 `titleZh` 同源（中文标题） |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `japan_censored` |
| 番号 | **SONE-001** |
| 索引 strm | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |

```powershell
cd e:\MDCS\apps\server
npx tsx scripts/probe-one.ts avsex
npx tsx scripts/_debug-avsex-scrape.ts
npx tsx scripts/e2e-sone-source.ts --id=avsex
```

---

## L1 单测（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ **11/11** |
| Fixture | `data/_debug/avsex-search-proxy_flare.html` · `avsex-detail-364579-proxy_flare.html` |
| 覆盖 | 番号规范化 · 搜索命中 · 标题/简介/详情字段 · mosaic · extrafanart |

```powershell
node --import tsx --test src/scrape/providers/avsex.test.ts
```

---

## 刮削 live（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **13060ms**（搜索 + 详情，Flare 冷启动） |
| 标题 | 色情又可愛的三田真鈴人生初體驗：極度激昂的特別獻身！ |
| 片商 | エスワン ナンバーワンスタイル |
| 演员 | 三田真鈴 |
| 发行日 | 2023-12-11 · 时长 153min |
| 简介 | ✅ 中文剧情（劇情簡介） |
| 封面 | URL 可解析；**下载**见 MDCX 对照（CDN CF，单源或需 javbus 回退） |
| mosaic | 有码 |

## E2E（2026-08-22）

| 项 | 结果 |
|----|------|
| 刮削 | ✅ 16138ms · 20/30 字段 |
| 转移 | ✅ hardlink |
| 封面/海报 | ⚠️ CDN CF 未通（见 MDCX 对照）；多源 cover 时 javbus 可补 |
| NFO | 19/22 必过（缺 local poster/thumb） |
| 报告 | `media/片商目录/日本有码/SONE/SONE-001/_scrap/avsex/organized/` |

---

## 字段能力（SONE-001）

| 字段 | 采集 | 说明 |
|------|------|------|
| title / titleZh | ✅ | 去番号前缀 + VIP 标记清洗 |
| plot | ✅ | 劇情簡介 |
| actors | ✅ | dl 演員 |
| genres | ✅ | dl 標籤 |
| studio | ✅ | dl 製作商 |
| premiered | ✅ | dl 上架日 |
| runtime | ✅ | HH:MM:SS → 分钟 |
| cover | ✅ | og / video poster |
| website | ✅ | 详情 URL |
| mosaic | ✅ | article 区 badge；默认有码 |
| score / trailer / directors / series | ❌ | 站点无 |
| extrafanart | 解析导出 | L1 有测；MDCS 管线暂未写入 NFO |

---

## 已知限制

- **测通**：需 Flare；冷启动 ~3–6s，刮削双请求 ~13s。
- **搜索语言**：固定 `/tw/search`（对齐 MDCX）。
- **封面下载**：`coverDownload.ts` 对齐 MDCX bypass 语义；本环境 CDN 仍挑战页，**cover 优先序勿只留 avsex**。
- **thumb/poster**：`-2` 主封面 + `-1` 候选（`alternateCoverUrls`）。
- **MDCX 差异**：新站 DOM 无 `bg-blue-800` mosaic 徽章，改读 `article h2` badge。

---

## 八项目参考

详见 [SOURCE-CATALOG-8REF.md](../SOURCE-CATALOG-8REF.md) · [SOURCE-MASTER-LIST.md](../SOURCE-MASTER-LIST.md#tier-2)
