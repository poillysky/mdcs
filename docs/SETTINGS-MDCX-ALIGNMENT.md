# 设置参数 · MDCX 对齐深度分析

> 版本：2026-08-23  
> 基准：**MDCX 为基地** · **色花补充优化** · **MDC-NG 实测库为验收标准**  
> 样例：`SONE-001` · 片商目录 `media/片商目录/日本有码/SONE/`  
> 相关：[`references/MDC-NG-UI.md`](./references/MDC-NG-UI.md) · [`DESIGN.md`](./DESIGN.md) §4.7

---

## 1. 结论摘要

| 维度 | MDC-NG 实测（SONE 片商目录） | MDCS 当前 | 对齐状态 |
|------|------------------------------|------------|----------|
| **目录结构** | `libraryRoot/SONE/SONE-001/` | 全局 `{series_name}/{number}` → 一致 | ✅ |
| **视频文件名** | `SONE-001.strm`（无后缀） | `{number}` + 后缀模板（有码为空） | ✅ |
| **图片** | `poster.jpg` · `thumb.jpg` | 同左 + 右侧 47% 裁剪 + 水印 | ✅（MDCS 多水印层） |
| **NFO 总开关** | 全开 | `nfo.enabled=true` | ✅ |
| **NFO title** | **中文**显示名 | 单源 E2E 常为日文；多源 merge 待对齐 | ⚠️ |
| **NFO originaltitle** | `SONE-001` + 日文完整标题 | 仅 `meta.title`，**缺番号前缀** | ⚠️ |
| **NFO plot/outline/originalplot** | 三者均有（中文简介） | 中文源缺 `originalPlot` 字段 | ⚠️ |
| **NFO 评分/预告** | javdb rating · DMM trailer | 单源时有；merge 后更接近 | ⚠️ 视源链 |
| **MDCS 扩展** | 无 | `<uniqueid>` · `<source>` | ➕ 无害扩展 |

**推荐**：UI「设置」保持默认 NFO 全开；**生产刮削走多源 merge**（非单源 E2E）；目录继续 `{series_name}/{number}`；待代码对齐 §6 差距项。

---

## 2. 端到端数据流

```
索引 strm（sourceRoot）
    ↓ 监控/手动任务
多源刮削（fieldPriority 按字段取优）
    ↓ mergeScrapeResults
元数据 meta.json + 封面 data/covers/{kind}/{code}.jpg
    ↓ buildPlanForFile（命名模板 + 后缀）
硬链/复制 → libraryRoot/{series_name}/{number}/{number}.strm
    ↓ processPosterImage（裁剪 + 水印）
poster.jpg · thumb.jpg · [extrafanart/]
    ↓ writeMovieNfo（include 开关）
{number}.nfo
```

与 MDCX 对比：

| 阶段 | MDCX (`mdcx-diy`) | MDCS |
|------|-------------------|-------|
| 刮削 | 多源并行 + 字段覆盖策略 | `orchestrator` + `merge.ts` + `fieldPriority` |
| 目录 | `folder_name`（默认演员目录，MDC-NG 已改为番号前缀） | `directoryTemplate` + `libraryRoot` |
| 文件名 | `naming_file` = `{{ number }}` | `fileNameTemplate` + `videoSuffixTemplate` |
| Emby 标题 | `naming_media` Jinja 模板 | `mediaTitleTemplate` |
| NFO | `mdcx/core/nfo.py` + `nfo_include_new` | `organize/nfo.ts` + `nfo.include` |
| 海报 | 下载 + mark 水印 | `cache.ts` 下载 + `poster.ts` 裁剪水印 |

---

## 3. UI「设置」11 Tab 与 MDCX 映射

