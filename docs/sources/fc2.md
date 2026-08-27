# FC2 — 测试记录

> UI 卡片顺序：**FC2 组 #1**（官方 FC2 · 自适应）  
> 最后实测：2026-08-24 11:28 (UTC+8)

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `fc2` |
| 分组 | **`fc2`** |
| 连接方式 | **`proxy_adaptive`** |
| 默认 URL | https://adult.contents.fc2.com |
| Cookie | `adult_check=1` |
| Provider | `apps/server/src/scrape/providers/fc2.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 代理 + curl 自适应 |
| 取数 | 官方 `GET /article/{id}/`（`FC2-1545500` → id `1545500`） |
| 解析 | og:title · 标签区 · 卖家链接 · **販売日/上架时间** · **items_article_info 时长** · JSON-LD 评分 · og:video 预告 |
| 封面 | `storage*.contents.fc2.com` sample 图 |
| 八项目参考 | 色花 · MDCX |

### 分类与链接核验（§1.1）

| 项 | 参考/初稿 | **实测结论** |
|----|-----------|--------------|
| 分组 | FC2 | 官方 FC2 售卖页 → **`fc2`** |
| access | 旧文档 `proxy` | 测通 `probeVia: curl` ~3.7s → **`proxy_adaptive`** |

> FC2 组内还有 **FC2 Hub**（`fc2_hub` · 聚合/javten · 过盾）、**FC2-PPV**（`fd2ppv`）等，卡片顺序：自适应 **fc2** 在前。

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `fc2` |
| 番号 | **FC2-1545500**（非 PPV 编号；PPV 请用 fc2_hub/fd2ppv） |
| 索引 strm | `media/本地索引/FC2/未分类/FC2/FC2-1545500.strm` |

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/fc2.test.ts
npx tsx scripts/probe-one.ts fc2
npx tsx scripts/e2e-sone-source.ts --id=fc2
```

---

## L1 单测（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ **6/6** |

---

## 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~3713ms** |
| 通道 | **`probeVia: curl`** |

---

## 端到端 E2E（2026-08-24 复测）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | curl ~10s |
| 2. 封面 | ✅ | 8032 bytes |
| 3. 整理 | ✅ | FC2 kind |
| 4. 转移 | ✅ | skip |
| 5. NFO | ✅ | **25/25 必过** |
| 6. 海报 | ✅ | 9458 bytes · face crop |
| 7. 水印 | ✅ | **uncensored** |

**字段** 23/30（缺 actor/director/series/plot 原文等 — FC2 官方页通常无演员名；本样例 og:description 为空）

### 多标签识别（2026-08-24 补全）

| 字段 | 支持的页面标签/来源 |
|------|---------------------|
| premiered | 販売日 · 販売開始日 · **上架时间** · 登録日 · 発売日 · 销售日期 |
| runtime | `p.items_article_info`（MM:SS / H:MM:SS / N分） |
| studio | `items_article_writer` / headerInfo `/users/` 链接 |
| genres | TagArea · `data-tag` 属性 |
| rating/votes | JSON-LD `aggregateRating` |
| trailer | `og:video` / twitter player |
| website | `og:url` |

---

## 综合结论

| 维度 | 评级 |
|------|------|
| L1 | ✅ |
| 测通 | ✅ curl |
| E2E | ✅ |
| 生产可用 | ✅ 官方 FC2 番号 meta/封面 |

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-24 | parser 补全多标签（上架时间/runtime/评分/预告）· E2E **23/30** · L1 **6/6** |
| 2026-08-24 | 复测 E2E ✅ · 导出 `parseFc2DetailHtml` · L1 2/2 · access 改 proxy_adaptive |
| 2026-08-22 | FC2-1545500 E2E 初测 ✅ |
