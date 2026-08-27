# AvSox — 测试记录

> UI 卡片顺序：**无码 AV 组 #2**（AvSox · 过盾）  
> 最后实测：2026-08-24 11:22 (UTC+8)

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `avsox` |
| 分组 | **`uncensored`**（日本无码 AIO 目录） |
| 连接方式 | **`proxy_flare`** |
| 默认 URL | https://avsox.click |
| Provider | `apps/server/src/scrape/providers/avsox.ts` |
| 实现状态 | ✅ 已实现（AIO SPA · 与 Avmoo 同族） |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | **强制 FlareSolverr**（Quasar SPA；直连/curl 仅 ~1.5KB 空壳） |
| 搜索 | `GET /cn/search/{query}` → `movie-card` + `movie-meta` 挑详情 |
| 详情 | `/cn/movies/{slug}` · `detail-label` / `detail-value` DOM |
| 封面 | `file.netcdn.space`（加勒比等为 `storage/caribbeancom/.../l_l.jpg`） |
| 八项目参考 | 色花 AIO · JavSP avsox |

详见 [SOURCE-CATALOG-8REF.md](../SOURCE-CATALOG-8REF.md)

### 分类与链接核验（§1.1）

| 项 | 参考/初稿 | **实测结论** |
|----|-----------|--------------|
| 分组 | 与 Avmoo 混在有码语境 | 站点文案 **Japanese uncensored** · 样例为加勒比 → **`uncensored`** |
| access | catalog `proxy_flare` | 测通/刮削均 **`probeVia: flare`** ~8–10s/页 → **`proxy_flare`** 正确 |
| 样例番号 | 曾用 SONE-001（有码） | 搜索 **无结果**；须 **`japan_uncensored`** 番号 |

### 番号搜索注意

| 输入 | AvSox 搜索 |
|------|------------|
| `SONE-001` | ❌ 没有结果（有码不在库） |
| `CARIB-010117-339` | ❌ 无 CARIB 前缀 |
| **`010117-339`** | ✅ 命中 `/cn/movies/kxawewn` |

Provider 内 `avsoxSearchQueries()` 会对 CARIB 等前缀自动展开为 `010117-339`。

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | **`japan_uncensored`** |
| 番号 | **CARIB-010117-339**（与 carib 同源） |
| 索引 strm | `media/本地索引/日本无码/加勒比/CARIB/CARIB-010117-339.strm` |

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/avsox.test.ts
npx tsx scripts/probe-one.ts avsox
npx tsx scripts/_avsox-scrape-test.ts
npx tsx scripts/e2e-sone-source.ts --id=avsox
```

Fixture：`data/_debug/avsox-search-010117-339.html` · `avsox-detail-010117-339.html`

---

## L1 单测（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ **6/6** |
| 覆盖 | 搜索词展开 · movie-meta 挑链 · AIO 详情解析 · live dump |

---

## 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~10s** |
| HTTP | 200 |
| 通道 | **`probeVia: flare`** |
| URL | `https://avsox.click/cn` |

---

## Live 刮削（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~36s**（搜索+详情各一轮 Flare，wait=3s） |
| 标题 | カリビアンキューティー Vol.30 |
| 片商 | カリビアンコム |
| 系列 | カリビアンキューティー |
| 演员 | 姫川ゆうな |
| 类型 | 首次, 萝莉, AV女优, …（中文标签 12 项） |
| 发行日 | 2017-01-01 |
| 时长 | 61 分钟 |
| 封面 | `file.netcdn.space/.../010117-339/images/l_l.jpg` |

---

## 字段采集（Live · CARIB-010117-339）

约 **19/30**（+website；无 plot；类型为中文标签；导演为 `-`）。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, titleZh, num(推导), actor, genre, series, studio, maker(=studio), premiered, releasedate, release, runtime, **website**, cover, poster/thumb(下载后) |
| ✗ 未采集 | plot, director, rating 系列, publisher, label, trailer |
| ○ 生成器推导 | uniqueid, source, tagline, countrycode, mpaa, customrating, year, fanart |

**未采集原因**：AIO 详情页无简介/导演/评分结构化字段；加勒比条目无 sample 剧照区（extrafanart 可能为空或仅封面）。

---

## 端到端 E2E（2026-08-24 复测）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | flare ~31s（搜索+详情） |
| 2. 封面下载 | ✅ | 54834 bytes · netcdn 直连 |
| 3. 整理计划 | ✅ | 无码 kind |
| 4. 文件转移 | ✅ | skip |
| 5. NFO | ✅ | 已采集项 **20/20 必过** |
| 6. 海报 | ✅ | 88122 bytes |
| 7. 水印 | ✅ | **`labels: uncensored`** |

**输出目录**

```
media/_e2e/japan_uncensored/CARIB-010117-339/_scrap/avsox/organized/
```

---

## 综合结论

| 维度 | 评级 |
|------|------|
| L1 单测 | ✅ 6/6 |
| 测通 | ✅ flare |
| Live 刮削 | ✅ |
| 端到端 | ✅ **全项通过** |
| 生产可用 | ✅ 无码 meta/封面补充源；**勿用 SONE 等有码样例** |

---

## 已知问题

- **仅无码库**：有码番号搜索返回「没有结果」。
- **CARIB 前缀**：须展开为 `MMDDYY-NNN` 再搜。
- **Flare 耗时**：单条刮削 ~30–40s；批量任务须走 slow 通道。
- **剧照**：无 `samples` 区时 extrafanart 可能只有封面（已过滤推荐区/广告图）。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-24 | AIO SPA 重构：对齐 Avmoo · `avsoxSearchQueries` · `pickAvsoxMoviePath` · L1 6/6 |
| 2026-08-24 | e2e-fixtures 改为 **CARIB-010117-339** / `japan_uncensored` |
| 2026-08-24 | E2E 复测 ✅ · 18/30 · NFO 20/20 · 封面 55KB · 无码水印 · scrape timeout 180s |
