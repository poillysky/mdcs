# DMM — 测试记录

> UI 卡片顺序：**#3 有码 AV 组**（javbus → javdb → **dmm**）  
> 最后实测：2026-08-23 19:00 (UTC+8)（完整报告 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 完整报告（19:00 复跑）

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **17/17** | dmm + dmmCid + dmmTrailer · 352ms |
| 测通 | ✅ **399ms** | `probeVia: api` · GraphQL 200 |
| Live + E2E | ✅ 全过 | 刮削+封面+NFO+水印 · 总 ~4s |
| 封面 | ✅ **909847 B** | pl 高清 |
| 海报 | ✅ **296255 B** | censored 水印 |
| NFO | ✅ **requiredOk** | 采集 31 · 必过 31/31 · 仅 **votes** 未采集 |

报告：`media/片商目录/日本有码/SONE/SONE-001/_scrap/dmm/organized/e2e-report.json`

---

## 2026-08-23 逐站复测报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|-------|
| 爬虫 | `dmm_new/*` GraphQL `ppvContent` | ✅ `dmm.ts` |
| 单测 | `test_dmm_api.py` · `test_dmm_direct.py` · `test_dmm_trailer_url.py` | ✅ `dmm.test.ts` + `dmmCid` + `dmmTrailer` **17/17** |
| CID | `generate_cid_candidates` | ✅ `dmmCid.ts` |
| trailer | `sample2DMovie` + freepv | ✅ `dmmTrailer.ts` |
| 评分 | `reviewSummary.average` | ✅ rating/criticrating |
| votes | 未查 reviewerCount | ✗ 仍缺（与 2026-08-22 一致） |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **17/17** | GraphQL 解析 · CID · trailer |
| 测通 | ✅ **408ms** | `probeVia: api` · GraphQL 200 |
| Live 刮削 | ✅ **399ms** | SONE-001 字段齐 |
| E2E | ✅ 全过 | 封面 **909847B** · 海报 296255B · NFO **31/31** |

### 字段采集（SONE-001）

- **刮削**：29/30（仅 **votes** 未采集）
- **NFO 写入**：已采集项全部通过
- **多采集**：plot / director / website / trailer / rating（相对 javbus）

### 2026-08-23 NFO/设置对齐复验

| 项 | 结果 |
|----|------|
| NFO originaltitle | ✅ `SONE-001` + 日文标题（MDCX 前缀） |
| NFO originalplot | ✅ 与 plot 同文（DMM 日文简介） |
| 目录 | ✅ `SONE/SONE-001`（全局 `{series_name}/{number}`） |
| E2E 报告 | ✅ `requiredOk: true` · 采集 **31/31** · NFO 必过全绿 |

> 单源 DMM 的 `<title>` 为日文（无 titleZh）；生产多源 merge 后由 airav/iqqtv 提供中文 title。

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `dmm` |
| 分组 | AV |
| 连接方式 | `proxy` + **GraphQL API** |
| 默认 URL | https://www.dmm.co.jp |
| 探针 URL | https://api.video.dmm.co.jp/graphql |
| Cookie | `age_check_done=1; ckcy=1; cklg=ja; is_overseas=0`（对 SPA 首页无效） |
| Provider | `apps/server/src/scrape/providers/dmm.ts` |
| 实现状态 | ✅ 已实现（对齐 MDCX `dmm_new`） |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 全局代理 HTTP |
| 取数 | `POST api.video.dmm.co.jp/graphql` → `ppvContent(id)` |
| CID | 番号猜测 `sone00001` 等（`dmmCid.ts`） |
| 封面 | GraphQL `packageImage.largeUrl` 或 CDN 探测 `pics_dig/.../pl.jpg` |
| 测通 | **勿**只打 dmm.co.jp 营销首页；打 GraphQL 轻量 query |
| 八项目参考 | **MDCX dmm_new**（优于色花/JavSP 旧 HTML） |

详见 [SOURCE-CATALOG-8REF.md](../SOURCE-CATALOG-8REF.md)

---

## 水印配置（E2E 用）

同全局：`config/scrape.json` → `watermark.markCensored: true`

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `japan_censored` |
| 番号 | **SONE-001** |
| 索引 strm | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |

```powershell
npx tsx scripts/e2e-sone-source.ts --id=dmm
npx tsx scripts/probe-one.ts dmm
```

---

## 测通 L1（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **405ms** |
| HTTP | 200 |
| 通道 | `probeVia: api`（GraphQL） |
| 解析 URL | https://api.video.dmm.co.jp |
| 说明 | 与刮削同路；非年龄门 HTML |

---

