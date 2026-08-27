# MDCS — 本地 AV 刮削整理服务设计文档

> 版本：v1.2  
> 日期：2026-08-20  
> 状态：设计基线（MDC UI 全量 + 八参考项目引擎对照）  
> UI 参考来源：[`docs/references/MDC-NG-UI.md`](references/MDC-NG-UI.md)（MDC-NG v1.36.0）  
> 引擎参考来源：`references/` 下 8 个项目（见 §10）  
> 体验文档：[`UI-PLAYBOOK.md`](UI-PLAYBOOK.md) · [`UI-COPY.md`](UI-COPY.md) · [`UI-WIREFRAMES.md`](UI-WIREFRAMES.md)  
> 执行计划：[`ROADMAP.md`](ROADMAP.md)（S0→S6 逐步勾选）

---

## 1. 设计目标

### 1.1 产品定位

MDCS 是独立部署的本地刮削整理系统，面向 **20 万级** 媒体文件：

- **输入**：七路径 `sourceRoot` 内视频
- **处理**：扫描 → 识别 → 刮削 → 规划 → 整理 → 产物
- **输出**：七路径 `libraryRoot` + NFO / 封面 / 元数据

### 1.2 设计底座

| 层级 | 来源 | 说明 |
|------|------|------|
| **UI 交互** | MDC-NG | 侧栏 + 设置 Tab + 列表/详情/弹窗，本文 §4 全量对齐 |
| **七路径语义** | 色花 sehua | `KindId` / `kindProfiles` / `fieldPriority` / `posterCrop.byKind` |
| **MDC 补齐项** | 色花 | 新增 `japan_gravure`（日本写真），6→7 路径 |
| **引擎策略** | sehua + mdcx + JavSP | 双通道刮削、字段按需、番号识别、NFO |

### 1.3 非目标

- 不接入色花运行时
- 不做 PyQt 桌面壳、Jellyfin 插件
- 不采用 MDC 的软链接 / 原地整理 / 自动清理源目录（高风险，默认关闭）

---

## 2. 总体架构（摘要）

```text
Browser -> apps/web (:3050)
              -> /api -> apps/server (:9210)
                            -> SQLite (mdcs.db)
                            -> config/libraries.json   # 七路径 + 整理
                            -> config/scrape.json      # 源链 + 命名 + 网络
                            -> data/meta + data/covers
```

**双平面**：控制面（UI/API/配置/Webhook）+ 数据面（Scan/Scrape/Organize/Artifact）

**流水线**：`Scan → Identify → Classify → Scrape → Plan → Organize → Artifact`

---

## 3. 七大路径模型

### 3.1 KindId 定义

| KindId | 中文 | 短标记 | MDC 对应 | MDCS 说明 |
|--------|------|--------|----------|------------|
| `japan_censored` | 日本有码 | 码 | 有码 | 常规 JAV |
| `japan_gravure` | 日本写真 | 写 | **无（色花补入）** | Graphis / IV |
| `japan_uncensored` | 日本无码 | 无 | 无码 | Carib 等 |
| `japan_amateur` | 日本素人 | 素 | 素人 | SIRO 等 |
| `fc2` | FC2 | F | FC2 | FC2-PPV |
| `china` | 国产无码 | 国 | 国产 | 麻豆等 |
| `western` | 欧美无码 | 欧 | 欧美 | ThePornDB 等 |

### 3.2 配置层级

1. **全局默认**：`organize.*`、全局 `fieldPriority`、网络、系统线程
2. **分区覆盖**：`kinds.{kindId}.*`、`kindProfiles.{kindId}.*`
3. **任务覆盖**：手动任务「高级设置」弹窗（仅本次任务）

### 3.3 最小配置

```json
{
  "organize": { "defaultMode": "hardlink", "defaultFallback": "copy", "onConflict": "skip" },
  "kinds": {
    "japan_censored": { "enabled": true, "label": "日本有码", "sourceRoot": "inbox/有码", "libraryRoot": "library/日本有码" },
    "japan_gravure": { "enabled": true, "label": "日本写真", "sourceRoot": "inbox/写真", "libraryRoot": "library/日本写真" },
    "japan_uncensored": { "enabled": true, "label": "日本无码", "sourceRoot": "inbox/无码", "libraryRoot": "library/日本无码" },
    "japan_amateur": { "enabled": true, "label": "日本素人", "sourceRoot": "inbox/素人", "libraryRoot": "library/日本素人" },
    "fc2": { "enabled": true, "label": "FC2", "sourceRoot": "inbox/FC2", "libraryRoot": "library/FC2" },
    "china": { "enabled": true, "label": "国产无码", "sourceRoot": "inbox/国产", "libraryRoot": "library/国产无码" },
    "western": { "enabled": true, "label": "欧美无码", "sourceRoot": "inbox/欧美", "libraryRoot": "library/欧美无码" }
  }
}
```

---

## 4. Web UI 设计规范（完整参考 MDC-NG）

> 本章为 MDCS 前端实现的**权威 UI 规格**。字段名、控件类型、布局结构对齐 MDC；差异处标注 **【MDCS】**。

### 4.0 全局布局与交互共性

#### 4.0.1 页面骨架