| MDCS Tab | 配置文件 | MDCX / MDC-NG 对应 | 日本有码推荐 |
|-----------|----------|-------------------|--------------|
| **整理** | `libraries.json` → `organize` | 软/硬链、冲突、扫描过滤 | 硬链 · 覆盖 · min 100MB |
| **监控** | `libraries.json` → `kinds.*` | 监控目录 | `sourceRoot` / `libraryRoot` 已配 |
| **下载** | `scrape.json` → `download` | 海报/fanart/Amazon/Tenhow | poster+thumb ✅ · fanart ☐ |
| **命名** | `scrape.json` → `naming` | `folder_name` / `naming_file` / `naming_media` | 见 §4 |
| **水印** | `scrape.json` → `watermark` | `mark_*` 角标 | 开 · 堆叠 · poster+thumb |
| **网络** | `scrape.json` 代理/Flare | `proxy` / CF 过盾 | 已配 NAS 代理 + Flare |
| **元数据** | `scrape.json` → `metadata` | 映射/色花堂标题/翻译 | 映射开 · 翻译关（靠中文源） |
| **NFO** | `scrape.json` → `nfo` | `nfo_include_new` | 默认全开（见 §5） |
| **演员** | `scrape.json` → `actors` | Emby 演员同步 | 按需 |
| **系统** | 并发 / LLM | timeout / OpenAI | fast=4 slow=2 |
| **Webhook** | `webhook` | — | 按需 |

分区专属：各 kind 的 `kindProfiles` 可 override 源链/裁剪；**命名默认跟全局**（`useGlobal.naming !== false` 时 `kindProfiles.directoryTemplate` **不生效**）。

---

## 4. 目录 · 文件名 · 后缀

### 4.1 MDC-NG 实测结构（SONE）

```
media/片商目录/日本有码/
└── SONE/
    ├── SONE-001/
    │   ├── SONE-001.strm
    │   ├── SONE-001.nfo
    │   ├── poster.jpg
    │   └── thumb.jpg
    ├── SONE-002/
    …
```

对应模板：**`{series_name}/{number}`**（`series_name` = 番号前缀 `SONE`）。

### 4.2 MDCS 当前配置（`config/scrape.json`）

| 项 | 全局 `naming` | 说明 |
|----|---------------|------|
| `directoryTemplate` | `{series_name}/{number}` | ✅ 与 MDC-NG 一致 |
| `fileNameTemplate` | `{number}` | ✅ |
| `mediaTitleTemplate` | `{title}` | ⚠️ 见 §5.2，建议改为 `{titleZh}` 或 merge 后 title=中文 |
| `videoSuffixTemplate` | `{mosaic}{subtitle}{resolution}{part}` | 有码/无字幕时后缀为空 ✅ |
| `imageNameMode` | `none` | → `poster.jpg` ✅ |
| `mosaicSuffixLabels.censored` | `""` | 有码不追加 `-有码` ✅ |

**注意**：`kindProfiles.japan_censored.directoryTemplate` 虽写了 `{category}/{studio}/{series_name}/{number}`，但在未关闭「命名使用全局」时**不会生效**。生产路径以全局 `{series_name}/{number}` 为准。

### 4.3 后缀逻辑（MDCX `suffix_sort`）

MDCX 默认顺序：`moword → cnword → definition`（马赛克 · 中字 · 分辨率）。

MDCS `videoSuffixTemplate` 顺序：`{mosaic}{subtitle}{resolution}{part}`，语义等价。当前实例：

- 有码 + 无字幕 + 路径无 4K → **文件名为纯 `{number}`**（与 MDC-NG 一致）
- 中字库检测到字幕 → 可追加 `中字` tag（NFO）或后缀（若配置 `subtitleSuffixLabel`）

### 4.4 命名模板优先级（代码）

```
resolveEffectiveKindProfile:
  useGlobal.naming === false → kindProfiles.directoryTemplate
  否则 → scrape.naming.directoryTemplate   ← 当前走这条

buildPlanForFile:
  jobOptions.useGlobal.naming === false → 任务级 naming
  否则 → resolveEffectiveKindProfile 结果
```

---

## 5. NFO 生成标准

### 5.1 UI 配置（「NFO」Tab）— 推荐保持默认

| 分组 | 开关 | 推荐 | 说明 |
|------|------|------|------|
| 启用 NFO | ✅ | ✅ | 总开关 |
| 合并策略 | 刮削结果覆盖 | ✅ | 重刮以新 meta 为准 |
| 简介 | outline · plot · originalplot | 全开 | **有数据才写入**，不是采集开关 |
| 标题 | sorttitle · originaltitle | 全开 | |
| 发行 | release · releasedate · premiered | 全开 | Emby/Jellyfin 兼容 |
| 附加 tag | 番号前缀 · 演员 · 有码 · 系列 · 片商 | 全开 | 与 MDC-NG 一致 |
| 合集 set | seriesSet | ✅ | `<set>` 写系列名 |
| tagline | `发行日期: {release}` | ✅ | 与 MDC-NG 一致 |

