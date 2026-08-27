# 单站测试规范（逐源 · 一站一报告）

> 版本：2026-08-24  
> 用途：UI 数据源卡片**按顺序**逐站测试；每站结束输出报告，**用户确认「下一个」后再继续**。  
> 相关：[SOURCE-TEST-STRATEGY.md](./SOURCE-TEST-STRATEGY.md) §1.1 · [SOURCE-PROBE.md](./SOURCE-PROBE.md) · [sources/README.md](./sources/README.md)

---

## 1. 流程总览

```
MDCX 分析 → L1 单测 → L1 测通 → Live 刮削 → E2E → 【分类+链接核验】→ 单站报告 → 等用户「下一个」
```

| 阶段 | 做什么 | 通过标准 |
|------|--------|----------|
| **0. MDCX 分析** | 读 `mdcx/crawlers/{id}.py` + 参考文档 | 写出「MDCX 怎么做 → MDCS 差距 → 测试计划」；**文案仅参考** |
| **L1 单测** | `node --import tsx --test src/scrape/providers/{id}.test.ts` | 全绿；无单测则先移植 MDCX fixture |
| **L1 测通** | `npx tsx scripts/probe-one.ts {id}` | `ok: true` · 非挑战页 · 记录 **`probeVia`** |
| **Live 刮削** | `npx tsx scripts/e2e-sone-source.ts --id={id}` 或专用 debug 脚本 | 样例番号字段齐 · 无 error · 记录实际取页通道 |
| **E2E** | 同上（含封面/NFO/整理） | 已采集 NFO 项全写入 · 封面可下载（或文档标注限制） |
| **分类+链接核验** | 见 §1.1 | 按**实测**定 `group` + `access`；与 catalog 不一致则改 `sourceMaster.ts` |
| **报告** | 更新 `docs/sources/{id}.md` + 会话摘要 | 见 §3 模板 |

**禁止**：未分析 MDCX 就乱试 Referer/proxy/Flare；HTTP 200 无业务正文即算通；**照抄 MDCX/旧文档的分组或 access 不上实测**。

### 1.1 分类与链接核验（每站必做）

MDCX、`SOURCE-MASTER-LIST.md`、历史 MEMORY **只作线索**，最终写入 catalog 的 `group` 与 `access` 必须以本环境 **测通 + Live/E2E 日志** 为准。

#### UI 分组 `group` — 怎么判

| 分组 | 适用条件（真实站点能力，非 MDCX 模块名） |
|------|------------------------------------------|
| `av` | 主服务**日本有码** meta/cover；片种边界清晰 |
| `uncensored` | 主服务**日本无码**（官网系、无码目录等） |
| `fc2` | 主服务 FC2 / FC2-PPV |
| `chinese` | 主服务**国产/麻豆**等中文片种 |
| `western` | 主服务欧美 |
| `general` | **跨品类聚合**（同一站含日/无/国产/播放等），无法归入单一 kind |

**判据**：看首页分类、样例番号实测命中页、字段结构；若 SONE 与 MDX 都能刮但无专精 → `general`，不是「有码组因为有 SONE 样例」。

#### 链接方式 `access` — 怎么判

| access | 何时用（看 `probeVia` + 刮削日志，不是看分组） |
|--------|--------------------------------------------------|
| `proxy_adaptive` | 默认。代理/curl 直连；遇 CF 回落 Flare（**含原 `proxy` 档**） |
| `proxy_flare` | **每次**须 Flare 才有业务 HTML（SPA 空壳、无 clearance 必挂） |

**操作**：

1. 跑 `probe-one.ts`，记下 `probeVia`（`direct` / `flare` / `curl` 等）
2. 看 Live 日志：`cookie-direct` / `flare fresh` / 代理超时
3. 若 adaptive 下 direct/curl 稳定 → **不要**标 `proxy_flare`；若仅 flare 有业务 DOM → 标 `proxy_flare`
4. 改 `sourceMaster.ts` 的 `group` / `access` / `notes`，同步 `providerGuide.ts`

#### 样例：JavDay（参考 ≠ 最终）

| 项 | 参考/初稿 | **实测结论** |
|----|-----------|--------------|
| 分组 | MDCX 偏国产；曾放有码 AV / 国产 | 首页含 censored/uncensored/chinese-av → **`general` 综合** |
| access | 文档写 `proxy_flare` | 测通 `probeVia: direct` ~0.9s；刮削 `cookie-direct` ~3s → **`proxy_adaptive`** |
| 样例 | — | SONE-001 E2E 14/14；**分组不因样例是有码就进 av 组** |

完整记录见 [sources/javday.md](./sources/javday.md) §分类与链接核验。

---

## 2. 样例番号

默认从 `apps/server/scripts/e2e-fixtures.ts` 取；无索引时用 `--strm=` 覆盖。

| Kind | 默认番号 | strm |
|------|----------|------|
| japan_censored | SONE-001 | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |
| japan_uncensored | CARIB-010117-339 | 见 e2e-fixtures |
| fc2 | FC2-PPV-3275049 / FC2-1545500 | 见 e2e-fixtures |
| china | MDX-0001 | 见 e2e-fixtures |

---

## 3. 单站报告模板

每站测试结束，在会话中输出（并更新 `docs/sources/{id}.md`）：

