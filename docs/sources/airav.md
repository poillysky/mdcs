# AirAV — 测试记录

> UI 卡片顺序：**#10 有码 AV 组**（sevenmmtv → **airav** → avbase）  
> 最后实测：2026-08-23 16:05 (UTC+8)

---

## 2026-08-23 逐站复测报告

### MDCX 对照

- **爬虫**：MDCX `airav_cc`（与 airav_io 同源）；色花 `scrapeAiravWiki`（`more.ts`）
- **取数链**：优先 `airav_io` 搜索 kw→hid→详情；失败再试 wiki `/video/{CODE}`
- **MDCS 差距**：无 — 薄封装委托 `airavIoProvider`，wiki 回退复用 `parseAiravIoDetail`

### 优化说明（色花对齐）

| 项 | 来源 | MDCS |
|----|------|-------|
| 主路径 | 色花 `scrapeAiravWiki` 先调 `scrapeAiravIo` | ✅ `airavIoProvider.scrape` |
| wiki 回退 | `/video/{CODE}` + 同源解析 | ✅ `scrapeAiravWikiFallback` |
| 镜像 | `siteMirror` airav profile | ✅ `prepareProviderFetch("airav")` |
| 解析 | 与 airav_io 共用 | ✅ `parseAiravIoDetail` / `airavDetailCodeOk` |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **3/3** | wiki 404 判定 · 详情解析复用 |
| 测通 | ✅ **1350ms** | `probeVia: curl` · wiki 首页 · adaptive |
| Live 刮削 | ✅ **5944ms** | SONE-001 · 委托 airav_io 成功 |
| E2E | ✅ 全过 | 封面 **112895B** · NFO **20/21**（originalplot 未写） |

### 字段采集（SONE-001）

- **刮削**：**19/30**
- **亮点**：中文 title/plot · actors · studio · premiered · 封面（与 airav_io 同源）
- **未采集**：series / runtime / rating 等（源站无或页面无）

### 结论

**生产可用 ✅** — 与 airav_io 等效元数据；catalog 上作为 wiki 入口独立卡片，实际优先走 airav.io 镜像链。

---

## 测试命令

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/airav.test.ts
npx tsx scripts/probe-one.ts airav
npx tsx scripts/e2e-sone-source.ts --id=airav
```