### 5.2 字段语义：MDCX vs MDCS

MDCX `nfo.py` 核心规则：

```python
# title：媒体库显示名（naming_media 模板，常为中文）
write_text_element("title", nfo_title)

# originaltitle：番号 + 原标题（当 number != title）
write_text_element("originaltitle", number + " " + originaltitle)

# sorttitle：番号 + 原标题
write_text_element("sorttitle", number + " " + originaltitle)

# outline/plot：同一中文简介（可合并 originalplot）
# originalplot：日文/原文简介（与 outline 不同时单独写）
```

MDCS `buildMovieNfo`：

```typescript
displayTitle = ctx.mediaTitle || meta.titleZh || meta.title   // title
originaltitle = meta.title                                     // 无番号前缀
sorttitle = `${meta.code} ${meta.title}`                       // 有番号
plot/outline ← meta.plot
originalplot ← meta.originalPlot（中文源常为空）
```

### 5.3 SONE-001 实测对比

#### MDC-NG 生产 NFO（`media/片商目录/日本有码/SONE/SONE-001/SONE-001.nfo`）

| 字段 | 值要点 |
|------|--------|
| `<title>` | **中文**：淫荡超可爱的三田真铃… |
| `<originaltitle>` | **SONE-001** + 日文长标题 |
| `<sorttitle>` | **SONE-001** + 日文长标题 |
| plot/outline/originalplot | **均有**，中文简介（三者相同） |
| studio | `S1 NO.1 STYLE` |
| premiered | 2023-12-11 |
| rating | 8.8 · javdb 4.42 |
| trailer | DMM 预览 MP4 |
| cover | DMM `pl.jpg` URL |
| poster/thumb | 本地 `poster.jpg` / `thumb.jpg` |

#### MDCS 单源 E2E（`_scrap/{source}/organized/SONE/SONE-001/`）

| 源 | title | plot | originalplot | 备注 |
|----|-------|------|--------------|------|
| **airav_io** | 中文 | ✅ | ❌ | 缺 originalPlot 字段 |
| **dmm** | 日文 | ✅ 日文长文 | ✅ | 最接近 MDCX 原文 |
| **iqqtv** | 日文 | 中文 | ✅ 日文 | 双语源示范 |
| **javbus** | 日文 | ❌ | ❌ | 无简介 |
| **libredmm** | 日文 | ✅ | ✅ | 字段较全 |

#### 差距根因

1. **单源 E2E ≠ 生产**：MDC-NG 为多源 merge；MDCS 应对齐 `fieldPriority` 合并后再写 NFO。
2. **title 中文**：MDC-NG 用 merge 后的中文 title；MDCS `mediaTitleTemplate: {title}` 取的是 `meta.title`（常为日文），应优先 `titleZh` 或改 merge 规则。
3. **originaltitle 番号前缀**：MDCX 强制 `number + " " + originaltitle`；MDCS 未实现。
4. **airav originalplot**：MDCX `airav_cc` 设 `originalplot=outline`；MDCS 中文源未设 `originalPlot`（见 [`airav_io.md`](./sources/airav_io.md)）。

### 5.4 推荐 fieldPriority（日本有码 · 对齐 MDC-NG）

当前 `config/scrape.json` 已接近 MDC-NG 实践：

| 字段 | 优先级（前→后） | 用途 |
|------|-----------------|------|
| titleZh / plot | avsex → iqqtv → airav_io → jav321 | 中文标题/简介 |
| title（原文） | javbus → jav321 → libredmm → dmm | originaltitle / sorttitle |
| cover | javbus → jav321 → libredmm | 封面（DMM pl 高清） |
| studio | javbus → jav321 → libredmm | 片商 |
| actors | javbus → jav321 → libredmm | 演员 |

**待补**：`fieldPriority.originalPlot` 显式链（如 `dmm → iqqtv → jav321 → libredmm`）。

---

## 6. 图片下载

### 6.1 流程对比

| 步骤 | MDCX | MDCS |
|------|------|-------|
| 选源 | 字段优先级 + 跳过 Amazon 大图规则 | `fieldPriority.cover` + `pickCoverUrlForDownload` |
| 下载 | `image_download` + CF bypass | `fetchBuffer` / Flare + `data/covers/` 缓存 |
| 裁剪 | 可配 | `posterCrop: right`（47% 右图，日本有码） |
| 水印 | mark 角标 | `watermark` 堆叠（有码/字幕/4K） |
| thumb | 同 poster 或独立 | `ensureThumbBesidePoster` 复制 poster |
| fanart | extrafanart 可选 | `downloadFanart`（默认关） |
| 命名 | `pic_simple_name` → poster.jpg | `imageNameMode: none` → poster.jpg ✅ |

