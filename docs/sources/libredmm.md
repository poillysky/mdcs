# LibreDMM — 测试记录

> UI 卡片顺序：**#4 有码 AV 组**（javbus → javdb → dmm → **libredmm**）  
> 最后实测：2026-08-23 23:00 (UTC+8)（完整报告 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 完整报告（23:00 复跑）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ⚠️ 无专用文件 | E2E 覆盖 parseHit |
| 测通 | ✅ **508ms** | `probeVia: direct` |
| Live + E2E | ✅ 全过 | 刮削 ~0.5s · 总 ~5.7s |
| 封面 | ✅ **145808 B** | outlet `77sone001` mono pl |
| 海报 | ✅ **41949 B** | censored |
| NFO | ✅ **21/21** 必过 | 刮削 **19/30** |

报告：`media/片商目录/日本有码/SONE/SONE-001/_scrap/libredmm/organized/e2e-report.json`

### ⚠️ 条目说明

SONE-001 命中 **アウトレット** 再贩条目（`77sone001`），标题含プレコレ/アウトレット — 源站索引策略，非 MDCS bug。正式 digital 以 **dmm/javbus** 为准。

### 结论

**生产可用 ✅** — 补充元数据源；高清封面/正式条目优先 dmm。本轮无代码修复。

---

## 2026-08-23 逐站复测报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|-------|
| 取数 | HTML 详情页 XPath | **JSON API** `/movies/{CODE}.json`（色花路径） |
| processing 重试 | 有 | ✅ 最多 5 次 |
| 封面 | AWS 候选 + 页面 img | JSON `cover_image_url` · ps→pl |
| 导演/评分/样图 | HTML 有 | JSON 源通常无 |
| 简介兜底 | JavDB API | 未接（JSON 自带 description） |
| L1 单测 | `test_libredmm.py`（AWS 候选 helper） | ⚠️ 尚无 `libredmm.test.ts`（E2E 已验 parseHit） |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ⚠️ 无专用文件 | MDCX helper 未移植；功能由 E2E 覆盖 |
| 测通 | ✅ **480ms** | `probeVia: direct` |
| Live 刮削 | ✅ **424ms** | SONE-001 |
| E2E | ✅ 全过 | 封面 **145808B** · hardlink · NFO **21/21** |

### 字段采集（SONE-001）

- **刮削**：**19/30**
- **NFO 写入**：已采集项全部通过
- **未采集**：director / runtime / series / rating / trailer / website 等（JSON/API 不提供或 outlet 条目无值）

### ⚠️ 条目说明（站点数据）

LibreDMM 对 SONE-001 命中 **アウトレット（再贩）** 条目，封面为 `77sone001` mono 线，非 DMM digital `sone00001` —— 属源站索引策略，非 MDCS bug。

### 结论

**生产可用 ✅** — 作 DMM 镜像/补充元数据源；高清封面优先仍建议 **dmm** 或 **javbus**。本轮无代码修复。

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `libredmm` |
| 分组 | AV |
| 连接方式 | `proxy` |
| 默认 URL | https://www.libredmm.com |
| Provider | `apps/server/src/scrape/providers/libredmm.ts` |
| 实现状态 | ✅ 已实现（MDCS / 色花独有 JSON 源） |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 全局代理 HTTP |
| 取数 | `GET /movies/{CODE}.json`；失败则 `/search.json?q=` |
| 封面 | JSON `cover_image_url`；`ps.jpg` 自动升 `pl.jpg` |
| 字段 | title / plot / actors / genres / studio / label / premiered |
| 八项目参考 | 色花 · mdcx |

详见 [SOURCE-CATALOG-8REF.md](../SOURCE-CATALOG-8REF.md)

---

## 水印配置（E2E 用）

同全局：`config/scrape.json` → `watermark.markCensored: true`

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `japan_censored` |
| 番号 | **SONE-001** / **SONE-002**（均已实测） |
| 索引 strm | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |

```powershell
npx tsx scripts/e2e-sone-source.ts --id=libredmm
npx tsx scripts/e2e-sone-source.ts --id=libredmm --strm="media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-002.strm"
npx tsx scripts/probe-one.ts libredmm
```

---

## 测通 L1（2026-08-22 复测）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **420ms** |
| HTTP | 200 |
| 通道 | `probeVia: direct` |

---

## 字段采集（nfo.include 范围）

