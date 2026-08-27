# MGStage — 测试记录

> UI 卡片顺序：**有码 AV 组 · #12**（avbase → **mgstage** → javdb）  
> 最后实测：2026-08-23 23:22 (UTC+8)（完整报告 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 完整报告（23:22 · 实现后）

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|------|
| 爬虫 | `mgstage.py` | ✅ `mgstage.ts` · cheerio |
| 取数 | `/product/product_detail/{CODE}/` + `adc=1` | 直链详情 → 搜索降级 |
| 字段 | detail_data 表格 + introduction + sample-photo | 对齐 xpath 逻辑 |
| 评分 | star class / review 文本 | ✅ `parseMgstageRating` 4.2 + votes |
| 预告 | `sampleRespons.php?pid=` | ⚠️ API 常空/超时（curl 无 JSON） |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **10/10** | fixture `ABP-001` 详情 HTML |
| 测通 | ✅ **1513ms** | `probeVia: curl` · adc=1 |
| Live 刮削 | ✅ | ABP-001 直链详情 |
| E2E | ✅ **28/30** | extrafanart 8/8 · NFO 30/30 |

### 样例说明

- **MGStage 无 SONE-001**（搜索「該当なし」）→ E2E 用 **`ABP-001`**（`media/本地索引/日本有码/PRESTIGE/ABP/ABP-001.strm`）
- Prestige/MGS 系番号为主；DMM 独占品需换源

### 采集详情（ABP-001）

| 字段 | 状态 |
|------|------|
| title / plot / actors / genres / studio / series / publisher | ✅ |
| premiered / runtime / rating / votes / cover / extrafanart | ✅ |
| director | ✗ 站点无（MDCX 亦留空） |
| trailer | ✗ sample API 不可用/超时 |

### 结论

**已实现 ✅** — MGS/Prestige 系番号可用；评分/投票齐全；预告片待 API 稳定后再补。

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `mgstage` |
| 分组 | AV |
| 连接方式 | `proxy_adaptive` |
| 默认 URL | https://www.mgstage.com |
| Cookie | `adc=1` |
| Provider | ✅ `mgstage.ts` |
| 实现状态 | ✅ 已实现 |

## 测试命令

```powershell
cd apps/server
npx tsx --test src/scrape/providers/mgstage.test.ts
npx tsx scripts/probe-one.ts mgstage
npx tsx scripts/e2e-sone-source.ts --id=mgstage
```
