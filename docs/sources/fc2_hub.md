# FC2 Hub — 测试记录

> UI 卡片顺序：**#1 FC2 组**  
> 最后实测：2026-08-22 15:20 (UTC+8)（字段缺口清单）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `fc2_hub` |
| 分组 | FC2 |
| 连接方式 | `proxy_flare` |
| 默认 URL | https://javten.com |
| Provider | `apps/server/src/scrape/providers/fc2_hub.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | FlareSolverr 过 javten.com CF |
| 取数 | `/search?kw={id}` → 详情（优先非 /en/ /tw/ /ko/ 链） |
| 解析 | **MDCX 对齐**：h1[1] 标题 · fancybox 封面 · col-8 卖家 · card-text 标签 · col.des 简介 · FC2 sample API 预告 |
| 封面 | **`data-fancybox=gallery` 优先**（非 JSON-LD storage）；其次 ld+json · og |
| 八项目参考 | 色花 · mdcx |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `fc2` |
| 番号 | **FC2-PPV-3275049** |
| 索引 strm | `media/本地索引/FC2/未分类/FC2PPV/FC2-PPV-3275049.strm` |

```powershell
npx tsx scripts/e2e-sone-source.ts --id=fc2_hub
npx tsx scripts/probe-one.ts fc2_hub
```

---

## 刮削（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~125s**（Flare 首访） |
| 标题 | えりかちゃん初ごっくん！可愛い顔が精子で大変なことになってます！ |
| 标签 | MGSTAGE AV |
| 封面 URL | `storage79000.contents.fc2.com/...jpg` |

---

## 字段采集

单源 **FC2-PPV-3275049**，刮削字段增加 **plot / studio / trailer / website**（2026-08-22 MDCX 对齐后待复测 E2E）。

| 状态 | 字段（预期） |
|------|------|
| ✓ | title, plot, studio, premiered, runtime, tag, genre, trailer, website, cover* |
| ✗ | actor（无则卖家作 actor）, rating 系列, series 等 |

\* 封面取决于 fancybox URL 是否仍有效；JSON-LD `storage*.fc2.com` 链已知 404。

---

## 端到端 E2E（2026-08-22）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | ~125s |
| 2. 封面 | ❌ | **HTTP 404**（FC2 storage CDN 链失效） |
| 3. 转移 | ✅ | hardlink |
| 4. NFO | ⚠️ | **13/15 必过**（poster/thumb 因封面失败未写入） |
| 5. 水印 | — | 无 poster 文件，跳过 |

**报告**：`media/_e2e/fc2/FC2-PPV-3275049/_scrap/fc2_hub/organized/e2e-report.json`

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 刮削 | ✅ |
| 端到端 | ⚠️ **封面失败** |
| 生产可用 | ⚠️ 元数据可用；封面靠 **fd2ppv** / 官方 **fc2** 补 |

---

## 已知问题

- JSON-LD `storage*.contents.fc2.com` 封面链常 **404**；已改为 **fancybox 优先**（对齐 MDCX）。
- 若 fancybox 仍指向失效 storage，封面需 **fd2ppv** 或 FC2 官方补图。
- Flare 首访耗时长（~2min）。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-22 | 初测 FC2-PPV-3275049；JSON-LD 封面 404 |
| 2026-08-22 | **MDCX 对齐**：fancybox 封面 · col-8 卖家 · card-text 标签 · col.des 简介 · FC2 sample 预告 |
