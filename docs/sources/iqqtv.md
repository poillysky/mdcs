# iQQTV — 测试记录

> UI 卡片顺序：**有码 AV 组 · 第 1 行第 3 卡**（DMM → FreeJavBT → **iQQTV**）  
> 最后实测：2026-08-23 15:15 (UTC+8)（逐站复测 · 规范见 SOURCE-SINGLE-SITE-TEST.md）

---

## 2026-08-23 逐站复测报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|-------|
| 爬虫 | `iqqtv.py` · CN/JP 双页 | ✅ `iqqtv.ts` |
| 搜索命中 | `get_real_url` 精确番号（BF≠ABF） | ✅ `matchIqqtvNumber` |
| 简介 | `getOutline` · 紹介/简介 · 去分发说明 | ✅ `parseIqqtvOutline` |
| 标题清洗 | `remove_web_number_suffix` | ✅ `removeIqqtvWebNumberSuffix` |
| 镜像 | 多域 | ✅ `iqqtvMirror.ts` |
| L1 单测 | `test_iqqtv*.py` | ✅ `iqqtv.test.ts` **6/6** |

### 结果

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **6/6** | 番号匹配 · 简介 · CN/JP 字段 |
| 测通 | ✅ **1286ms** | `probeVia: direct` · iqq5.xyz/cn |
| Live 刮削 | ✅ **2153ms** | 3 次 cookie-direct（CN+JP+详情） |
| E2E | ✅ 全过 | 封面 **119386B** · NFO **23/23** |

### 字段采集（SONE-001）

- **刮削**：**21/30**
- **NFO 写入**：已采集项全部通过
- **强项**：中文 title/plot · originalplot · website
- **未采集**：director / runtime / rating / trailer / publisher / label（站点不提供）

### 结论

**生产可用 ✅** — 中文元数据补充源；封面 CDN `iqqk4.quest` 可直连。本轮无代码修复。

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `iqqtv` |
| 分组 | AV |
| 连接方式 | `proxy` |
| 默认 URL | https://iqq5.xyz/cn |
| Provider | `apps/server/src/scrape/providers/iqqtv.ts` |
| 实现状态 | ✅ 已实现 |
| MDCX 参考 | `references/mdcx-diy/mdcx/crawlers/iqqtv.py` |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 代理直连 |
| 取数 | 搜索 `/cn/search?keyword=` → 详情 `/cn/player/{code}` + 可选 JP 页补 original |
| 封面 | og:image / preview CDN |
| 测通 | catalog 首页或 `/cn/` |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `japan_censored` |
| 番号 | **SONE-001** |
| 索引 strm | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |

```powershell
cd e:\MDCS\apps\server
node --import tsx --test src/scrape/providers/iqqtv.test.ts
npx tsx scripts/probe-one.ts iqqtv
npx tsx scripts/e2e-sone-source.ts --id=iqqtv
```

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-23 | 逐站复测：L1 6/6 · 测通 1286ms · E2E 21/30 · NFO 23/23 |
| 2026-08-22 | 批量刮削 SONE-001 ✅ ~2.8s |
