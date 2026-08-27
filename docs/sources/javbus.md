# JavBus — 测试记录

> UI 卡片顺序：**有码 AV 组 · 第 2 行第 2 卡**（Jav321 → **JavBus** → LibreDMM）  
> 最后实测：2026-08-23 22:56 (UTC+8)（完整报告 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 完整报告（22:56 复跑）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **5/5** | 597ms |
| 测通 | ✅ **498ms** | `probeVia: direct` |
| Live + E2E | ✅ 全过 | 刮削 ~0.5s · 总 ~5.5s |
| 封面 | ✅ **173806 B** | javbus pics/cover |
| 海报 | ✅ **44098 B** | censored |
| NFO | ✅ **23/23** 必过 | 刮削 **21/30** |

报告：`media/片商目录/日本有码/SONE/SONE-001/_scrap/javbus/organized/e2e-report.json`

### 字段亮点（SONE-001）

- **actor / director / genre / series / studio / runtime** 齐全
- **premiered** 2023-12-12 · **publisher/label** 有
- **未采集**：plot / rating / trailer / website（站点不提供）

### 结论

**生产可用 ✅** — 百科级元数据补充源；简介/评分/预告需 dmm/javdb 补。本轮无代码修复。

---

## 2026-08-23 逐站复测报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|-------|
| 爬虫 | `javbus.py` / `test_javbus_new.py` | ✅ `javbus.ts` |
| 详情字段 | title/actor/genre/studio/series/director/runtime | ✅ `parseJavbusDetailHtml` |
| 发行日 | `getValidRelease` | ✅ `normalizeJavbusPremiered` |
| L1 单测 | FakeClient 详情页 | ✅ **5/5** |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **5/5** | 详情映射 · 日期规范化 |
| 测通 | ✅ **486ms** | direct · javbus.com |
| Live 刮削 | ✅ **509ms** | SONE-001 |
| E2E | ✅ 全过 | 封面 **174KB** · NFO **23/23** |

### 字段采集（SONE-001）

- **刮削**：**21/30**
- **NFO 写入**：已采集项全部通过
- **强项**：actor / director / genre / series / studio / runtime
- **未采集**：plot / rating / trailer / website（JavBus 页不提供）

### 结论

