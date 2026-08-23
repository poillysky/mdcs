# 设置参数落地审计

> 版本：2026-08-23（backlog 落地后修订）  
> 用途：对照 UI「设置」各 Tab → 配置存储 → 后端消费，标注**已落地 / 部分落地 / 设计限制**。  
> 相关：[SETTINGS-MDCX-ALIGNMENT.md](./SETTINGS-MDCX-ALIGNMENT.md)

---

## 1. 结论

**设置页 11 个 Tab 的参数均已落地**；当前主要注意点不是「存了没用」，而是：

1. **分区 override 有前提**（`useGlobal.* === false` 才用分区值）
2. **NFO include 仅全局**（分区只能改合并策略）
3. **高清海报仅在刮削阶段**运行（只跑整理不会补 Tenhow/Amazon）
4. **Amazon/Tenhow 为简化实现**（相对 MDCX 缺 ASIN 缓存、条码识图等高级能力）

代码入口：

| 域 | 入口 |
|----|------|
| 命名/源链/下载/水印/元数据 | `resolveKindScrapePrefs` · `resolveEffectiveKindProfile`（`loadScrape.ts`） |
| 整理计划 | `buildPlanForFile`（`plan.ts`） |
| 高清海报补充 | `enhanceCoverWithHdPosters`（`scrape/hdPoster.ts`）· `runner.ts` |
| 水印 PNG 目录 | `resolveWatermarkAssetDir`（`organize/watermarkConfig.ts`）· `poster.ts` |

---

## 2. 配置生效规则（必读）

| 配置域 | 存储 | 何时用全局 | 何时用分区专属 |
|--------|------|------------|----------------|
| 命名目录/文件名 | `scrape.naming` + `kindProfiles.*` | 默认（`useGlobal.naming !== false`） | 分区弹窗关「使用全局命名」 |
| 源链 | `kindProfiles.metaSources/coverSources` | **始终分区** | 无全站一份 |
| 字段优先级 | `scrape.fieldPriority` + `kindProfiles.fieldPriority` | 默认 | `useGlobal.sources === false` |
| 下载/水印/元数据 | `scrape.download` 等 | 默认 | 对应 `useGlobal.* === false` |
| NFO include | `scrape.nfo` | **始终全局** | 分区仅能改 `nfoMergeStrategy` |
| 整理方式 | `libraries.kinds.*` | 默认 | `useGlobalOrganize === false` |

---

## 3. 分 Tab 审计

### 3.1 整理（`libraries.json`）

| 项 | 落地 | 消费位置 |
|----|------|----------|
| 硬链/软链/复制/移动 | ✅ | `organize/runner.ts` · `fsops.ts` |
| 失败降级（复制/失败） | ✅ | `fsops.ts` |
| 元数据目录 / 出错删元数据 | ✅ | `plan.ts` · `deleteMetaOnFail.ts` |
| 覆盖视频/字幕 / 覆盖图片 | ✅ | `onConflict` · `runner.ts` · `poster.ts` |
| 最小体积 / 扩展名 / 黑名单 / 垃圾过滤 / 破解词 | ✅ | `scanFilter.ts` · `scanner.ts` · `classify.ts` |
| 源目录清理 | ✅ | `cleanup.ts` |
| 分区整理 override | ✅ | 关「使用全局整理」后：`organizeMode` · `metadataDir` 等 |

### 3.2 监控（`ops.json` + 七区）

| 项 | 落地 | 消费位置 |
|----|------|----------|
| 启用 / 模式 / 间隔 | ✅ | `ops/monitor.ts` |
| 七区来源/输出/启用/扫描 | ✅ | `KindPathsPanel` · `updateKind` |
| 分区弹窗（整理/下载/命名/水印/元数据/NFO/数据源） | ✅ | 见 §2 分区规则 |

### 3.3 下载（`scrape.download`）

