# 7MMTV — 测试记录

> UI 卡片顺序：**#9 有码 AV 组**（airav_io → **sevenmmtv** → airav）  
> 最后实测：2026-08-23 23:02 (UTC+8)（完整报告 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 完整报告（23:02 复跑）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **3/3** | 554ms |
| 测通 | ✅ **692ms** | `probeVia: curl` · proxy_adaptive |
| Live + E2E | ✅ 全过 | 刮削 ~7s · 总 ~12s |
| 封面 | ✅ **163227 B** | 1025cdn |
| extrafanart | ✅ **3/3** | |
| 海报 | ✅ **57817 B** | censored |
| NFO | ✅ **24/24** | 中文源无 originalplot 时不误报必过 |
| 刮削 | **22/30** | |

报告：`media/片商目录/日本有码/SONE/SONE-001/_scrap/sevenmmtv/organized/e2e-report.json`

### 字段亮点（SONE-001）

- 中文 title/plot · actor · director · studio · runtime · premiered
- **未采集**：series / rating / trailer

### 结论

**生产可用 ✅** — 中文元数据/简介补充源；curl 优先可达。本轮无 Provider 修复。

---

## 2026-08-23 逐站复测报告

### MDCX + 色花对照

| 项 | 参考 | MDCS |
|----|------|-------|
| 搜索 | MDCX POST searchform | ✅ GET SEO 路径 + POST 回退 |
| 结果筛选 | MDCX video-preview | ✅ 色花 `pickDetailHref`（有码优先） |
| 标题 | MDCX 多行 h1 压平 | ✅ `normalizeSevenmmtvTitle` |
| 简介 | MDCX video-introduction | ✅ `parseSevenmmtvOutline` |
| 镜像 | MDCX 域名轮询 / 色花 siteMirror | ✅ `proxy_adaptive` + siteMirror |
| L1 | `test_mmtv.py` | ✅ `sevenmmtv.test.ts`（3 项） |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **3/3** | pickHref / title / outline |
| 测通 | ✅ **639ms** | `probeVia: curl` · adaptive |
| Live 刮削 | ✅ **7024ms** | SONE-001 |
| E2E | ✅ 全过 | 封面 **163227B** · extrafanart **×3** · NFO **24/25** |

### 字段采集（SONE-001）

- **刮削**：**23/30**
- **亮点**：中文 title/plot · actors · studio · director · runtime · premiered · extrafanart
- **未采集**：series / rating / trailer（源站无）

### 结论

**生产可用 ✅** — 中文元数据/简介补充源；`proxy_adaptive` 下 curl 优先可达。

---

## 测试命令

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/sevenmmtv.test.ts
npx tsx scripts/probe-one.ts sevenmmtv
npx tsx scripts/e2e-sone-source.ts --id=sevenmmtv
```
