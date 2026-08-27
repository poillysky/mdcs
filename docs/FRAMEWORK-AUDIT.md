# MDCS 框架审计（v1.0 基线后）

> 版本：2026-08-27  
> 用途：框架基本搭完后的**缺陷 / 技术债 / 文档漂移**汇总，供后续迭代对照。  
> 相关：[ROADMAP.md](./ROADMAP.md) · [SETTINGS-CONFIG-AUDIT.md](./SETTINGS-CONFIG-AUDIT.md) · [SOURCE-E2E-TEST-LOG.md](./SOURCE-E2E-TEST-LOG.md) · [S6-ACCEPTANCE.md](./S6-ACCEPTANCE.md)

---

## 1. 自动化体检（2026-08-27）

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `npm run typecheck` | ✅ 通过 | 前后端 `tsc --noEmit` 无报错 |
| `npm test` | ✅ **402/402** | njav `pickNjavDetailHref` 已改内联 fixture（2026-08-27 修复） |
| 本地启动 | ✅ | `start-dev.cmd` / `npm run dev`（3050 + 9210） |
| Provider catalog | ✅ **32/32 已实现** | `sourceMaster.ts`，无 stub 源 |

**结论**：控制面 + 数据面主链路可运行；当前阻断项主要是**单测 fixture 过期**与**部分文档未跟上代码**，非架构性缺口。

---

## 2. 缺陷与 Bug

### 2.1 【已修复】`njav` 单测 fixture 过期

| 项 | 内容 |
|----|------|
| 原现象 | `pickNjavDetailHref` 用例因 `data/_debug/njav-search-SONE-001.html` 变为 404 页而失败 |
| 修复 | 该用例改为**内联 HTML**（`njav.test.ts`）；`data/_debug` 搜索快照已替换为最小可用页 |
| 状态 | ✅ `npm test` 402/402 全绿 |

### 2.2 【P1】引擎 / 源站（延续 E2E 日志）

见 [SOURCE-E2E-TEST-LOG.md §6](./SOURCE-E2E-TEST-LOG.md#6-已知问题与待办)，框架层需知晓：

| 项 | 说明 |
|----|------|
| JavDB 过盾 | 批量刮削易超时；换出口或接 mdcx App API |
| fc2_hub 封面 | fancybox 链偶发 storage 404，fd2ppv 补图 |
| jav321 字段 | 精简页无 actor/genre 属站点限制 |
| theporndb | 无 API Key 时批量失败（预期行为，需 UI 提示） |

### 2.3 【P2】演员简中映射 — 已修复但需运维知晓

| 项 | 说明 |
|----|------|
| 数据 | `data/scrape_maps/actors.zh-CN.json` 已重导（约 3.9MB） |
| 遗留 | **已刮削入库**的旧记录不会自动改名；改 maps 后需**重启后端**清内存缓存 |
| 头像 | 旧头像需 `forceImage` 或重新刮削才会换 Digigra 优先源 |

### 2.4 【P2】设置 / 配置边界（非阻断）

摘自 [SETTINGS-CONFIG-AUDIT.md](./SETTINGS-CONFIG-AUDIT.md)：

| 项 | 现状 |
|----|------|
| `ops.qb`（qBittorrent） | schema + 后端有；设置页 UI 已撤回（改 `ops.json`） |
| 水印 `style` / `style4k` | 下拉扫描 `assets/watermarks/*` |
| 高清海报仅刮削阶段 | 只跑整理不重刮时不会调用 `hdPoster.ts` |
| LLM `apiKey` | `scrape.json` + 双写 `mdcs.llm.*` / `scrap.llm.*` |

### 2.5 【P3】可选增强（非阻断）

| ID | 项 | 现状 |
|----|-----|------|
| S1.3–S1.6 | Token / 组件约定 / 宽屏 | ✅ 已对齐文档与实现；暗色主题明确不做 |
| S4.14 | 整理 revert | 未实现（P3 可选） |

---

## 3. 文档漂移（已修正 · 2026-08-27）

| 文档 | 原过时内容 | 处理 |
|------|----------|------|
| ROADMAP §1 / S1.3–1.6 | 旧地基快照；S1 未勾 | ✅ 已更新并勾选 |
| DESIGN §4.1 / 演员 | Phase 4 占位；主题入口 | ✅ 演员已落地；宽屏落地；主题不做 |
| SOURCE-MASTER-LIST | 16/24 stub | ✅ 标明历史表；现行 32/32 |
| SOURCE-E2E | 小黄书 stub | ✅ 改为已实现 |

---

## 4. 架构与代码健康

### 4.1 已验证强项

- 七路径 `libraries.json` + 任务级 `JobOptions` 覆盖
- FAST/SLOW 双通道、字段优先级、`fieldSources` 可观测
- 路径白名单、可选 `MDCS_API_TOKEN`、密钥脱敏
- WS 任务增量、扫描 mtime 跳过、SQLite 索引
- 设置 Tab 参数落地（含 qBittorrent，见 SETTINGS-CONFIG-AUDIT）

### 4.2 结构债（建议后续迭代，不挡 v1.0 使用）

| 债 | 说明 |
|----|------|
| 前端组件未组件化 | 大量页面直写 `className="btn …"`，复用与三态验收靠 CSS，难做 Storybook |
| 样式单文件过大 | `styles.css` 约 1.2 万行，按域拆分可降低冲突 |
| 路由文档缺口 | ~~七区任务未成章~~ DESIGN §4.1 已补 `/kind-tasks` |
| 配置双写风险 | 命名 `subtitleAddChsSuffix` 等字段同步到 `download` — 已有 hint，改 UI 时须双写 |
| `data/` 运行时产物 | DB、maps、covers 在 `.gitignore`；新环境需跑任务或导入 maps |

### 4.3 工作区状态（审计日）

- Git 存在未跟踪的高级设置相关改动（`JobAdvancedSettingsModal`、`advancedSettings/*`、`jobOptions.ts` 等）— 合并前需自测任务创建 → 高级设置七 Tab
- 根目录 `_schema_*.txt` 已在 `.gitignore`，勿提交

---

## 5. 推荐修复优先级

| 优先级 | 动作 |
|--------|------|
| **P0** | ~~njav fixture~~ ✅ |
| **P1** | ~~文档漂移~~ ✅；JavDB/fc2_hub 源站风险保留开放项 |
| **P2** | ~~S1.6 宽屏~~ ✅；~~S1.4 CSS 约定~~ ✅；~~水印 styles API~~ ✅；~~theporndb 缺 Key 徽章~~ ✅；~~LLM 双写键~~ ✅；qB 设置 UI **已按需求删除** |
| **P3** | 整理 revert、Amazon ASIN 缓存等 backlog |

---

## 6. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-27 | 初版：typecheck/test 体检 + njav fixture + 文档漂移 + ROADMAP 未勾项 |
| 2026-08-27 | 收口：宽屏、水印样式扫描、theporndb 缺 Key、LLM 键对齐、文档同步；qB 设置 UI 后按需求删除 |
