# R18.dev — 测试记录

> UI 卡片顺序：**#7 有码 AV 组**（libredmm → **r18dev** → airav_io）  
> 最后实测：2026-08-23 15:31 (UTC+8)（逐站复测 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 逐站复测报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|-------|
| 取数 | JSON API `dvd_id=` → `combined=` | ✅ 同路径 |
| 番号 normalize | 5 位补零 | ✅ `normalizeR18Id` |
| content_id 回退 | `_content_id_prefixes` 变体 | ✅ 完整移植 MDCX 字典 |
| 封面升级 | `dmm_direct.upgrade_dmm_cover` | ✅ `guessDmmCids` + `probeImageUrl` |
| 字段 | title/actors/studio/series/runtime/genres/gallery/trailer | ✅ 对齐 |
| L1 单测 | `test_r18dev.py` | ✅ `r18dev.test.ts`（7 项） |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **7/7** | normalize / variations / parse / resolve |
| 测通 | ✅ **920ms** | `probeVia: direct` · API `dvd_id=sone00001/json` |
| Live 刮削 | ✅ **1948ms** | SONE-001 |
| E2E | ✅ 全过 | 封面 **166329B** · extrafanart **×15** · NFO **25/25** |

### 字段采集（SONE-001）

- **刮削**：**23/30**
- **NFO 写入**：已采集项全部通过
- **未采集**：plot / rating 等（R18 JSON 不提供）

### 结论

**生产可用 ✅** — DMM 系 JSON 元数据补充源；封面可自动升级到 DMM `pl.jpg`。本轮实现 Provider 并完成全链路验证。

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `r18dev` |
| 分组 | AV |
| 连接方式 | `proxy` |
| 默认 URL | https://r18.dev |
| 探针路径 | `/videos/vod/movies/detail/-/dvd_id=sone00001/json` |
| Provider | `apps/server/src/scrape/providers/r18dev.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 全局代理 HTTP |
| 搜索 | `GET /videos/vod/movies/detail/-/dvd_id={normalized}/json` |
| 详情 | `GET .../combined={content_id}/json` |
| 回退 | `generateR18ContentIdVariations`（118 前缀等） |
| 封面 | JSON `jacket_full_url` → DMM AWS/pl 探针升级 |
| 剧照 | `gallery[].image_full` → extrafanart |
| 八项目参考 | MDCX · `mdcx/crawlers/r18dev.py` |

---

## 测试样例

| 项 | 值 |
|----|-----|
| 番号 | SONE-001 |
| 源 STRM | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |
| E2E 输出 | `media/片商目录/日本有码/SONE/SONE-001/_scrap/r18dev/` |

```powershell
cd apps/server
npx tsx scripts/probe-one.ts r18dev
npx tsx scripts/e2e-sone-source.ts --id=r18dev
node --import tsx --test src/scrape/providers/r18dev.test.ts
```