**生产可用 ✅** — 百科级元数据补充源；简介/评分/预告需 dmm/javdb 补。本轮无代码修复。

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `javbus` |
| 分组 | AV |
| 连接方式 | `proxy` |
| 默认 URL | https://www.javbus.com |
| Cookie | `existmag=all; age=verified; dv=1` |
| Provider | `apps/server/src/scrape/providers/javbus.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 全局代理 HTTP，不默认 Flare |
| 取数 | `GET {base}/{CODE}` → regex 标题/封面/女优 + cheerio 片商/标签 |
| 封面 | 详情页 `pics/cover/*`；下载需 javbus Cookie |
| 八项目参考 | 色花主参考 · javbus-api（REST 网关可选） |

详见 [SOURCE-CATALOG-8REF.md](../SOURCE-CATALOG-8REF.md#javbus)

---

## 水印配置（E2E 用）

`config/scrape.json` → `watermark.markCensored: true`（2026-08-22 开启）

| 项 | 值 |
|----|-----|
| enabled | true |
| markCensored | **true** |
| markUncensored / markSubtitle / markResolution | true |
| applyPoster | true |
| posterCrop | right（japan_censored kind） |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `japan_censored` |
| 番号 | **SONE-001** |
| 索引 strm | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |

```powershell
npx tsx scripts/e2e-sone-source.ts --id=javbus
```

---

## 测通 L1（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **477ms** |
| HTTP | 200 |
| 通道 | `probeVia: direct`（proxy + cookie-direct） |
| 解析 URL | https://www.javbus.com |
| 说明 | 与刮削同路；非 CF 挑战页 |

```powershell
npx tsx scripts/probe-one.ts javbus
```

---

## 刮削（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **500ms** |
| 标题 | エロめっちゃ可愛い三田真鈴の初・体・験3本番 人生初めて尽くし！ 激イキしまくりスペシャル！ |
| 片商 | エスワン ナンバーワンスタイル |
| 系列 | 初体験○本番スペシャル |
| 演员 | 三田真鈴 |
| 标签 | 玩具, 多P, 高畫質, 巨乳, 單體作品, 4K |
| 封面 URL | https://www.javbus.com/pics/cover/a4d3_b.jpg |

---

## 字段采集（2026-08-22 — nfo.include 范围）

单源 **SONE-001**，刮削可采集 **19/30**（生成器推导项另计 8 项）。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, originaltitle, sorttitle, num, premiered, releasedate, release, actor, runtime, series, studio, maker, publisher, label, tag, genre, poster, thumb, cover |
| ✗ **未采集** | **plot, outline, originalplot, director, rating, ratings(javdb), criticrating, votes, trailer, website** |
| ○ 生成器推导 | uniqueid, source, tagline, countrycode, mpaa, customrating, year, fanart |

**未采集原因（站点侧）**

| 字段 | 说明 |
|------|------|
| plot / outline / originalplot | JavBus 详情页无 og:description / 简介块（日文标题页） |
| director | 页面不提供导演链接 |
| rating / ratings / criticrating / votes | 无评分 |
| set | 由 `series` + `seriesSet` 配置写入 `<set>`（NFO 已有） |
| trailer / website | 无预告片 / 官网链接 |

NFO 写入：已采集 **21/21** 必过项全部写入 ✅

---

## 端到端 E2E

### 2026-08-22 — 字段清单 + 水印（最新）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | 503ms |
| 2. 封面 | ✅ | 173806 bytes |
| 3. 整理/转移 | ✅ | skip |
| 4. 海报+水印 | ✅ | censored · 44098 bytes · thumb.jpg |
| 5. NFO | ✅ | 已采集项全写入；见上「字段采集」 |

### 2026-08-22 — 水印重测（markCensored=true）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | 444ms |
| 2. 封面下载 | ✅ | 173806 bytes |
| 3. 整理计划 | ✅ | 同下 |
| 4. 文件转移 | ✅ | skip |
| 5. NFO | ✅ | 六项齐全 |
| 6. 海报 | ✅ | 右侧裁剪 **44098 bytes** |
| 7. 水印 | ✅ | **`labels: censored`**（有码角标已绘制） |

### 2026-08-22 — 初测（markCensored=false）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | 500ms |
| 2. 封面下载 | ✅ | 173806 bytes → `data/covers/japan_censored/SONE-001.jpg` |
| 3. 整理计划 | ✅ | `{category}/{studio}/{series_name}/{number}` |
| 4. 文件转移 | ✅ | skip（目标已是同一 hardlink） |
| 5. NFO | ✅ | title/num/studio/actor/premiered/poster 齐全 |
| 6. 海报 | ✅ | 右侧裁剪 53443 bytes |
| 7. 水印 | ⚠️ | enabled 但未出角标（当时 markCensored=false） |

**命名路径**

```
日本有码/エスワン ナンバーワンスタイル/SONE/SONE-001/SONE-001.strm
```

**输出目录（隔离，不覆盖 mdc）**

```
media/片商目录/日本有码/SONE/SONE-001/_scrap/javbus/organized/
```

**机器报告**

```
media/片商目录/日本有码/SONE/SONE-001/_scrap/javbus/organized/e2e-report.json
```

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 测通 | ✅ |
| 刮削 | ✅ |
| 端到端 | ✅ **全通过（含水印 censored）** |
| 生产可用 | ✅ 推荐作有码主源 / 封面优先源 |

---

## 已知问题

- 镜像域名变更时需 UI 更新或走 `rememberSiteMirror` 缓存。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-23 | 逐站复测 SONE-001：L1 5/5 · 测通 486ms · E2E 21/30 · NFO 23/23 |
| 2026-08-22 | **L1 单测** `javbus.test.ts`：移植 MDCX `test_javbus_new.py` fixture；解析增 director · href 兜底 · 发行日 ISO |
| 2026-08-22 | 字段缺口清单：19/30 采集；plot/director/rating/trailer/website 未采集 |
| 2026-08-22 | 水印重测：`markCensored=true` → poster 角标 **censored** ✅ |
| 2026-08-22 | 首测：SONE-001 E2E 全通过；L1 测通通过 |