```text
┌─────────────────────────────────────────────────────────────┐
│ 顶栏：产品名 MDCS + 版本                                     │
├──────────┬──────────────────────────────────────────────────┤
│ 侧栏导航  │  主内容区                                         │
│          │  ┌─ 页面标题 ────────────────────────────────┐   │
│  主界面   │  │ 工具栏（搜索/筛选/主操作按钮）              │   │
│  手动任务 │  ├─────────────────────────────────────────────┤   │
│  刮削记录 │  │ 列表 / 表单 / Tab 内容                      │   │
│  演员管理 │  │                                             │   │
│  文件管理 │  └─────────────────────────────────────────────┘   │
│  ─系统─   │  右下角固定：保存修改 / 保存更改                    │
│  数据源   │                                                  │
│  设置     │                                                  │
│  ─────   │                                                  │
│  宽屏模式 │                                                  │
│  切换主题 │                                                  │
│  帮助     │                                                  │
│  用户区   │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

#### 4.0.2 表单行交互模式（MDC 共性）

| 模式 | 说明 |
|------|------|
| 左标签 + 灰色说明 | 标签左对齐，右侧控件；说明文案灰色小字 |
| 目录字段 | 路径输入框 + **文件夹选择器** 按钮 |
| Tag 列表 | 多值字段：`Tag 列表 + 添加`；支持删除单个 Tag |
| 模板字段 | 输入框旁 **✨ 变量选择**；配置 LLM 后支持 **AI 辅助生成** |
| 保存动作 | 每 Tab 页右下角 **「保存修改」**；命名页额外 **导出 / 导入 / 命名测试** |
| 水印页 | 左侧表单 + 右侧 **实时预览区** +「显示全部水印」开关 |

#### 4.0.3 MDCS 与 MDC 的全局差异

| 项 | MDC | MDCS |
|----|-----|-------|
| 路径模型 | 单库整理目录 | **七路径** `sourceRoot` / `libraryRoot` 各配 |
| 整理模式 | 硬链 / 软链 / 原地 | **复制 / 移动 / 硬链接** 三选一 |
| 分类数 | 6 类 + 里番/未知 | **7 KindId** + 未知（Webhook 可保留里番扩展） |
| 演员管理 | 完整 Emby 联动 | **Phase 4 后置**，UI 预留入口 |
| 分区配置入口 | 无独立七区页 | **【MDCS】** 可在「整理 Tab」或独立「路径配置」子页按 Kind 切换 |

---

### 4.1 侧栏导航

```text
MDCS
├── 主界面
├── 手动任务
├── 刮削记录
├── 演员管理          ← Phase 4，先占位
├── 文件管理
├── ── 系统 ──
│   ├── 数据源
│   └── 设置
├── 开启宽屏模式
├── 切换主题
├── 帮助
└── 用户区
```

| 入口 | 路由（建议） | 职责 |
|------|-------------|------|
| 主界面 | `/` | Dashboard：线程、统计、最近活动 |
| 手动任务 | `/tasks` | 任务 CRUD、高级设置 |
| 刮削记录 | `/records` | 历史记录列表 + 详情 |
| 演员管理 | `/actors` | 后置；空状态「暂无数据」 |
| 文件管理 | `/files` | 扫描模式 / 文件树模式 |
| 数据源 | `/sources` | Provider + 优先级 |
| 设置 | `/settings/:tab` | 11 个 Tab |

---

### 4.2 主界面（Dashboard）

参考 MDC §18.8。

#### 4.2.1 页面标题

- 可展示自定义文案（如「下午茶时间」）或系统默认欢迎语

#### 4.2.2 运行状态卡片区（4 卡横排）

| 卡片 | 示例文案 | 数据字段 | **【MDCS】** |
|------|----------|----------|---------------|
| 刮削线程 | `0/5 空闲` | `scrapeActive/scrapeMax` | 可点击下钻任务页 |
| 手动任务线程 | `0/1 空闲` | `manualActive/manualMax` | — |
| 入库记录 | `83051 最近新增` | `totalDone/recentDelta` | 按七路径汇总 |
| 演员 | `0 位老师` | `actorCount` | Phase 4 后置，可先隐藏或置 0 |

卡片区下方汇总行：

```text
跳过: 0    成功: 83051    失败: 2604
```

可选：`+n 对比上周` 链接（入库记录、演员卡）

#### 4.2.3 最近活动表格

| 列 | 字段 | 说明 |
|----|------|------|
| # | `id` | 记录序号 |
| 番号 | `code` | 可点击进详情 |
| 标题 | `title` | 截断展示 |
| 演员 | `actors` | 首位或拼接 |
| 来源 | `source` | 链接样式 Tag（如「监控」「手动任务」） |
| 年份 | `year` | — |
| 添加日期 | `createdAt` | `YYYY/M/D HH:mm:ss` |

**【MDCS】** 增加隐藏列 `kind`（日本有码/写真等），可在表头筛选。

---

### 4.3 手动任务页

参考 MDC §18.2。

#### 4.3.1 列表页布局

**工具栏（上）**

| 控件 | 类型 | 说明 |
|------|------|------|
| 搜索框 | 文本 | 按目录/番号模糊搜 |
| 任务状态 | 下拉 | 全部 / 进行中 / 完成 / 失败 / 已取消 |
| 创建任务 | 主按钮 | 右上角 |
| 批量删除 | 次按钮 | 需勾选行 |

**表格列**

| 列 | 说明 |
|----|------|
| ☑ | 批量选择 |
| 扫描目录 | 本次任务输入路径；**【MDCS】** 可显示 `kinds[]` Tag |
| 整理目录 | 目标根或「按分区 libraryRoot」 |
| 整理模式 | Tag 样式：硬链接 / 复制 / 移动 |
| 创建时间 | — |
| 用时 | 运行时长 |
| 进度 | `成功 / 跳过 / 错误 / 总数` |
| 状态 | 进行中 / 完成 / 失败 |
| 操作 | 下拉：暂停 / 继续 / 取消 / 详情 / 删除 |

**分页**：`← 上一页` / 页码 / `下一页 →`

#### 4.3.2 创建任务弹窗「创建手动任务」

| 字段 | 控件 | 说明 |
|------|------|------|
| 刮削路径 | 输入 + 清除 | 单次任务扫描根路径 |
| 整理目录 | 输入 + 清除 | 可留空=按分区 `libraryRoot` |
| 整理模式 | 下拉 | 硬链接 / 复制 / 移动 |
| 目标路径 | 多选 **【MDCS】** | 七路径 Checkbox 或「全部已启用」 |
| 配置复用 | 下拉 | 不复用 / 复用上次 / 复用预设 |
| 任务模式 | 下拉 **【MDCS】** | full / scan_only / scrape_only / organize_only |
| dry-run | 开关 **【MDCS】** | 仅预览不写盘 |

**底部按钮**：`取消` | `高级设置` | `创建`

#### 4.3.3 高级设置弹窗「手动任务 - 高级设置」

- **形态**：Modal，内嵌二级 Tab，**不修改全局配置**
- **Tab 列表**：`整理` | `下载` | `命名` | `水印` | `元数据` | `NFO` | `数据源`
- **各 Tab 共性**：顶部 `使用全局配置` 开关（默认开）；关闭后展开与对应设置 Tab **同构** 的字段子集
- **底部**：`保存修改` | `关闭`

| 高级 Tab | 可覆盖字段（关闭「使用全局配置」后） |
|----------|--------------------------------------|
| 整理 | 整理目录、整理模式、覆盖策略、扫描过滤（不含自动清理） |
| 下载 | 下载内容、缩略图策略、高清海报、裁剪、字幕库 |
| 命名 | 目录/视频/图片命名规则、字段映射、后缀 |
| 水印 | 启用水印、样式、布局、类型、固定位置 |
| 元数据 | 严格模式、映射、自动翻译 |
| NFO | 各 NFO 字段开关与附加标签 |
| 数据源 | 本任务专用源链覆盖（可选） |

任务执行时合并：`effectiveConfig = globalConfig ⊕ taskOverride`；任务结束不持久化覆盖。

---

### 4.4 刮削记录页

参考 MDC §18.3。

#### 4.4.1 列表页

| 控件 | 说明 |
|------|------|
| 搜索 | 编号、目录、演员 |
| 任务状态 | 下拉筛选 |
| 路径分类 **【MDCS】** | 七 Kind 多选 |
| 批量操作 | 重试 / 删除 |

**表格列（建议）**：番号 | 标题 | 演员 | 路径分类 | 状态 | 添加时间 | 操作

#### 4.4.2 详情页（左右分栏）

**顶栏**：`← 返回列表` | `上一条` / `下一条`

**左侧 · 详细数据**（每项带 **来源 Tag**）

| 字段组 | 字段 |
|--------|------|
| 标识 | 编号、发行码、路径分类 |
| 文本 | 标题、原标题、简介 |
| 人员 | 演员、导演 |
| 元数据 | 标签、系列、片商、发行商 |
| 媒体 | 封面 URL、海报 URL、时长 |
| 日期 | 发行日期、年份 |
| 文件 | 源路径、目标路径 |

**右侧 · 刮削日志**（时间线）

| 阶段 | 展示 |
|------|------|
| 解析编号 | 成功/失败 + 识别结果 |
| 刮削数据 | 各源耗时、字段来源 |
| 创建目录 | 模板路径 |
| 下载图片 | poster/thumb/fanart |
| 转移文件 | organizeMode + 目标 |
| 生成 NFO | 字段写入清单 |

---

### 4.5 文件管理页

参考 MDC §18.5。标题旁 **模式切换** 按钮。

#### 4.5.1 模式 A：文件扫描

| 区域 | 控件 |
|------|------|
| 标题 | `文件扫描` + 切换「文件树模式」 |
| 路径栏 | `请输入扫描路径` + 📁 + `扫描` |
| 右上 | `已选中 N 个条目` + `+ 创建任务` |
| 表格 | ☑ \| 名称 \| 修改时间 \| 文件大小 \| 操作 |

扫描后选中条目 → `创建任务` 带入路径与 `kinds` 推断。

#### 4.5.2 模式 B：文件管理（文件树）

| 区域 | 控件 |
|------|------|
| 标题 | `文件管理` + 切换「扫描模式」 |
| 过滤 | `关键字过滤` |
| 右上 | `已选中 N 个条目` + `+ 创建任务` |
| 表格 | ☑ \| 名称（文件夹图标）\| 修改时间 \| 文件大小 \| 操作（+） |
| 分页 | `← 上一页` 1 2 `下一页 →` |

**【MDCS】** 可从 `index/` 只读目录树浏览（外部服务生成），绑定到七路径 `sourceRoot`。

---

### 4.6 数据源管理页

参考 MDC §18.6。

#### 4.6.1 Provider 卡片网格

- 每个站点一张卡片：名称、开关、最近探活状态（绿/红/灰）
- 点击卡片可查看 capability 字段列表

#### 4.6.2 全局设置

| 区块 | 字段 |
|------|------|
| 重试设置 | 全局失败重试次数、单源超时 |
| 自定义识别词 | 按分类添加规则（Tag + 添加） |

**识别词分类（MDCS 七路径 + MDC 兼容）**

| 分类 | KindId |
|------|--------|
| 有码 | `japan_censored` |
| 写真 **【MDCS】** | `japan_gravure` |
| 无码 | `japan_uncensored` |
| 素人 | `japan_amateur` |
| FC2 | `fc2` |
| 国产 | `china` |
| 欧美 | `western` |

#### 4.6.3 优先级设置（全局）

说明文案：*将番号类型与刮削源匹配；多源聚合时按优先级选取。*

每行：左侧分类名 + 右侧 **可排序 Tag 源链** + 下拉展开编辑。

| 分类 | 默认源链示例（色花种子） |
|------|-------------------------|
| 有码番号 | Dmm, Mgstage, Javlibrary, Avbase, Hbox_jp, Javdb, Javbus, Jav321, Avmoo, Mmtv, Airav_io, Freejavbt, Miss_av |
| 写真番号 **【MDCS】** | 默认同有码；可独立配置 |
| 无码番号 | Carib, Avbase, Javbus, Javdb, Avsox, Mmtv, Airav_io, Freejavbt, Miss_av |
| 素人番号 | Mgstage, Carib, Javlibrary, Avsox, Avmoo, Javbus, Javdb, Jav321, Mmtv, Airav_io, Freejavbt, Miss_av |
| FC2 番号 | Fc2, Fc2_hub, Javdb, Avsox, Mmtv, Airav_io, Freejavbt, Miss_av |
| 国产番号 | Madouqu, Madou, Xiao_huang_shu, Mmtv |
| 欧美影片 | ThePornDB |

#### 4.6.4 优先级设置（字段）

说明：*字段优先级中的源未获取到数据时，回退全局优先级。*

右上角：`隐藏未配置字段` 开关。

| 字段 | 默认源链示例 |
|------|-------------|
| 标题 Title | Airav_io, Miss_av, Mmtv |
| 原标题 OriginalTitle | Dmm, Mgstage |
| 简介 Outline | Airav_io, Miss_av, Mmtv |
| 封面 Cover | Dmm, Mgstage |
| 海报 Poster | Dmm, Mgstage, Hbox_jp |
| 剧照 ExtraFanart | Javbus, Avbase, Freejavbt |
| 标签 Tags | Javbus, Avbase, Freejavbt |
| 用户评分 UserRating | Dmm, Jav321 |

底部：**屏蔽刮削源（字段）** — 按字段屏蔽特定 Provider。

---

### 4.7 设置页（11 Tab）

设置页顶栏 Tab 顺序（与 MDC 一致）：

`整理` | `监控` | `下载` | `命名` | `水印` | `网络` | `元数据` | `NFO` | `演员` | `系统` | `Webhook`

---

#### 4.7.1 整理 Tab

##### 路径 **【MDCS 本土化】**

MDC 为单库「整理目录」；MDCS 改为 **七路径分区表**：

| 字段 | 必填 | 说明 | 控件 |
|------|------|------|------|
| 路径分类 | — | Kind 标签页或下拉切换 | Tab: 7 Kind |
| 来源目录 sourceRoot | 是 | 该区输入 | 路径 + 目录选择 |
| 输出目录 libraryRoot | 是 | 该区输出 | 路径 + 目录选择 |
| 启用 | — | 分区开关 | Switch |
| 刮削出错时删除元数据目录 | — | 失败清理 | Switch |

##### 整理模式

单选三选一（**不含** MDC 软链/原地）：

| 模式 | 值 | 行为摘要 |
|------|-----|----------|
| 硬链接 | `hardlink` | 同盘零拷贝；跨盘可配 fallback |
| 复制 | `copy` | 保留源文件 |
| 移动 | `move` | 源文件删除 |

每项带灰色说明文案；支持 **全局默认 + 按 Kind 覆盖**。

##### 覆盖策略

| 字段 | 默认 | 说明 |
|------|------|------|
| 覆盖目标目录视频和字幕 | 开 | 目标已有视频/字幕时覆盖 |
| 覆盖目标目录图片 | 开 | 目标已有图片时覆盖 |

##### 扫描 / 识别过滤

| 字段 | 说明 | 控件 | 示例值 |
|------|------|------|--------|
| 文件大小过滤 (MB) | 小于此体积忽略；影响目录监控与文件搜索 | 数字 | `100` |
| 文件类型白名单 | 仅列表内后缀视为视频 | Tag + 添加 | mp4, avi, rmvb, wmv, mov, mkv, webm, iso, mpg, m4v, ts, flv, strm, vob, m2ts |
| 文件名黑名单 | 文件名含条目则忽略 | Tag + 添加 | （空） |
| 文件名垃圾信息过滤 | 解析番号时剔除垃圾串；逗号分隔；正则以 `r:` 开头 | Tag + 添加 | 2048论坛@…, 1080p, 720p, sht.me, -HD, bbs2048.org@, … |
| 破解关键词 | 识别无码破解；匹配文件名与完整路径，不区分大小写 | Tag + 添加 | uncensored, 破解 |

**【MDCS 可选】** 元数据目录：视频以外文件（NFO/图片）整理到独立目录；路径输入 + 目录选择。

##### 自动清理源目录

> ⚠ 操作有风险，**MDCS 默认关闭**

| 字段 | 说明 |
|------|------|
| 总开关 | 刮削完成后按规则删除源目录文件 |
| 开启白名单保护 | 视频 + 补充白名单不删 |
| 删除小文件 | 按体积规则 |
| 删除非白名单类型 | — |
| 删除黑名单 | — |
| 文件类型白名单（补充） | Tag + 添加 |

---

#### 4.7.2 监控 Tab

| 字段 | 控件 |
|------|------|
| 启用目录监控 | 总开关 |
| 监控模式 | 下拉：性能模式 / 兼容模式 |
| 监控目录 | 列表；每条：路径 + 目录选择 + **设置** + **移除** + `+` |

**监控模式**

| 模式 | 说明 |
|------|------|
| 性能模式 | 实时 FS 事件；要求原生目录 |
| 兼容模式 | ~30s 轮询；兼容 SMB/NFS |

**【MDCS】** 监控目录可绑定 `kinds[]`，新文件自动路由分区。

---

#### 4.7.3 下载 Tab

##### 下载内容（多选）

资源类型来自刮削源：

| 选项 | 默认 | 说明 |
|------|------|------|
| 海报/封面图 poster | ✅ | — |
| 缩略图 thumb（建议开启） | ✅ | — |
| 背景图 fanart | ☐ | — |
| 剧照 extrafanart | ☐ | — |
| behind the scenes | ☐ | — |
| 预告片 trailer | ☐ | — |

##### 缩略图策略

| 策略 | 说明 |
|------|------|
| 根据字段优先级（默认） | 按数据源优先级 |
| 根据图片质量 | 比体积选最大（较慢） |

##### 高清海报

| 字段 | 说明 |
|------|------|
| Amazon 高清海报 | 标题搜 Amazon JP；~1778×2529 |
| Tenhow 高清海报 | 演员搜 Tenhow；~1055×1500 |
| 严格模式 | Amazon 503 时不继续 |

##### 海报裁剪（按 Kind **【MDCS】**）

| 分区 | 默认策略 |
|------|----------|
| 日本有码 | 右侧裁剪 |
| 日本写真 | 不裁剪 / 人脸识别 |
| 日本无码 | 不裁剪 |
| 日本素人 | 人脸识别 |
| FC2 | 人脸识别 |
| 国产 | 不裁剪 |
| 欧美 | 不裁剪 |

| 字段 | 默认 |
|------|------|
| 裁剪比例 | 完整海报 |
| 独立海报裁剪 | ☐ |
| 优先选择裁剪结果 | ✅ |

##### 字幕

| 字段 | 控件 |
|------|------|
| 本地字幕库 | 目录设置 + 文件夹选择 |
| 说明 | 分层目录；`ABC-123.xxx` |

---

#### 4.7.4 命名 Tab

长表单 + 模板语法文档。底部固定：**导出 | 导入 | 命名测试 | 保存修改**

##### 模板语法

| 语法 | 示例 | 缺失行为 |
|------|------|----------|
| `{field}` | `{number}` | 显示「未知」 |
| Jinja2 | `{{ number }}` | 空字符串 |

常用 Filter：`default` / `upper` / `lower` / `truncate` / `split` / `replace` / `trim`  
条件：`{% if publish_number %}({{ publish_number }}){% endif %}`

**实用示例**：

- 有值才加括号：`{{ number }}{% if publish_number %} ({{ publish_number }}){% endif %}`
- 多级回退：`{{ actor | default(studio | default("未知")) }}`
- 目录层级：`{{ category }}/{{ number | split("-") | first }}/{{ number }}`

**AI 辅助**：✨ 按钮 → 自然语言生成 Jinja2（需系统 Tab 配 LLM）

##### 可用变量

`number`, `publish_number`, `series_name`, `serial_number`, `first_letter`, `series`, `category`, `actor`, `first_actor`, `title`, `originaltitle`, `year`, `director`, `studio`, `publisher`, `runtime`, `release`, `source_filename`, `source_path`, `subtitle`, `mosaic`, `resolution`

##### 核心命名规则

| 字段 | 示例 |
|------|------|
| 目录命名规则 | `{series_name}/{number}` |
| 目录最大长度 | `0` |
| Emby/Plex 标题 | `{title}` |
| 视频命名规则 | `{number}` |
| 图片命名规则 | 不添加前缀 |
| 演员显示上限 | `3` |

##### 分类 `{category}` 映射 **【MDCS 七路径】**

| 内部分类 | 默认写入值 |
|----------|------------|
| 日本有码 | 日本有码 |
| 日本写真 **【MDCS】** | 日本写真 |
| 日本无码 | 日本无码 |
| 素人 | 素人 |
| FC2 | FC2 |
| 国产 | 国产 |
| 欧美 | 欧美 |
| 未知 | 未知 |

自定义分类规则：源路径或番号匹配正则时覆盖 `{category}`；优先于上表；按顺序首条命中；`+ 添加规则`。

##### 字段 · 马赛克 `{mosaic}`

| 检测类型 | 命名规则替换值 |
|----------|----------------|
| 无码破解 | 无码破解 |
| 无码流出 | 无码流出 |
| 无码 | 无码 |
| 有码 | 有码 |

##### 字段 · 中文字幕 `{subtitle}`

| 字段 | 说明 | 示例 |
|------|------|------|
| 字幕字段配置 | 检测到中文字幕时替换 `{subtitle}` | 中字 |
| 无字幕字段配置 | 无中文字幕时替换 | 无字幕 |

##### 字段 · 分辨率 `{resolution}`

| 字段 | 说明 | 示例 |
|------|------|------|
| 分辨率字段配置 | 自动检测分辨率替换 `{resolution}` | 留空则用 `{resolution_text}` |
| 分辨率显示方式 | 替换 `{resolution_text}` | `720P, 1080P, 4K, 8K` |
| 生效的分辨率类型 | 关闭则该档位用「未生效」值 | 720P/1080P/4K/8K 复选 |
| 未生效分辨率字段配置 | 不在生效列表时用此值 | `1080P` |

**分辨率信息获取方式**（单选）：

| 模式 | 说明 |
|------|------|
| 优先使用视频真实分辨率 | 读文件实际分辨率 |
| 优先使用文件名和路径中信息（默认） | 从路径/文件名关键词如 4K、1080p 判断 |
| Fallback 模式 | 主方式无效时是否尝试其他方式 |

##### 视频命名后缀

后缀追加在文件名后，支持 `{mosaic}` `{resolution}` `{subtitle}`；字段缺失则忽略该段。

**后缀 · 马赛克**：

| 类型 | 后缀值（可留空=不追加） |
|------|------------------------|
| 无码破解 | `-破解` |
| 无码流出 | `-流出` |
| 无码 | 留空 |
| 有码 | 留空 |

**后缀 · 中文字幕**：

| 字段 | 说明 |
|------|------|
| 字幕字段配置 | 有中字时替换 `{subtitle}`；留空不追加 |
| 为字幕添加 .chs 后缀 | ✅ 在扩展名前加 `.chs`，如 `ABC-123.chs.srt` |

**后缀 · 分集**：

| 字段 | 说明 | 示例 |
|------|------|------|
| 分集后缀模板 | 多分集时追加；`{part}`=1,2,3；`{part_letter}`=A,B,C | `-cd{part}` |

**后缀 · 分辨率**：同分辨率字段逻辑，作用于后缀规则中的 `{resolution}`。

**命名测试弹窗**：输入样例 meta JSON → 预览目录名/文件名/Emby 标题。

---

#### 4.7.5 水印 Tab

左侧表单 + **右侧预览区**。

##### 总开关与样式

| 字段 | 默认 |
|------|------|
| 启用水印 | ✅ |
| 水印样式 | 默认 |
| 水印样式 (4K, 8K) | 默认 |
| 自定义水印目录 | 路径 + 目录选择 |

自定义目录 PNG 命名：`youma.png` / `wuma.png` / `umr.png` / `leak.png` / `sub.png` / `4k.png` / `8k.png`

##### 布局

| 字段 | 默认 |
|------|------|
| 布局方式 | 堆叠 |
| 起始位置 | 左上角 |
| 缩放倍率 | `9` |
| 横向/纵向偏移 | `0` |
| 间距 | `0` |

##### 图片类型 / 水印类型

- 图片：poster ✅ / thumb ✅ / fanart ☐
- 水印：字幕 ✅ / 破解 ✅ / 流出 ✅ / 无码 ✅ / 有码 ☐ / 4K8K ✅

##### 固定位置

每种水印类型可单独指定位置（下拉），默认 **自动**：字幕、破解、流出、无码、有码、4K/8K — 均可设为「自动」或固定方位。

**预览区**：展示角标样例（如 4K ULTRA HD、字幕、破解）；**显示全部水印** 开关控制预览时是否叠展示所有启用类型。

**水印类型覆盖顺序**：有码 / 无码 / 流出 / 破解 **逐级覆盖**。

---

#### 4.7.6 网络 Tab

| 字段 | 示例 |
|------|------|
| 代理地址 | `http://192.168.x.x:7893` |
| 超时时间（秒） | `30` |
| 下载预告片超时（秒） | `120` |
| FlareSolverr 地址 | `http://host:8191/v1` |

