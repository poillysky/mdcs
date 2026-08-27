# AirAV.io — 测试记录

> UI 卡片顺序：**#8 有码 AV 组**（r18dev → **airav_io** → sevenmmtv）  
> 最后实测：2026-08-23 23:08 (UTC+8)（完整报告 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 完整报告（23:08 复跑）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **8/8** | 448ms |
| 测通 | ✅ **1128ms** | `probeVia: curl` · airav.io/cn |
| Live + E2E | ✅ 全过 | 刮削 ~8s · 总 ~12s |
| 封面 | ✅ **112895 B** | airav.io CDN |
| 海报 | ✅ **44139 B** | censored |
| NFO | ✅ **21/21** 必过 | 刮削 **19/30** |

报告：`media/片商目录/日本有码/SONE/SONE-001/_scrap/airav_io/organized/e2e-report.json`

### 字段亮点（SONE-001）

- 中文 title/plot · **originalplot** · actor · studio · premiered
- **未采集**：director / runtime / rating / series 等

### 结论

**生产可用 ✅** — 中文元数据补充源；与 AirAV 卡片（委托本 Provider）等效。本轮无代码修复。

---

## 2026-08-23 逐站复测报告

### 优化说明（MDCX + 色花综合）

| 项 | 来源 | MDCS |
|----|------|-------|
| 镜像发现 | 色花 `airavMirror.ts` | ✅ `resolveAiravCnBase` + 失败重探 |
| 取页 | 色花 `fetchPage` + `viaFlare:false` | ✅ 代理 curl 优先 |
| 搜索匹配 | MDCX `get_real_url` + `match_number` | ✅ `listAiravSearchCards` |
| 破解版过滤 | MDCX 克破/无码破解 | ✅ `isAiravJunkEntry` |
| 详情解析 | MDCX ld+json 封面 / 色花字段块 | ✅ `parseAiravIoDetail` |
| URL 拼接 | — | ✅ 修复 `absUrl`（`/cn/video` 不再叠成 `/cn/cn/video`） |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **8/8** | match / pickHid / parse / ld+json |
| 测通 | ✅ **~1266ms** | `probeVia: curl` · adaptive |
| Live 刮削 | ✅ **8200ms** | SONE-001 |
| E2E | ✅ 全过 | 封面 **112895B** · NFO **20/21**（originalplot 未写） |

### 字段采集（SONE-001）

- **刮削**：**19/30**
- **亮点**：中文 title/plot · actors · studio · premiered · 封面
- **未采集**：series / runtime / rating 等（源站无或页面无）

### 结论

**生产可用 ✅** — 中文元数据补充源；依赖 airav.io 镜像/代理可达。

---

## 测试命令

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/airav_io.test.ts
npx tsx scripts/probe-one.ts airav_io
npx tsx scripts/e2e-sone-source.ts --id=airav_io
```
