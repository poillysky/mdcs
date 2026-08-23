# Caribbean — 测试记录

> UI 卡片顺序：**#5 AV 组**（Jav321 之后；中间 stub 跳过）  
> 最后实测：2026-08-22 15:12 (UTC+8)（字段缺口清单 · 复测）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `carib` |
| 分组 | AV |
| 连接方式 | `proxy` |
| 默认 URL | https://www.caribbeancom.com |
| Provider | `apps/server/src/scrape/providers/carib.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 全局代理 HTTP |
| 取数 | `GET /moviepages/{MMDDYY-NNN}/index.html`（番号 `CARIB-010117-339` → `010117-339`） |
| 解析 | spec-title/spec-content 列表 + h1 / og / itemprop |
| 封面 | `/moviepages/{key}/images/l_l.jpg` |
| 八项目参考 | 色花 · JavSP · Javinizer |

详见 [SOURCE-CATALOG-8REF.md](../SOURCE-CATALOG-8REF.md)

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | **`japan_uncensored`**（不可用 SONE-001） |
| 番号 | **CARIB-010117-339** |
| 索引 strm | `media/本地索引/日本无码/加勒比/CARIB/CARIB-010117-339.strm` |

```powershell
npx tsx scripts/e2e-sone-source.ts --id=carib
npx tsx scripts/probe-one.ts carib
```

---

## 测通 L1（2026-08-22 复测）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~460–586ms** |
| HTTP | 200 |
| 通道 | `probeVia: direct` |

---

## 刮削（2026-08-22 复测）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **459ms** |
| 标题 | カリビアンキューティー Vol.30 |
| 片商 | カリビアンコム |
| 系列 | カリビアンキューティー |
| 演员 | 姫川ゆうな |
| 标签 | 中出し, オナニー, クンニ, 初裏, スレンダー, 美脚 |
| 封面 URL | https://www.caribbeancom.com/moviepages/010117-339/images/l_l.jpg |

---

## 字段采集（2026-08-22 — nfo.include 范围）

单源 **CARIB-010117-339**，刮削可采集 **21/30**（生成器推导项另计 8 项）。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, originaltitle, sorttitle, num, **plot, outline, originalplot**, premiered, releasedate, release, actor, runtime, set, series, studio, maker, tag, genre, poster, thumb, cover |
| ✗ **未采集** | director, rating, ratings, criticrating, votes, publisher, label, trailer, website |
| ○ 生成器推导 | uniqueid, source, tagline, countrycode, mpaa, customrating, year, fanart |

**未采集原因**

| 字段 | 说明 |
|------|------|
| rating 系列 / votes | 站点无结构化评分（仅有ユーザー評価 UI） |
| director / trailer / website | 站点无对应字段或未解析 |

**plot 修复（2026-08-22）**

| 路径 | 说明 |
|------|------|
| `p[itemprop="description"]` | 主路径（对齐 Javinizer） |
| `meta name="description"` | 兜底；过滤「動画詳細ページ/見放題」等 boilerplate |

---

## 端到端 E2E（2026-08-22 复测）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | 459ms |
| 2. 封面下载 | ✅ | 103846 bytes |
| 3. 整理计划 | ✅ | 无码 kind |
| 4. 文件转移 | ✅ | skip |
| 5. NFO | ✅ | 已采集项 **23/23 必过**（含 plot / premiered） |
| 6. 海报 | ✅ | 77264 bytes |
| 7. 水印 | ✅ | **`labels: uncensored`** |

**命名路径**

```
日本无码/カリビアンコム/CARIB-010117-339/CARIB-010117-339/CARIB-010117-339.strm
```

**输出目录**

```
media/_e2e/japan_uncensored/CARIB-010117-339/_scrap/carib/organized/
```

**报告**

```
media/_e2e/japan_uncensored/CARIB-010117-339/_scrap/carib/organized/e2e-report.json
```

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 测通 | ✅ |
| 刮削 | ✅ |
| 端到端 | ✅ **全项通过**（单源策略：有多少验多少） |
| 生产可用 | ✅ 无码元数据/封面/水印可用；日期与简介需他源或修 parser |

---

## 已知问题

- 新版详情页**无** `配信日` 字段，已用番号 `MMDDYY-NNN` 兜底。
- 无 rating / trailer / website。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-22 | CARIB-010117-339 E2E/uncensored ✅ |
| 2026-08-22 | fix **premiered**（番号 MMDDYY 兜底）→ 18/30 |
| 2026-08-22 | fix **plot**（itemprop=description）→ **21/30** |