支持 `http` / `socks5`；环境变量 `PROXY_URL` / `FLARESOLVERR_URL` 可覆盖。

---

#### 4.7.7 元数据 Tab

##### 数据校验

| 字段 | 默认 |
|------|------|
| 启用严格字段模式 | ☐ |
| 强制校验图片结果 | ☐ |

##### 元数据优化

| 字段 | 默认 |
|------|------|
| 使用色花堂中文字幕 | ✅ |
| 启用演员数据映射 | ✅ |
| 启用标签数据映射 | ✅ |
| 精简多余换行（简介） | ✅ |
| 数据映射语言 | 简体中文 |

##### 自动翻译

| 字段 | 默认 |
|------|------|
| 翻译标题 | ☐ |
| 翻译简介 | ☐ |
| 翻译引擎 | OpenAI 兼容 |
| 自定义 System Prompt | 多行文本 |

---

#### 4.7.8 NFO Tab

##### 总开关

| 字段 | 说明 | 默认 |
|------|------|------|
| 启用 NFO | 根据刮削数据生成 `.nfo` 文件 | ✅ |

##### 标题 / 简介 / 人员

| 分组 | 字段 | 默认 |
|------|------|------|
| 标题 | 类标题、原标题、标题后添加分集信息 | ✅ / ✅ / ☐ |
| 简介 | 简介 outline、简介 plot、原简介 originalplot | ✅ / ✅ / ✅ |
| 简介 | 简介后添加翻译来源信息 | ☐ |
| 人员 | 演员 actor、导演 director | ✅ / ✅ |

