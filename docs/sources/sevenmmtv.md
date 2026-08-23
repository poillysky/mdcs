# 7MMTV — 测试记录

> UI 卡片顺序：**#9 有码 AV 组**（airav_io → **sevenmmtv** → airav）  
> 最后实测：2026-08-23 15:57 (UTC+8)

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