单源 **SONE-001 / SONE-002** 均为 **19/30**（生成器推导项另计 8 项）。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, originaltitle, sorttitle, num, plot, outline, premiered, releasedate, release, **actor**, **studio, maker, publisher, label**, **tag, genre**, poster, thumb, cover |
| ✗ **未采集** | originalplot, director, **runtime**, rating, ratings, criticrating, votes, set, **series**, trailer, website |
| ○ 生成器推导 | uniqueid, source, tagline, countrycode, mpaa, customrating, year, fanart |

**未采集原因**

| 字段 | 说明 |
|------|------|
| **runtime** | JSON 有 `minute`/`runtime` 字段，outlet 条目可能未返回或为空 |
| **series** | API 未返回 `series`（两作均为 —） |
| rating / votes / director / trailer / website | API 不提供 |
| originalplot | 与 plot 同源，未单独拆 |

---

## 刮削 · SONE-001（2026-08-22 复测）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **415ms** |
| 标题 | 【プレコレ】…【アウトレット】 |
| 片商 | エスワン ナンバーワンスタイル |
| 演员 | 三田真鈴 |
| 标签 | アウトレット, 巨乳, おもちゃ, 3P・4P, 単体作品 |
| 封面 | `77sone001` mono pl.jpg（**非 digital sone00001**） |

### ⚠️ 条目说明（站点数据，非 MDCS bug）

LibreDMM 对 `SONE-001` **只返回 outlet 再贩条目**（CID `77sone001`），标题含「プレコレ / アウトレット」。  
正式 digital 作以 **DMM / JavBus** 为准；LibreDMM 适合 plot / actor / genre 补充。

---

## 刮削 · SONE-002（2026-08-22 复测）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **557ms** |
| 标题 | 【プレコレ】新人NO.1STYLE … 神楽ももかAVデビュー【アウトレット】 |
| 片商 | エスワン ナンバーワンスタイル |
| 演员 | 神楽ももか |
| 标签 | アウトレット, デビュー作品, 美少女, 巨乳, パイズリ, 単体作品 |
| 封面 | `77sone002` mono pl.jpg |

与 SONE-001 相同：**outlet SKU**，非正式 digital。

---

## 端到端 E2E（2026-08-22 复测）

| 步骤 | SONE-001 | SONE-002 |
|------|----------|----------|
| 刮削 | ✅ 415ms | ✅ 557ms |
| 封面 | ✅ 145808 B | ✅ 125826 B |
| 转移 | ✅ skip | ✅ hardlink |
| NFO | ✅ **21/21 必过** | ✅ **21/21 必过** |
| 海报/水印 | ✅ censored | ✅ censored |
| 字段 | 19/30 | 19/30 |

**命名路径**

```
日本有码/エスワン ナンバーワンスタイル/SONE/SONE-00X/SONE-00X.strm
```

**报告**

- `media/片商目录/日本有码/SONE/SONE-001/_scrap/libredmm/organized/e2e-report.json`
- `media/片商目录/日本有码/SONE/SONE-002/_scrap/libredmm/organized/e2e-report.json`

---

## 与 DMM / Jav321 对比（同番号）

| 项 | LibreDMM | DMM | Jav321 |
|----|----------|-----|--------|
| SONE-001 条目 | outlet 再贩 | 正式 digital | 正式 digital |
| 字段数 | **19/30** | 29/30 | 18/30 |
| actor | ✅ | ✅ | —（精简页） |
| plot | ✅ | ✅ | ✅ |
| rating | — | ✅ | ✅ |
| runtime | — | ✅ | ✅ |
| 封面 | mono 146KB | digital 910KB | digital 166KB |

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 测通 | ✅ |
| 刮削 | ✅ |
| 端到端 | ✅ **全通过**（单源策略：有多少验多少） |
| 生产可用 | ⚠️ 补充源；正式作/封面/评分优先 DMM；注意 outlet 消歧 |

---

## 已知问题

- SONE 系列均解析到 **アウトレット** 条目（`77sone00x`）；后续可增强「排除 outlet / 优先 digital」。
- API 常缺 **runtime / series / rating**。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-23 | 逐站复测 SONE-001：测通 480ms · E2E 全过 · 19/30 字段 · outlet 条目说明 |
| 2026-08-22 | 初测 SONE-001 E2E |
| 2026-08-22 | **复测** SONE-001 + SONE-002；字段缺口 **19/30**；NFO 21/21 必过 |
