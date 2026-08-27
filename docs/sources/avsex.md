# AVSex — 测试记录

> UI 卡片顺序：**有码 AV 组 · #14**（javdb → **avsex**）  
> 最后实测：2026-08-23 23:30 (UTC+8)（完整报告 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 完整报告（23:30 · 复测 + extrafanart 接线）

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|------|
| 爬虫 | `avsex.py` | ✅ `avsex.ts` |
| 搜索 | `/tw/search?query={lower}` | ✅ 同 |
| 中文标题 | title 即中文 | ✅ `title` + `titleZh` |
| thumb/poster | `-2` / `-1` | ✅ cover + `alternateCoverUrls` |
| 剧照 | `get_extrafanart` | ✅ **本轮接入** `extrafanartUrls`（live 12 张） |
| 封面下载 | async_client CF bypass | ❌ **不做**：CDN 不稳定，勿作 cover 源 |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **11/11** | fixture `data/_debug/avsex-*` |
| 测通 | ✅ **6409ms** | `probeVia: flare` · 冷启动 ~6s（probe 超时已调 55s） |
| Live 刮削 | ✅ ~20s | SONE-001 中文元数据齐全 |
| E2E | ⚠️ **19/30** | 刮削 OK · **封面 CDN 403** · 无 poster 故剧照未落盘 |

### 采集详情（SONE-001）

| 字段 | 状态 |
|------|------|
| title / titleZh / plot（中文） | ✅ |
| actors / genres / studio / premiered / runtime | ✅ |
| cover URL / website / mosaic | ✅ |
| extrafanart | ✅ 解析 12 张（封面失败时 E2E 跳过下载） |
| director / rating / series / trailer | ✗ 站点无 |

### 本轮修复

- `parseAvsexDetailHtml` / `scrapeAvsexDetail` 输出 `extrafanartUrls`
- `probe.ts`：avsex 测通超时 55s、取消 strict 首请求（对齐刮削 Flare 冷启动）

### 结论

**生产可用 ⚠️** — **元数据/中文优先**源；单源封面 CDN 仍 CF，**cover 源请保留 javbus/dmm**。

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `avsex` |
| 分组 | AV（T2） |
| 连接方式 | `proxy_flare` |
| 默认 URL | https://avsex.cc |
| Provider | ✅ `avsex.ts` |
| 实现状态 | ✅ 已实现 |

## 测试命令

```powershell
cd apps/server
npx tsx --test src/scrape/providers/avsex.test.ts
npx tsx scripts/probe-one.ts avsex
npx tsx scripts/e2e-sone-source.ts --id=avsex
```