##### 发行日期与分级

| 字段 | 说明 | 默认 |
|------|------|------|
| 发行日期 `release` | 常规日期字段 | ✅ |
| 发行日期 `releasedate` | 日期字段 | ✅ |
| 发行日期 `premiered` | 首映字段 | ✅ |
| Tagline 格式 | 允许命名字段；示例 `发行日期: {release}` | ✅ |
| 国家 `country` | 国家字段 | ✅ |
| 分集信息 `mpaa` | 分级字段 | ✅ |
| 自定义分集 `customrating` | 自定义评级 | ✅ |

##### 年份 / 时长 / 评分

| 分组 | 字段 | 默认 |
|------|------|------|
| 年份 / 时长 / 想看人数 | `year`、`runtime`、`votes` | ✅ / ✅ / ✅ |
| 评分 | `score`、`criticrating` | ✅ / ✅ |

##### 系列 / 标签 / 风格

| 字段 | 说明 | 默认 |
|------|------|------|
| 系列 `series` | 系列字段 | ✅ |
| 标签 `tag` | 标签字段 | ✅ |
| 风格 `genre` | 使用标签数据写入 genre | ✅ |

**附加标签内容**（均为复选）：番号前缀、有码/无码、演员、系列、分辨率、片商、中文字幕、发行商。