## 刮削（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **388ms** |
| 标题 | エロめっちゃ可愛い三田真鈴の初・体・験3本番 人生初めて尽くし！ 激イキしまくりスペシャル！ |
| 片商 | エスワン ナンバーワンスタイル |
| 系列 | 初体験○本番スペシャル |
| 演员 | 三田真鈴 |
| 标签 | 巨乳, おもちゃ, 3P・4P, 単体作品, 独占配信, 4K |
| 封面 URL | https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/sone00001/sone00001pl.jpg |
| 导演 | 嵐山みちる（GraphQL `directors`） |
| 简介 | GraphQL `description`（日文） |
| 官网 | `https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=sone00001/` |

---

## 字段采集（2026-08-22 — nfo.include 范围）

单源 **SONE-001**，刮削可采集 **25/30**（生成器推导项另计 8 项）。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, originaltitle, sorttitle, num, **plot, outline, originalplot**, premiered, actor, **director**, runtime, **rating, ratings(dmm), criticrating**, series, studio, tag, genre, poster, thumb, cover, **trailer**, **website** 等 |
| ✗ **未采集** | **votes**（GraphQL 未查 reviewerCount） |
| ○ 生成器推导 | uniqueid, source, tagline, countrycode, mpaa, customrating, year, fanart |

**未采集原因**

| 字段 | 说明 |
|------|------|
| votes | `reviewSummary` 仅查 `average`，评论人数字段待补 |

**2026-08-22 补全**（对齐 MDCX GraphQL）：

- `sample2DMovie` / `sampleVRMovie` → **trailer**（SONE-001：`.../sone00001_4k_w.mp4`）
- `reviewSummary.average` → **rating 8.8** / **criticrating 88** / 嵌套 `<ratings name="dmm">`

NFO 写入：已采集 **31/31** 必过项全部写入 ✅（**29/30** 刮削字段，仅 votes 空）

**相对 JavBus 多采集**：plot / director / website / trailer / rating（+9）

---

## 端到端 E2E

### 2026-08-22 — 字段清单 + 水印（最新）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | 364ms · GraphQL |
| 2. 封面 | ✅ | **909847 bytes**（pl 高清） |
| 3. 整理/转移 | ✅ | skip |
| 4. 海报+水印 | ✅ | censored · 296255 bytes · thumb.jpg |
| 5. NFO | ✅ | 27/27 已采集项全写入 |

### 2026-08-22 — 初测（markCensored=true）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | 388ms · GraphQL |
| 2. 封面下载 | ✅ | **909847 bytes**（DMM 高清 pl） |
| 3. 整理计划 | ✅ | `{category}/{studio}/{series_name}/{number}` |
| 4. 文件转移 | ✅ | skip |
| 5. NFO | ✅ | title/num/studio/actor/premiered/poster 齐全 |
| 6. 海报 | ✅ | 右侧裁剪 **296255 bytes** |
| 7. 水印 | ✅ | **`labels: censored`** |

**命名路径**

```
日本有码/エスワン ナンバーワンスタイル/SONE/SONE-001/SONE-001.strm
```

**输出目录**

```
media/片商目录/日本有码/SONE/SONE-001/_scrap/dmm/organized/
```

**机器报告**

```
media/片商目录/日本有码/SONE/SONE-001/_scrap/dmm/organized/e2e-report.json
```

---

## 与 JavBus 对比（同片 SONE-001）

| 项 | DMM | JavBus |
|----|-----|--------|
| 字段采集 | **29/30** | 19/30 |
| 刮削耗时 | 364ms | 503ms |
| 封面大小 | **~910KB** | ~174KB |
| 海报（含水印） | 296255 B | 44098 B |
| plot/outline/director/website | ✅ | ✗ |
| trailer/rating | ✅ DMM 自带 | ✗ |
| 取数通道 | GraphQL | HTML |

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 测通 | ✅ |
| 刮削 | ✅ |
| 端到端 | ✅ **全通过（含水印 censored）** |
| 生产可用 | ✅ 推荐作有码元数据/高清封面源 |

---

## 已知问题

- ~~`ppvContent.sampleMovie` 预告片子字段待补~~ → 已用 `sample2DMovie` + freepv 兜底（2026-08-22）。
- `scrape.json` 的 `japan_censored` meta/cover 源序尚未默认包含 `dmm`（可按需加入 fieldPriority / kindProfiles）。
- 部分番号 CID 猜测可能命中错误条目，需后续增强 CID 消歧。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-23 19:00 | 完整报告复跑：L1 17/17 · 测通 399ms · E2E 全过 · votes 仍缺 |
| 2026-08-23 15:10 | 逐站复测 SONE-001：L1 17/17 · 测通 408ms · E2E 全过 · votes 仍缺 |
| 2026-08-22 | GraphQL 补 trailer + reviewSummary 评分 → **29/30** 字段 |
| 2026-08-22 | SONE-001 E2E 全通过；GraphQL 测通；水印 censored ✅ |
