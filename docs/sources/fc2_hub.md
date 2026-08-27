# FC2 Hub — 测试记录

> UI 卡片顺序：**#1 FC2 组**  
> 最后实测：2026-08-24（样例 **FC2-PPV-4962908** 全流程通过）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `fc2_hub` |
| 分组 | `fc2`（实测确认） |
| 连接方式 | `proxy_flare`（实测 `probeVia: flare`） |
| 默认 URL | https://javten.com |
| Provider | `apps/server/src/scrape/providers/fc2_hub.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | FlareSolverr 过 javten.com CF（session 偶发失败后 fresh 回退） |
| 取数 | `/search?kw={id}` → `/video/{n}/id{id}` |
| 解析 | **MDCX 对齐**：h1 标题 · fancybox 封面（优先 thumbnail CDN）· padding:0 剧照 · col-8 卖家 · card-text `/tag/` · col.des 简介 · series=`FC2系列` · FC2 sample 预告 |
| 封面 | **仅** fancybox；禁止 LD/og；优先 `contents-thumbnail*.fc2.com` |
| 八项目参考 | **mdcx**（主） |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `fc2` |
| 番号（批量 E2E） | **FC2-PPV-3275049**（与 fd2ppv fixture 对齐） |
|  richer 单测 | **FC2-PPV-4962908**（标签+封面更全，`--strm=` 覆盖） |
| 索引 strm | `media/本地索引/FC2/未分类/FC2PPV/FC2-PPV-3275049.strm` |

```powershell
npx tsx --test src/scrape/providers/fc2_hub.test.ts
npx tsx scripts/probe-one.ts fc2_hub
npx tsx scripts/e2e-sone-source.ts --id=fc2_hub
```

---

## L1 / 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| L1 单测 | ✅ **13/13** |
| 测通 | ✅ `ok` · ~56s · `probeVia: flare` |
| access / group | **`proxy_flare`** / **`fc2`** |

---

## Live / E2E — FC2-PPV-4962908（2026-08-24）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | ~25s Flare；title / plot / studio=`野菜` / series / tags / trailer |
| 2. 封面 | ✅ | thumbnail CDN · **145584** bytes |
| 3. 转移 | ✅ | hardlink |
| 4. 海报/水印 | ✅ | poster + thumb · uncensored |
| 5. 剧照 | ✅ | extrafanart **×3** |
| 6. NFO | ✅ | 已采集项 **26/26** 必过 |

**刮削字段**：24/30  
**已采集**：title, plot, premiered/runtime, series, studio, tag/genre, poster/thumb/cover, trailer, website  
**未采集**：actor（mdcx 默认不取卖家）、director、rating 系

**输出**：`media/_e2e/fc2/FC2-PPV-4962908/_scrap/fc2_hub/organized/`

---

## 对照 — FC2-PPV-3275049（旧样例）

| 项 | 结果 |
|----|------|
| 刮削 meta | ✅ title/plot/studio/series |
| 标签 | ✗ 页上 `タグ :` 为空 |
| 封面 | ✗ fancybox→旧 storage **404**（策略不硬下死链时可空） |

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 刮削 | ✅ |
| 端到端（新样例） | ✅ |
| 生产可用 | ✅ 作 FC2 meta/封面辅源；旧片封面仍可能需 **fc2** / **fd2ppv** 补 |

---

## 已知问题

- Flare session 偶发 Connection refused，fresh 无 session 可恢复。
- 极旧片 storage CDN 可能 404；下载失败时靠其它源合并。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-24 | **E2E 4962908 全通过**（24/30 · 封面 · 剧照×3 · NFO 26/26）；默认样例改此号 |
| 2026-08-24 | 封面接受 thumbnail/storage fancybox；优先 contents-thumbnail |
| 2026-08-24 | 优化：仅 fancybox；series；卖家不当 actor |
| 2026-08-22 | 初测 3275049 |