**标签格式示例**：

| 标签类型 | 示例 |
|----------|------|
| 中文字幕 | `中文字幕` |
| 系列 | `系列: {series}` |
| 片商 | `片商: {studio}` |
| 发行商 | `发行: {publisher}` |

##### 片商 / 封面 / 合集

| 分组 | 字段 | 默认 |
|------|------|------|
| 片商 / 发行商 | `studio`、`maker`、`publisher`、`label` | ✅ / ✅ / ✅ / ✅ |
| 海报 / 封面 / 网址 | `poster`、`cover/thumb/fanart`、`trailer`、`website` | ✅ / ✅ / ✅ / ✅ |
| 合集 | 使用演员字段、使用系列字段、使用番号前缀 | ☐ / ✅ / ☐ |

---

#### 4.7.9 演员 Tab（Phase 4 后置）

UI 先按 MDC 全量实现占位，功能 Phase 4 启用。

##### Emby 配置

| 字段 | 说明 | 控件 |
|------|------|------|
| Emby 服务器地址 | 以 `http://` 或 `https://` 开头 | 文本框 |
| Emby API Key | 从 Emby 高级设置获取 API 密钥 | 密码框 |
| Emby User Id | 限定从指定用户可访问媒体库抓演员，避免搜索过多无关演员 | 文本框 |
| 选择媒体库 | 仅抓取所选媒体库内演员信息 | 下拉，默认 `全部` |

