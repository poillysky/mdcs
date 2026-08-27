# JavDay — 测试记录

> UI 卡片顺序：**综合组 · #1**  
> 分组：`general`（跨品类聚合，非单一片种）  
> 网络：`proxy_adaptive`（自适应 · 代理→Flare，**不是**分组名）  
> 最后实测：2026-08-24 (UTC+8)

---

## 2026-08-24 完整报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|------|
| 爬虫 | `javday.py` | ✅ `javday.ts` |
| 取数 | 直链 `/videos/{number}/` | 同；**番号须去横杠** SONE-001→SONE001 |
| 字段 | h1 标题、dl 演员/类型/系列 | 新站 `#videoInfo`：h1、`.vod_actor`、`.tag` |
| 封面 | meta og:image | 同；本站 `upload/vod` 图床 |
| 国产 | 默认「国产」mosaic | 仅 `#videoInfo` 内判断；日番默认有码 |

### 根因与修复

1. **URL 404**：带横杠 `/videos/SONE-001/` 404 → 去横杠 `/videos/SONE001/`
2. **mosaic 误判**：全页导航含「無碼」链接 → 仅解析 `#videoInfo` 区块（对齐 MDCX 国产逻辑）

### 结果（SONE-001）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **7/7** | 离线 fixture |
| 测通 | ✅ ~3.7s | `probeVia: flare` |
| Live 刮削 | ✅ ~4.6s | 直链详情，一轮 Flare |
| E2E | ✅ **14/14** | 封面 174KB · NFO 全过 · 无剧照 |

### 字段完整性

| 状态 | 字段 |
|------|------|
| ✅ 已采集 | title / titleZh / plot / actor / genre / mosaic / cover / poster / thumb / website |
| ✗ 站点无 | studio / series / premiered / runtime / rating / director / trailer / extrafanart |

### 结论

**生产可用 ✅** — 综合组繁中 meta 源；自适应网络（代理不通时回落 Flare）。封面本站图床可下。各 kind 可手动加入源链补中文 title/plot。

### 分类与链接核验

| 项 | 参考/初稿 | 实测 | 最终 |
|----|-----------|------|------|
| UI 分组 | MDCX 国产爬虫；曾放 `av` / `chinese` | 站内含有码/无码/chinese-av/jvid 等分类；SONE-001 只是可刮之一 | **`general` 综合** |
| access | `SOURCE-MASTER-LIST` 写 `proxy_flare` | 测通 `probeVia: direct` ~944ms；E2E 刮削 `cookie-direct` ~3s，无 flare | **`proxy_adaptive`** |
| 说明 | 参考文案默认过盾 | 本环境代理直链稳定；CF 时 adaptive 仍可回落 Flare | `notes: 繁中聚合 · URL 去横杠` |

---

## 基本信息

| 项 | 值 |
|----|-----|
| ID | `javday` |
| 默认 URL | https://javday.app |
| UI 分组 | **综合**（`general`） |
| access | `proxy_adaptive`（自适应） |
| 样例番号 | SONE-001（URL: `/videos/SONE001/`） |

## 命令

```powershell
cd E:\Mdcs\apps\server
node --import tsx --test src/scrape/providers/javday.test.ts
npx tsx scripts/probe-one.ts javday
npx tsx scripts/e2e-sone-source.ts --id=javday
```
