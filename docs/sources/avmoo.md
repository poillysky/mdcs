# Avmoo — 测试记录

> UI 卡片顺序：**有码 AV 组 · #15**  
> 最后实测：2026-08-24 (UTC+8)

---

## 2026-08-24 完整报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|------|
| 爬虫 | `avmoo.py`（AIO 家族） | ✅ `avmoo.ts` |
| 取数 | 搜索 `/cn/search/{code}` → `/cn/movies/{id}` | 同链；详情 **wait 3s** 等 SPA |
| 字段 | 识别码/演员/类别/封面/样品图 | 对齐新 AIO HTML（`detail-label`） |
| 封面 | 站点 CDN | **jp.netcdn.space** 直连 curl（绕过代理）；失败才回退 pics.dmm.co.jp |

### 根因与修复

1. **详情 SPA 空壳**：cookie-direct ~1.5KB → `waitInSeconds: 3` + `isAioThinShell()`
2. **封面下载**：`jp.netcdn.space` 经全局代理超时 → **直连 curl + Referer avmoo.shop**；DMM 仅 alternate

### 结果（SONE-001）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **7/7** | 离线 fixture |
| 测通 | ✅ ~5s | `probeVia: flare` |
| Live 刮削 | ✅ ~10s | 搜索+详情各一轮 Flare |
| E2E | ✅ **23/23** | 封面 166KB · 剧照 15/15 · NFO 全过 |

### 字段完整性

| 状态 | 字段 |
|------|------|
| ✅ 已采集 | title / actor / director / runtime / series / studio / publisher / genres / premiered / cover / poster / thumb / extrafanart×15 |
| ✗ 站点无 | plot / outline / rating / votes / trailer / website |

### 结论

**生产可用 ✅** — 有码补充源；须 FlareSolverr；封面走 DMM 镜像。简介/评分/预告本站不提供，需其它源补齐。

---

## 基本信息

| 项 | 值 |
|----|-----|
| ID | `avmoo` |
| 默认 URL | https://avmoo.shop |
| access | `proxy_flare` |
| 样例番号 | SONE-001 |

## 命令

```powershell
cd E:\Mdcs\apps\server
node --import tsx --test src/scrape/providers/avmoo.test.ts
npx tsx scripts/probe-one.ts avmoo
npx tsx scripts/e2e-sone-source.ts --id=avmoo
```