##### 自动刮削与刷新

| 字段 | 说明 | 默认 |
|------|------|------|
| 定期自动刮削 | 后台定时刮削新入库影片演员 | ☐ |
| 自动刮削范围（入库天数） | 每次仅检查最近添加项目 | `0` |
| 刮削后刷新媒体库 | 完成后自动刷新 Emby 媒体库 | ☐ |

##### 刮削选项

| 字段 | 说明 | 默认 |
|------|------|------|
| 元数据 | 下载演员元数据 | ☐ |
| 图片 | 下载演员图片 | ☐ |
| 元数据覆盖模式 | 现有数据已存在时的处理策略 | `仅刮削缺失的元数据` |

**MDCS 默认**：Tab 可见但功能标记「即将推出」。

---

#### 4.7.10 系统 Tab

##### 任务并发

| 字段 | 说明 | 示例 |
|------|------|------|
| 刮削任务线程数 | 同时并行的工作线程数 | `5` |
| 刮削任务超时（秒） | 单刮削任务超时后强制结束 | `600` |

##### OpenAI 兼容（翻译 / 命名 AI 辅助）

| 字段 | 说明 | 示例 |
|------|------|------|
| API Key | OpenAI/兼容 API 密钥 | 密码框 |
| Base URL | 兼容 OpenAI 的接口地址（如 DeepSeek） | `https://api.deepseek.com` |
| Model | 模型名称 | `gpt-4o` |
| 测试连接 | 验证配置是否可用 | 按钮 |

---

#### 4.7.11 Webhook Tab

##### 总开关

启用 Webhook：任务完成或失败时发送 HTTP 通知。

##### Endpoint 卡片（可多条，`+ 添加 Endpoint`）

| 字段 | 控件 | 说明 |
|------|------|------|
| 名称 | 文本 | `New Endpoint` |
| 请求方式 | 下拉 | POST |
| URL | 文本 | 支持 `{{number}}` 等模板 |
| 触发事件 | 复选 | finished ✅ / failed ☐ |
| 触发分类 | 复选 | 见下表；不选=全部 |
| 高级触发条件 | 折叠 | 扩展 |
| Headers | KV 列表 | `+ 添加请求头` |
| Body 模板 | JSON 多行 | Jinja2 |
| 超时（秒） | 数字 | `10` |
| 测试连接 | 按钮 | — |
| 自定义测试变量 | 折叠 | 模拟 payload |
| 删除 | 🗑 | 卡片右上角 |

**触发分类（MDCS 七路径 + MDC 扩展）**

| 选项 | KindId |
|------|--------|
| 日本有码 | japan_censored |
| 日本写真 **【MDCS】** | japan_gravure |
| 日本无码 | japan_uncensored |
| 素人 | japan_amateur |
| FC2 | fc2 |
| 国产 | china |
| 欧美 | western |
| 里番 | （扩展，可选） |
| 未知 | unknown |

**Body 变量**

| 分组 | 变量 |
|------|------|
| 事件 | event, timestamp, started_at |
| 任务 | task_id, duration, source_path, target_path, error_message |
| 刮削 | number, title, actor, category, tags, outline, thumb, poster, … |

```json
{
  "event": "{{ event }}",
  "data": { "title": "{{ title }}" }
}
```

底部：**保存更改**

---

### 4.8 演员管理页（占位）

参考 MDC §18.4。

| 控件 | 说明 |
|------|------|
| 搜索 | 按演员名 |
| 任务状态 | 下拉筛选 |
| 表格列 | 序号/头像、状态、背景图、详情信息、创建时间/完成时间、错误信息、操作 |
| 空状态 | 「暂无数据」 |

Phase 4 实现；P1 保留侧栏入口与空状态页。

---

### 4.9 MDC → MDCS UI 映射总表

| MDC 页面/字段 | MDCS 落点 | 阶段 | 备注 |
|---------------|------------|------|------|
| 侧栏 IA | 一致 | P1 | 演员占位 |
| 主界面 Dashboard | `/` | P1 | + kind 筛选 |
| 手动任务 + 高级设置 | `/tasks` | P1 | + kinds[]/dry-run |
| 刮削记录详情 | `/records/:id` | P2 | 字段来源时间线 |
| 文件管理双模式 | `/files` | P1 | index 只读树 |
| 数据源 Provider/优先级 | `/sources` | P2 | + 写真源链 |
| 设置 · 整理 | `/settings/organize` | P1 | 七路径表 |
| 设置 · 监控 | `/settings/watch` | P4 | — |
| 设置 · 下载/裁剪 | `/settings/download` | P2/P3 | byKind 裁剪 |
| 设置 · 命名 | `/settings/naming` | P3 | Jinja2+测试 |
| 设置 · 水印 | `/settings/watermark` | P3 | 预览区 |
| 设置 · 网络 | `/settings/network` | P1 | — |
| 设置 · 元数据/NFO | `/settings/meta` `/nfo` | P3 | — |
| 设置 · 演员 | `/settings/actors` | P4 | 后置 |
| 设置 · 系统 | `/settings/system` | P2 | LLM |
| 设置 · Webhook | `/settings/webhook` | P4 | 全字段 |
| 软链/原地整理 | — | — | **不采纳** |
| 自动清理源目录 | 默认关 | P4 | 高风险 |

---

## 5. 后端架构（摘要）

### 5.1 刮削引擎

- **Provider 注册表** + Parser 纯函数；目录见 §10.2 `SOURCE_CATALOG`
- **双通道 FAST/SLOW**：快通道跳过 `proxy_flare` 源；慢通道处理 `needs_flare`（色花 `scrape.ts`）
- **字段按需**：按 `fieldPriority` / `kindProfiles.fieldPriority` 拉字段，不全量爬详情页
- **网络四级回退**：proxy → cf_cache → curl-impersonate → FlareSolverr；每源 `access` 模式见 §10.3
- **字段级合并** + `fieldSources` / `fieldTimings` / `sourceRuns` 供刮削记录 UI 展示
- **合并语义**：字段优先级列表**非空**时仅用该列表（不回退全局，对齐 Javinizer #105）；**空数组**=继承全局/kind 链