| 项 | 落地 | 说明 |
|----|------|------|
| poster / thumb | ✅ | `downloadPrefs.ts` · 关则跳过下封面 |
| fanart | ✅ | 实际下 **extrafanart/**（非 Emby `fanart.jpg`） |
| 选图策略 priority/size | ✅ | `coverDownloadStrategy` · `runner.ts` |
| DMM ps→pl 升清 | ✅ | `downloadPrefs.ts` |
| 海报裁剪比例 / 独立裁剪 / 优先裁剪结果 | ✅ | `poster.ts` |
| 分区 posterCrop | ✅ | `kindProfiles.posterCrop`（下载 Tab 按 Kind 写入） |
| 字幕库目录 | ✅ | `plan.ts` · `subtitles.ts` |
| **Amazon 高清** | ✅ | `hdPoster.ts` · 标题/番号搜 Amazon JP；Tenhow ASIN 优先 `/dp/` |
| **Tenhow 高清** | ✅ | `hdPoster.ts` · 演员 → tenhow.net 五十音索引 → ASIN 图 |
| **Amazon 严格模式** | ✅ | Amazon 503/网络失败且无 Tenhow 兜底 → 刮削失败 |

**高清海报触发条件**：刮削任务 `maybeDownloadCover` 阶段；已有 DMM 高清（宽≥700）等会跳过主动搜图（`shouldSkipHdPosterSearch`）。

### 3.4 命名（`scrape.naming`）

| 项 | 落地 | 说明 |
|----|------|------|
| directoryTemplate / fileNameTemplate | ✅ | 全局默认；分区 **仅**关全局命名后生效 |
| mediaTitleTemplate | ✅ | `{title}` 上下文优先 `titleZh` |
| videoSuffixTemplate / 分类·马赛克·字幕·分辨率 | ✅ | `template.ts` · `resolution.ts` |
| maxDirectoryLength / actorDisplayLimit | ✅ | `joinLibraryTarget` |
| imageNameMode | ✅ | poster.jpg vs `{名}-poster.jpg` |
| subtitleAddChsSuffix | ✅ | 同步到 `download.subtitleAddChsSuffix` |
| AI 生成模板 (✦) | ✅ | 需系统 Tab LLM |
| **naming.posterCrop** | ⚠️ 设计 | schema 保留；**UI 在下载 Tab**，非命名 Tab |

### 3.5 水印（`scrape.watermark`）

| 项 | 落地 | 消费位置 |
|----|------|----------|
| 开关 / 布局 / 偏移 / 间距 / 类型 / 固定位置 | ✅ | `poster.ts` |
| poster/thumb/fanart 应用 | ✅ | `processPosterImage` |
| **customDir** | ✅ | `loadMarkBuffer` 优先读自定义 PNG 目录 |
| **style / style4k** | ✅ | `resolveWatermarkAssetDir` → `assets/watermarks/{id}/` |
| style 下拉仅「默认」 | ⚠️ 体验 | 引擎支持多目录；换样式可用 customDir 或 JSON 改 `style`/`style4k` |

### 3.6 网络

| 项 | 落地 |
|----|------|
| 代理 / FlareSolverr / 超时 | ✅ `loadScrapeConfig` → `proxy.ts` · `flaresolverr.ts` |
| 连通性测试 | ✅ `/api/network/test` |

### 3.7 元数据（`scrape.metadata`）

| 项 | 落地 | 消费位置 |
|----|------|----------|
| 严格模式 / 必须有封面 | ✅ | `metadataPrefs.ts` |
| 色花堂中文标题 | ✅ | `useForumZhTitle` |
| 演员/标签映射 / 映射语言 | ✅ | `mapActors` / `mapTags` |
| 简介精简换行 | ✅ | `trimPlot` |
| 翻译标题/简介 | ✅ | `llmTranslate.ts`（需系统 LLM） |
| translateEngine | ⚠️ 设计 | UI 固定 OpenAI 兼容；后端同 |

### 3.8 NFO（`scrape.nfo`）

| 项 | 落地 | 说明 |
|----|------|------|
| enabled / mergeStrategy | ✅ | `writeMovieNfo` · `mergeMetaForNfo` |
| include.* 各开关 | ✅ | `buildMovieNfo` |
| outlineNoCdata | ✅ | `NfoSettingsPanel` 简介区 · 引擎 `textOrCdata` |
| tagExtras / tagFormats / tagline | ✅ | `buildExtraTags` |
| 分区 NFO Tab | ⚠️ 设计 | **只能**改 `nfoMergeStrategy` |

### 3.9 演员（`ops.actors`）

| 项 | 落地 |
|----|------|
| Emby 连接 / 媒体库 / 同步 | ✅ `embyActorSync.ts` |
| 定时自动刮削 / 入库天数 | ✅ `embyActorScheduler.ts` |
| 元数据/图片/覆盖模式 / 刷新媒体库 | ✅ |

### 3.10 系统 / Webhook

| 项 | 落地 |
|----|------|
| 快速/慢速刮削并发 | ✅ `runner.ts` · `orchestrator.ts` |
| LLM（翻译 + 命名 ✦） | ✅ `llmTranslate.ts` · 前端 localStorage 同步 |
| Webhook 启用/Endpoint/模板/重试 | ✅ `ops/webhook.ts` |

### 3.11 数据源（刮削源页 + 分区弹窗）

| 项 | 落地 | 说明 |
|----|------|------|
| fieldPriority（全局） | ✅ | `merge.ts` · `ScrapeConfigPanel` |
| fieldPriority（分区） | ✅ | `KindSettingsModal` · `FieldPriorityEditor`（关全局数据源后） |
| coverDownloadStrategy | ✅ | 与「下载」Tab 同一字段 |
| disabledProviders / providerSettings | ✅ | orchestrator · Provider 弹窗 |
| kindProfiles 源链 | ✅ | 始终分区级 |

---

## 4. 已发现问题与处理

| # | 问题 | 严重 | 状态 |
|---|------|------|------|
| 1 | `kindProfiles.directoryTemplate` 在「使用全局命名」时不生效 | 高 | **文档 + 分区 UI 提示** |
| 2 | 改 posterCrop 时曾污染 directoryTemplate | 中 | **已修** |
| 3 | merge 忽略 `useGlobal.sources` | 中 | **已修** |
| 4 | Amazon/Tenhow 文案与能力不符 | 中 | **已修** hint + 引擎 `hdPoster.ts` |
| 5 | Tenhow / amazonStrictMode 无引擎 | 低 | **已修** |
| 6 | fanart 名 vs extrafanart 行为 | 低 | **已修** hint |
| 7 | 分区 fieldPriority 无 UI | 低 | **已修** `FieldPriorityEditor` |
| 8 | 水印 style/style4k 仅存不用 | 低 | **已修** `resolveWatermarkAssetDir` |
| 9 | outlineNoCdata 无 UI | 低 | **已修** `NfoSettingsPanel` |

---

## 5. 设计边界（非 bug）

| 项 | 说明 |
|----|------|
| 高清海报仅刮削阶段 | 只跑整理不重刮时不会调用 `hdPoster.ts` |
| 任务高级设置 | 仅有 `skipAmazon` per-job，无 per-job Tenhow/Amazon 高清开关 |
| NFO include 不可 per-kind | 有意为之，避免 Emby 元数据碎片化 |
| Amazon/Tenhow vs MDCX | 无 ASIN Excel 缓存、封面条码、标题置信度匹配等（见 §7） |
| `ops.qb`（qBittorrent） | schema 有、后端有，**设置页无 UI**（改 JSON） |
| 任务预设 `presets` | 在「创建任务」弹窗管理，不在设置 Tab |

---

## 6. 推荐配置（日本有码）

1. **命名** · 全局 `directoryTemplate` = `{series_name}/{number}`
2. **不要**在 JSON 里改 `kindProfiles.*.directoryTemplate` 除非关闭分区「使用全局命名」
3. **下载** · DMM 升清开；需高清时可开 Tenhow + Amazon（**需代理**访问 tenhow.net / amazon.co.jp）
4. **严格模式** · 仅在意 Amazon 必须成功时开启（失败会中止刮削）
5. **NFO** · 默认全开；生产走**多源 merge**
6. **数据源** · `fieldPriority.titleZh/plot` 指向中文源；`originalPlot` 含 dmm/iqqtv

---

## 7. 可选增强 backlog（非设置未落地）

相对 MDCX 仍可后续加深（不影响当前设置项生效）：

- [ ] Amazon ASIN Excel 缓存 / 条码识图
- [ ] Amazon 标题置信度 / 演员组匹配
- [ ] 水印样式 UI 多目录扫描（下拉不止 default）
- [ ] 刮削任务级 `amazonHdPoster` / `tenhowHdPoster` override
- [ ] `ops.qb` 设置页 UI
- [ ] 整理阶段可选重跑高清海报

---

## 8. 已完成 backlog

- [x] Tenhow 高清海报检索（`hdPoster.ts`）
- [x] Amazon 主动搜图 + strictMode（`hdPoster.ts` · `runner.ts`）
- [x] NFO UI 暴露 outlineNoCdata
- [x] 分区 fieldPriority 编辑器（`FieldPriorityEditor`）
- [x] 水印 style/style4k 目录解析
- [x] 多源 merge E2E 验收（`e2e-sone-source.ts --merge`）
