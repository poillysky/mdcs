# FreeJavBT — 测试记录

> UI 卡片顺序：**有码 AV 组 · #2**（DMM → **FreeJavBT** → iQQTV）  
> 排序规则：`access(代理→自适应→过盾) → implemented → tier → label`  
> 最后实测：2026-08-23 20:05 (UTC+8)

---

## 2026-08-23 修复验证（extrafanart + trailer）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **6/6** | + extrafanart / trailer 断言 |
| extrafanart **采集** | ✅ **×15** | `tile-item` → jdbstatic 样本 URL |
| extrafanart **下载** | ⏭️ **跳过** | jdbstatic 依赖 javdb 会话；当前环境 javdb 不可达，仅保留 URL |
| trailer | ⚠️ 无 | SONE-001 页无 `preview-video`（站点不提供） |
| E2E NFO | ✅ **20/20** | 刮削 18/30（plot/rating/studio 本无） |

---

## 2026-08-23 完整报告（19:52 复跑）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **6/6** | 562ms |
| 测通 | ✅ **1727ms** | `probeVia: direct` |
| Live + E2E | ✅ 全过 | ~4.8s |
| 封面 | ✅ **23381 B** | 第三方 CDN |
| 海报 | ✅ **9987 B** | censored |
| NFO | ✅ **20/20** 必过 | 刮削 18/30 |

报告：`media/片商目录/日本有码/SONE/SONE-001/_scrap/freejavbt/organized/e2e-report.json`

---

## 2026-08-23 逐站复测报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|-------|
| 爬虫 | `freejavbt.py` | ✅ `freejavbt.ts` |
| 标题 | `get_title` · 去演员后缀 | ✅ `parseFreejavbtTitle` · `stripTrailingActorsFromTitle` |
| L1 单测 | `test_freejavbt.py` | ✅ **6/6** |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **6/6** | 详情映射 · 标题清洗 |
| 测通 | ✅ **1096ms** | direct |
| Live 刮削 | ✅ **1101ms** | SONE-001 |
| E2E | ✅ 全过 | 封面 **23KB** · NFO **20/20** |

### 字段采集（SONE-001）

- **刮削**：**18/30**
- **强项**：actor / director / runtime / series / genre / website
- **未采集**：plot / studio / rating / trailer
- **注意**：actor 列表含页面附加名（如天野美优），标题已剥离后缀

### 结论

**生产可用 ✅** — 磁力/元数据补充源；片商/简介需 dmm/javbus 补。本轮无代码修复。

---

## 测试命令

```powershell
cd e:\MDCS\apps\server
node --import tsx --test src/scrape/providers/freejavbt.test.ts
npx tsx scripts/probe-one.ts freejavbt
npx tsx scripts/e2e-sone-source.ts --id=freejavbt
```