### 5.2 识别与分类

- **Identify**：文件名 → `code` + `cdIndex`（分集）；规则集以 JavSP `avid.py` 为上限目标，P1 仅 FC2/标准番号（见 §10.4）
- **Classify**：路径 + 识别词 + 破解关键词 → `KindId` + `mosaic`（有码/无码/破解/流出）
- **preferLocal**：论坛/本地种子（标题/演员/简介）作刮削前填充，不覆盖网络 poster（色花 `ScrapeRequest`）

### 5.3 文件状态机

```text
pending → scraping → scraped → planned → organizing → done
   └───────────────────────────────→ failed
skipped：mtime 未变且已 done
```

### 5.4 任务模式

| mode | 行为 |
|------|------|
| scan_only | 只索引 |
| scrape_only | 只刮削 |
| organize_only | 只整理（可 dry-run） |
| full | 全流程 |
| rescan | 强制重扫变更文件 |

### 5.5 20 万规模策略

增量跳过、断点续刮、同番号缓存、分批 DB 写入、失败隔离、资源上限（Scrape ≤8，Organize ≤16）。

---

## 6. 数据模型（摘要）

### KindProfile

`sourceRoot`, `libraryRoot`, `organizeMode`, `enabled`, `label` + scrape 侧重：`metaSources`, `coverSources`, `fieldPriority`, `directoryTemplate`, `posterCrop`

### ScrapeMeta（完整字段，对齐色花 `apps/scrape/src/types.ts`）

| 字段 | 说明 |
|------|------|
| `code`, `title`, `titleZh`, `originalTitle`, `plot` | 标识与文本 |
| `premiered`, `runtime`, `userRating`, `director`, `series` | 元数据 |
| `publisher`, `studio`, `makers`, `actors`, `genres` | 人员与标签 |
| `productId` | DMM CID / 发行码 |
| `poster`, `portrait`, `fanart` | 远程图片 URL |
| `coverLocal`, `posterLocal` | 本地路径 |
| `source`, `scrapeKind`, `sourcesTried` | 来源追踪 |
| `sourceRuns[]`, `fieldSources`, `fieldTimings` | 可观测性（刮削记录详情） |
| `scrapedAt`, `ok`, `message` | 状态 |

### Job

`id`, `kinds[]`, `mode`, `dryRun`, `options`（任务覆盖）, `byKind` 进度

### ScrapeMeta

继承色花字段 + `fieldSources`, `sourceRuns`, `scrapeKind`

---

## 7. API 设计（目标态）

| 分组 | 端点 |
|------|------|
| 健康 | `GET /health` |
| 七路径 | `GET/PUT /api/kinds`, `GET/PUT /api/kinds/:id`, `POST .../scan`, `GET .../folders` |
| 任务 | `POST/GET /api/jobs`, `GET /api/jobs/:id`, pause/resume/cancel |
| 文件/记录 | `GET /api/files`, `GET /api/files/:id`, `POST .../retry` |
| 刮削 | `GET/PUT /api/scrape/config`, `POST /api/scrape` |
| 系统 | `GET/PUT /api/config/system`, `.../network`, `.../webhook`, `POST .../webhook/test` |
| 实时 | `WS /api/events`, `WS /api/jobs/:id/stream` |

统一响应：`{ ok, data?, message? }`

---

## 8. 实施路线

详细逐步清单见 **[`ROADMAP.md`](ROADMAP.md)**（S0 地基 → S6 交付）。阶段摘要：

| 阶段 | UI 交付 | 后端交付 |
|------|---------|----------|
| **S0–S1** | 文档/契约 + MDC 壳与路由 | 配置类型、白名单、统一 API |
| **S2** | Dashboard/任务/文件/整理·网络 | 扫描与任务闭环 |
| **S3** | 记录详情 + 数据源全量 | 多源 + 双通道 + 字段优先级 |
| **S4** | 下载/命名/水印/NFO | Organize + NFO + 裁剪 |
| **S5** | 监控/Webhook/演员 | 目录监控 + 通知 |
| **S6** | UX/文案扫街 | 压测、发布、v1.0 |

---

## 9. 风险

站点改版、代理/Flare 不可用、路径误配置、大任务中断 — 分别用 fixture 测试、探活降级、dry-run、SQLite 断点续跑应对。

---

---

## 10. 参考项目能力对照与补全清单

> 路径：`references/`（8 个项目）。**只读参考，零运行时依赖**（MEMORY 决策）。

### 10.1 项目定位总表

| 项目 | 定位 | MDCS 借鉴层级 | 不采纳 |
|------|------|----------------|--------|
| **sehua-next-web** | 七路径 Web + 刮削引擎 | **引擎主参考**（Provider/双通道/字段合并） | 运行时接入 |
| **mdcx-diy** | PyQt 桌面刮削整理 | 网络过盾、Amazon 海报跳过、演员/标签映射 | 软链/原地整理 UI |
| **JavSP** | Python CLI 刮削 | **番号识别规则**、按类型源链、genre 规范化、人脸裁剪 | CLI 形态 |
| **javinizer-go** | Go 刮削+整理+Web | NFO 合并、revert、安全目录白名单、genre DB | 原地整理默认 |
| **JavSP-Web** | JavSP Web 壳 | 配置预设、qB/Emby 联动（P4） | 独立产品形态 |
| **javbus-api** | JavBus 自托管 API | Provider 适配器模式、区域限制文档 | 无 DB 实时解析作主存储 |
| **javspider_stack** | JavBus 本地库+磁力 | 封面本地化、任务队列 WS | **磁力管理**非 MDCS 主目标 |
| **jellyfin-jav-scraper** | Jellyfin 插件 | 简单番号 Regex、源链回退顺序 | 插件部署形态 |

### 10.2 Provider 目录（色花 `SOURCE_CATALOG`）

MDCS 目标态 Provider 与色花对齐（25 源），每源带 `defaultUrl` / `probePath` / `access`：

| access | 行为 |
|--------|------|
| `direct` | 直连 |
| `proxy` | 代理直连 |
| `proxy_flare` | 代理 + FlareSolverr |
| `proxy_adaptive` | 先直连/代理，遇盾再 Flare |

**源 ID 清单**：dmm, mgstage, libredmm, javlibrary, avbase, javbus, javdb, jav321, avmoo, sevenmmtv, iqqtv, airav, airav_io, freejavbt, miss_av, carib, avsox, fc2, fc2_hub, fd2ppv, madou, madouqu, xiao_huang_shu, theporndb

分组（色花）：`av` / `fc2` / `chinese` / `other`。无 `forum` Provider（论坛标题走本地 `forum_titles.json`）。

**JavSP 补充源（P3 可选）**：fanza, arzon, **arzon_iv**（写真/IV）, gyutto, dl_getchu, fc2ppvdb, njav, prestige

