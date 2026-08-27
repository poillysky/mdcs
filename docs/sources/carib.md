# Caribbean — 测试记录

> UI 卡片顺序：**无码 AV 组 #1**（Caribbean · 自适应）  
> 最后实测：2026-08-24 11:10 (UTC+8)

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `carib` |
| 分组 | **`uncensored`**（日本无码官网） |
| 连接方式 | **`proxy_adaptive`** |
| 默认 URL | https://www.caribbeancom.com |
| Provider | `apps/server/src/scrape/providers/carib.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 代理 + curl 自适应（EUC-JP 页；遇盾可回落 Flare） |
| 取数 | `GET /moviepages/{MMDDYY-NNN}/index.html`（番号 `CARIB-010117-339` → `010117-339`） |
| 解析 | spec-title/spec-content + h1/itemprop + Movie JSON |
| 封面 | `/moviepages/{key}/images/l_l.jpg` |
| 八项目参考 | 色花 · JavSP · Javinizer |

详见 [SOURCE-CATALOG-8REF.md](../SOURCE-CATALOG-8REF.md)

### 分类与链接核验（§1.1）

| 项 | 参考/初稿 | **实测结论** |
|----|-----------|--------------|
| 分组 | 旧文档写 AV 组 | 加勒比官网 · 仅无码番号 → **`uncensored`** |
| access | 旧文档写 `proxy` | 测通 `probeVia: curl` ~561ms → **`proxy_adaptive`** |
| 编码 | — | 页为 **EUC-JP**；`fetchViaCurl` 须读 meta charset（已修 download.ts） |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | **`japan_uncensored`**（不可用 SONE-001） |
| 番号 | **CARIB-010117-339** |
| 索引 strm | `media/本地索引/日本无码/加勒比/CARIB/CARIB-010117-339.strm` |

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/carib.test.ts
npx tsx scripts/probe-one.ts carib
npx tsx scripts/e2e-sone-source.ts --id=carib
```

---

## L1 单测（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ **12/12** |
| Fixture | `data/_debug/carib-detail-010117-339.html` |

---

## 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~561ms** |
| HTTP | 200 |
| 通道 | **`probeVia: curl`** |

---

## 刮削（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 标题 | カリビアンキューティー Vol.30 |
| 片商 | カリビアンコム |
| 系列 | カリビアンキューティー |
| 演员 | 姫川ゆうな |
| 标签 | 中出し, オナニー, クンニ, 初裏, スレンダー, 美脚 |
| 封面 URL | https://www.caribbeancom.com/moviepages/010117-339/images/l_l.jpg |
| 预告 | sample_flash_url → smovie.caribbeancom.com 480p.mp4 |

---

## 字段采集（2026-08-24 — nfo.include 范围）

单源 **CARIB-010117-339**，刮削可采集 **26/30**（生成器推导项另计 8 项）。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, originaltitle, sorttitle, num, plot, outline, originalplot, premiered, releasedate, release, actor, runtime, **rating 系列**, set, series, studio, maker, tag, genre, poster, thumb, cover, **trailer**, **website** |
| ✗ **未采集** | director, votes, publisher, label |
| ○ 生成器推导 | uniqueid, source, tagline, countrycode, mpaa, customrating, year, fanart |

**未采集原因**

| 字段 | 说明 |
|------|------|
| rating 系列 / votes | **★ 用户评分已接**（5/5 → score 10）；votes 站点无 |
| director / publisher / label | 站点无对应字段 |

---

## 端到端 E2E（2026-08-24）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | curl · EUC-JP 正确解码 |
| 2. 封面下载 | ✅ | 103846 bytes |
| 3. 整理计划 | ✅ | 无码 kind |
| 4. 文件转移 | ✅ | skip |
| 5. NFO | ✅ | 已采集项 **28/28 必过** |
| 6. 海报 | ✅ | 77264 bytes |
| 7. 水印 | ✅ | **`labels: uncensored`** |
| 8. 剧照 | ✅ | extrafanart ×30 |

**命名路径**

```
日本无码/カリビアンコム/CARIB-010117-339/CARIB-010117-339/CARIB-010117-339.strm
```

**输出目录**

```
media/_e2e/japan_uncensored/CARIB-010117-339/_scrap/carib/organized/
```

---

## 综合结论

| 维度 | 评级 |
|------|------|
| L1 单测 | ✅ **13/13** |
| 测通 | ✅ curl |
| 刮削 | ✅ |
| 端到端 | ✅ **全项通过** |
| 生产可用 | ✅ 无码 meta/封面/剧照/水印可用 |

---

## 已知问题

- 新版详情页**无** `配信日` 字段，已用番号 `MMDDYY-NNN` 兜底 premiered。
- 无 votes / publisher / label / director（站点无结构化字段）。
- 演员须限 `li.movie-spec` 出演行，勿扫关联推荐区（否则会混入他片演员）。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-24 | parser 优化：**★ 用户评分** · **website** · trailer smovie 兜底 · E2E **26/30** · L1 **13/13** |
| 2026-08-24 | **完整落地**：carib.ts + carib.test.ts · probe curl · E2E · NFO · 封面 104KB · 剧照 30 |
| 2026-08-24 | fix EUC-JP（download.ts curl 解码读 meta charset） |
| 2026-08-24 | fix 演员解析（仅出演 spec 行）· 补 trailer |
| 2026-08-22 | CARIB-010117-339 E2E/uncensored ✅ |
| 2026-08-22 | fix premiered / plot |