### 6.2 SONE-001 封面体积（MDCS E2E）

| 源 | poster 大小 | 说明 |
|----|-------------|------|
| dmm / jav321 / libredmm | ~57KB | DMM 系高清竖图 |
| airav_io / javbus | ~44KB | 裁剪+水印后 |
| freejavbt | ~10KB | 小图 |

MDC-NG 生产 `poster.jpg` 与 DMM 源同量级。

---

## 7. MDCX 默认 vs MDC-NG 实例 vs MDCS 推荐

| 配置项 | MDCX 默认 (`v1.py`) | MDC-NG / 用户库 | MDCS 推荐 |
|--------|---------------------|-----------------|------------|
| 目录 | `{{ actor }}/{{ number }} {{ actor }}` | `{series_name}/{number}` | **`{series_name}/{number}`** |
| 文件名 | `{{ number }}` | `{number}` | **`{number}`** |
| Emby 标题 | `[番号]标题` Jinja | 中文 `{title}` | **`{titleZh}` 或 merge 中文 title** |
| NFO include | 长串默认全开 | 全开 | **默认全开（勿关 originalplot）** |
| 后缀 | `-破解` / `-流出` | 有码为空 | **保持空** |
| 海报名 | poster.jpg | poster.jpg | **none → poster.jpg** |

---

## 8. 待对齐代码项（按优先级）

| # | 项 | 对齐目标 | 状态 |
|---|-----|----------|------|
| 1 | **NFO `<title>` 用中文** | MDC-NG：`title`=中文 | ✅ `buildMovieNfo` 优先 `titleZh`；单源 E2E 仍可能日文，**生产用 `--merge` 验收** |
| 2 | **originaltitle 加番号前缀** | MDCX：`number + " " + originaltitle` | ✅ `nfo.test.ts` |
| 3 | **airav_io `originalPlot: plot`** | MDCX airav_cc | ✅ |
| 4 | **fieldPriority.originalPlot** | 多源 merge | ✅ `scrape.json` + `merge.test.ts` |
| 5 | **kindProfiles 命名说明** | UI 提示「关全局命名才生效」 | ✅ `KindSettingsModal` |
| 6 | **E2E 增 multi-source 模式** | 与 MDC-NG 同路径验收 | ✅ `e2e-sone-source.ts --merge` |

**多源 merge 验收**：`npx tsx scripts/e2e-sone-source.ts --merge`（SONE-001，走 kindProfile 全源 + fieldPriority）

---

## 9. 验收清单（SONE 片商目录）

刮削 `SONE-001` 完成后，对比 MDC-NG 同目录：

- [ ] 路径为 `…/SONE/SONE-001/SONE-001.strm`（无多余 category/studio 层）
- [ ] 文件名无 `-有码` 等后缀（纯有码片）
- [ ] `poster.jpg` + `thumb.jpg` 存在且 >30KB
- [ ] NFO `<title>` 为中文
- [ ] NFO `<originaltitle>` 以 `SONE-001` 开头
- [ ] NFO plot/outline/originalplot 至少有中文简介
- [ ] `<tag>` 含 `SONE`、演员、片商/系列附加 tag
- [ ] 可选：trailer · javdb ratings（有源则写）

---

## 10. 参考文件

| 类型 | 路径 |
|------|------|
| MDCS 命名 | `apps/server/src/organize/template.ts` · `plan.ts` |
| MDCS NFO | `apps/server/src/organize/nfo.ts` · `nfoCtx.ts` · `nfoConfig.ts` |
| MDCS 配置 | `config/scrape.json` · `config/libraries.json` |
| MDCX NFO | `references/mdcx-diy/mdcx/core/nfo.py` |
| MDCX 默认配置 | `references/mdcx-diy/mdcx/config/v1.py` |
| MDC-NG 实测 NFO | `media/片商目录/日本有码/SONE/SONE-001/SONE-001.nfo` |
| MDCS E2E NFO | `media/片商目录/日本有码/SONE/SONE-001/_scrap/*/organized/SONE/SONE-001/` |