**javbus-api**：可作为 `javbus` Provider 的**可选 sidecar**（自托管解析层），注意美国 IP 会跳转登录页。

### 10.3 双通道刮削规格（色花）

配置键：`exportFastConcurrency` / `exportSlowConcurrency`（或 `scrape.json` 同名）

| 通道 | 源集合 | 行为 |
|------|--------|------|
| FAST | 非 `proxy_flare`、已验证快源 | 并行 meta/cover；超时短 |
| SLOW | `needs_flare` 标记的条目 | 过盾源补刮；可复用 Flare 会话 |

**站点镜像**：色花 `siteMirror.ts` — Provider 多域名 failover，MDCS P2 纳入。

**FlareSolverr 运维 API**（色花已有）：测试连接 / 回收会话 / 重启 — 对齐 MDC 网络 Tab + 系统探活。

### 10.4 番号识别补全路线（JavSP `avid.py`）

当前 MDCS `identify.ts` 仅 FC2 + 标准 `ABC-123`。**P2 起按优先级扩展**：

| 规则 | 示例 | 来源 |
|------|------|------|
| FC2-PPV | `FC2-1234567` | JavSP / MDCS 已有 PPV 变体 |
| HEYDOUGA | `heydouga-4011-123` | JavSP |
| GETCHU / GYUTTO | `GETCHU-123`, `GYUTTO-456` | JavSP |
| 259LUXU | `259LUXU-123` | JavSP |
| 无分隔符 | `ABP123` → `ABP-123` | JavSP |
| 域名剥离 | 去 `xxx.COM` 后再匹配 | JavSP |
| MUGEN / IBW / TMA | 特殊厂商前缀 | JavSP |
| 分集 | `cdIndex` → 命名后缀 `-cd{part}` | MDCS 已有 / MDC §10.8 |

**写真 Kind**：参考 JavSP `arzon_iv.py` + 色花 `japan_gravure` 路径识别词。

### 10.5 字段优先级语义（Javinizer + 色花）

| 配置状态 | 行为 |
|----------|------|
| 字段列表 **空** `[]` | 继承全局 kind 链 → 再继承 kind 默认链 |
| 字段列表 **非空** | **仅**用该列表，不回退（避免与用户预期冲突） |
| 全局 kind 链 miss | 回退 `fieldPriority` 全局默认 |

UI 数据源页「屏蔽刮削源(字段)」= 字段链内剔除 Provider。

### 10.6 NFO / 整理 / 产物（多项目收敛）

| 能力 | 参考 | MDCS 阶段 | 说明 |
|------|------|------------|------|
| NFO 字段可选写入 | MDC §14 + JavSP `nfo.py` | P3 | Kodi/Emby 兼容 |
| NFO 合并策略 | Javinizer `prefer_nfo` / `prefer_scraped` | P3 | 重刮时不盲目覆盖本地 |
| `uniqueid` num/cid | JavSP | P3 | Emby 去重 |
| genre_norm 规范化 | JavSP | P3 | 标签映射库 |
| 演员/标签静态映射 | mdcx info DB + 色花堂字幕 | P3 | 对齐 MDC 元数据 Tab |
| 海报裁剪 face/right/none | 色花 `posterCrop.byKind` + JavSP slimeface | P3 | kindHints 见色花 `app.json` |
| 水印叠加 | JavSP `image.py` + mdcx 裁剪工具 | P3 | MDC 水印 Tab |
| Amazon/Tenhow 高清海报 | MDC §6.3 + mdcx skip 逻辑 | P3 | 已有 DMM 大图时跳过 Amazon |
| 字幕 `.chs` 后缀 | MDC §10.8 | P3 | 整理阶段复制字幕库 |
| dry-run 预览 | Javinizer preview orchestrator | P2 | 手动任务开关 |
| revert / 操作回滚 | Javinizer `revert_log` | P4 | 整理失败可逆 |
| 配置预设 | JavSP-Web presets | P2 | 手动任务「复用预设」 |

### 10.7 安全与 API 边界（Javinizer）

MDCS 文件/整理 API **P1 起**采纳：

- `allowed_directories`：API 文件操作仅允许配置根目录（七路径 source/library + index）
- 扫描 `max_files` / `scan_timeout` 上限
- 写接口 rate limit（可选）

### 10.8 DESIGN.md 补全优先级（相对 v1.1 缺口）

| 优先级 | 缺口 | 参考 | 建议落点 |
|--------|------|------|----------|
| **P1** | Provider 注册表 + access 模式 | sehua `sources.ts` | §5.1 + `scrape.json` schema |
| **P1** | 识别规则扩展计划 | JavSP `avid.py` | §5.2 + §11.4 |
| **P1** | API 目录白名单 | javinizer `allowed_directories` | §7 API 安全 |
| **P2** | 双通道 FAST/SLOW 完整 spec | sehua `scrape.ts` | §11.3 |
| **P2** | 字段优先级「非空不回退」 | javinizer config | §11.5 |
| **P2** | 刮削记录 fieldSources 时间线 | sehua `ScrapeMeta` | §4.4.2 + §6 |
| **P2** | javbus-api sidecar 可选架构 | javbus-api | §11.2 脚注 |
| **P3** | mosaic 检测 + 命名联动 | mdcx + MDC §10.5 | Classify 管线 |
| **P3** | NFO 合并 / genre 映射库 | javinizer + JavSP | §11.6 |
| **P3** | coverDownloadStrategy `size` | sehua + MDC §6.2 | 下载 Tab |
| **P4** | 目录监控 + qB 完成钩子 | JavSP-Web | 监控 Tab 扩展 |
| **P4** | revert 回滚 | javinizer | 整理引擎 |
| **—** | 磁力爬取/管理 | javspider_stack | **非目标** |
| **—** | Jellyfin 插件 | jellyfin-jav-scraper | **非目标**（仅 Regex/回退借鉴） |

### 10.9 当前实现差距快照（代码 vs 设计）

| 项 | 设计目标 | 当前 `apps/server` |
|----|----------|-------------------|
| Provider 数 | 25+ | javbus stub + 少量 |
| 双通道 | FAST/SLOW | 未分通道 |
| 识别规则 | JavSP 级 | 基础 FC2/标准 |
| UI 信息架构 | MDC 11 Tab | 四页旧 IA（分区/任务/日志/数据源） |
| fieldSources | 全量 | 部分 |
| Organize/NFO | P3 | 未实现 |

---

## 11. 结论

MDCS UI **完整对齐 MDC-NG v1.36.0**（§4）；引擎层以 **色花 scrape 为主干**，吸收 **JavSP 识别 / Javinizer 合并语义 / mdcx 过盾与映射 / javbus-api 适配模式**（§10）。§4 + §10 共同构成实现验收清单。

详细 MDC 原始字段备份见 [`docs/references/MDC-NG-UI.md`](references/MDC-NG-UI.md)。
