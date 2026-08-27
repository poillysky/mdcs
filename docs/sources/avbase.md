# AVBase — 测试记录

> UI 卡片顺序：**有码 AV 组 · #11**（airav → **avbase** → mgstage）  
> 最后实测：2026-08-23 23:15 (UTC+8)（完整报告 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 完整报告（23:15 · 实现后复测）

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|------|
| 爬虫 | `avbase_new.py` / `test_avbase.py` | ✅ `avbase.ts` · `__NEXT_DATA__` |
| 取数 | avbase.net 搜索/详情 JSON | `/works/{CODE}` → `pageProps.work` |
| 演员过滤 | 序号污染 #449 | ✅ `isAvbaseActorName` 过滤纯数字 |
| catalog | — | `sourceMaster.ts` · `implemented: true` |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **7/7** | `avbase.test.ts` · fixture `__NEXT_DATA__` |
| 测通 | ✅ **850ms** | `probeVia: curl` · www.avbase.net |
| Live 刮削 | ✅ | SONE-001 直链 `/works/SONE-001` |
| E2E | ✅ **26/30** | extrafanart 15/15 · NFO 28/28 |

### 采集详情（SONE-001）

| 字段 | 状态 |
|------|------|
| title / plot / actors / genres / studio / series / publisher | ✅ |
| premiered / runtime / director / trailer / website | ✅ |
| cover / poster / thumb / extrafanart×15 | ✅ |
| rating / votes / criticrating | ✗ 站点无 |

### 实现要点

- Next.js `__NEXT_DATA__` 解析，优先 FANZA product（`pickAvbaseProduct`）
- 刮削链：直链详情 → 搜索 `/works?q=` → 再进详情 → 搜索页降级
- 封面 `ps/pt` → `pl` 升级；简介 HTML entity 先解码再 strip

### 结论

**已实现 ✅** — 可作为有码 AV 组刮削源使用；缺 rating/votes（站点不提供）。

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `avbase` |
| 分组 | AV |
| 连接方式 | `proxy_adaptive` |
| 默认 URL | https://www.avbase.net |
| Provider | ✅ `avbase.ts` |
| 实现状态 | ✅ 已实现 |

## 测试命令

```powershell
cd apps/server
npx tsx --test src/scrape/providers/avbase.test.ts
npx tsx scripts/probe-one.ts avbase
npx tsx scripts/e2e-sone-source.ts --id=avbase
```