```markdown
## {站点名} — 测试报告 YYYY-MM-DD

### MDCX 对照
- 爬虫：{py 路径} · 取数链：{搜索/API/HTML}
- MDCS 差距：{无 / 列表}

### 结果
| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅/❌ n/n | |
| 测通 | ✅/❌ ms | probeVia |
| Live | ✅/❌ ms | 样例番号 |
| E2E | ✅/⚠️/❌ | NFO x/y · 封面 KB |

### 字段采集（NFO）
- 已采集：…
- 未采集 + 原因：…

### 分类与链接核验（必填）
| 项 | 参考/初稿 | 实测 | 最终 catalog |
|----|-----------|------|--------------|
| UI 分组 | … | 依据（首页分类/样例页/片种边界） | `group=…` |
| access | … | probeVia=… · 刮削日志=… | `access=…` |
| 差异说明 | MDCX/旧文档 … | 为何与参考不同 | notes=… |

### 修复项（本轮）
- …

### 结论
生产可用：✅/⚠️/❌
```

---

## 4. 命令速查

```powershell
cd e:\MDCS\apps\server

# L1 单测
node --import tsx --test src/scrape/providers/dmm.test.ts

# 测通
npx tsx scripts/probe-one.ts dmm

# E2E（刮削+封面+NFO+水印）
npx tsx scripts/e2e-sone-source.ts --id=dmm

# 列出各源索引样例
npx tsx scripts/e2e-sone-source.ts --list
```

---

## 5. UI 卡片顺序（有码 AV · 与界面一致）

**排序规则**（`catalogTypes.ts` / `ScrapeConfigPanel.tsx`）：同组内 **自适应 → 过盾**，再 **已实现优先**，再 **label 拼音**。

| # | id | 状态 |
|---|-----|------|
| 1 | dmm | ✅ 2026-08-23 |
| 2 | freejavbt | ✅ 2026-08-23 |
| 3 | iqqtv | ✅ 2026-08-23 |
| 4 | jav321 | ✅ 2026-08-23 |
| 5 | javbus | ✅ 2026-08-23 |
| 6 | libredmm | ✅ 2026-08-23 |
| 7 | **r18dev** | ✅ 2026-08-23 |
| 8 | **airav_io** | ✅ 2026-08-23 |
| 9 | **sevenmmtv** | ✅ 2026-08-23 |
| 10 | **airav** | ✅ 2026-08-23 |
| 11 | avbase | ✅ 2026-08-23 |
| 12 | mgstage | ✅ 2026-08-23 |
| 13 | javdb | |
| 14 | avsex | ✅ 2026-08-23 |
| 15 | avmoo | ✅ 2026-08-24 · E2E 23/23 · 封面 DMM 镜像 · 剧照 15 |
| 16 | javlibrary | ✅ 2026-08-24 · E2E 26/26 · 封面 142KB · 镜像 f101w |
| 17 | miss_av | ✅ 2026-08-24 · E2E 25/30 · 封面 ~151KB · 自适应 curl |
| 18 | **njav** | ✅ 2026-08-24 · E2E 19/30 · 封面 ~59KB · 123AV · curl |

> ⚠️ **不是** `sourceMaster.ts` 数组书写顺序。验证命令：`npx tsx scripts/_print-av-order.ts`

### 无码 AV

| # | id | 状态 |
|---|-----|------|
| 1 | **carib** | ✅ 2026-08-24 · E2E **26/30** · 封面 104KB · curl · EUC-JP |
| 2 | **avsox** | ✅ 2026-08-24 · E2E 18/30 · 封面 55KB · flare ~31s |

### FC2

| # | id | 状态 |
|---|-----|------|
| 1 | **fc2** | ✅ 2026-08-24 · E2E **23/30** · 封面 8KB · curl · 多标签 parser |
| 2 | fc2_hub | ✅ E2E **FC2-PPV-4962908**（封面+剧照+NFO） |
| 3 | fd2ppv | ✅ 2026-08-24 · E2E **19/30** · curl 自适应 · 封面 xximgs |

### 国产 / 欧美

各组内同样按上述排序规则；完成 AV 组后再进下一组。

### 综合（跨品类聚合 · UI 最末）

| # | id | 状态 |
|---|-----|------|
| 1 | **javday** | ✅ 2026-08-24 · E2E 14/14 · 封面 174KB · 自适应 |
| 2 | miss_av | ✅ 2026-08-24 · E2E 25/30 · 自适应 Flare→curl |
| 3 | **njav** | ✅ 2026-08-24 · E2E 19/30 · 123AV · adaptive curl |

---

## 6. 有问题立即修

| 类型 | 动作 |
|------|------|
| L1 失败 | 对齐 MDCX fixture/断言，改 parser |
| 测通失败 | 查 `access` 通道、探针 URL（API 站勿只打首页） |
| Live 缺字段 | 读 MDCX 字段来源，补 parser/merge |
| NFO 漏写 | 查 `nfo-e2e-checks.ts` + `metaCollectedFields` |
| 封面失败 | 读 MDCX `image_download` + `web_async` CF bypass |
| 分组/access 与实测不符 | 按 §1.1 重判；改 `sourceMaster.ts` + `providerGuide.ts` + 本站 md |

修完**从失败环节重跑**，直到该站报告全绿或明确标注 ⚠️ 限制。
