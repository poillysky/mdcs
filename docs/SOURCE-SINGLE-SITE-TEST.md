# 单站测试规范（逐源 · 一站一报告）

> 版本：2026-08-23  
> 用途：UI 数据源卡片**按顺序**逐站测试；每站结束输出报告，**用户确认「下一个」后再继续**。  
> 相关：[SOURCE-TEST-STRATEGY.md](./SOURCE-TEST-STRATEGY.md) §1.1 · [SOURCE-PROBE.md](./SOURCE-PROBE.md) · [sources/README.md](./sources/README.md)

---

## 1. 流程总览

```
MDCX 分析 → L1 单测 → L1 测通 → Live 刮削 → E2E（NFO+封面）→ 单站报告 → 等用户「下一个」
```

| 阶段 | 做什么 | 通过标准 |
|------|--------|----------|
| **0. MDCX 分析** | 读 `mdcx/crawlers/{id}.py` + `tests/crawlers/test_*.py` + `config/v1.py` | 写出「MDCX 怎么做 → MDCS 差距 → 测试计划」 |
| **L1 单测** | `node --import tsx --test src/scrape/providers/{id}.test.ts` | 全绿；无单测则先移植 MDCX fixture |
| **L1 测通** | `npx tsx scripts/probe-one.ts {id}` | `ok: true` · 非挑战页 · 与刮削同通道 |
| **Live 刮削** | `npx tsx scripts/e2e-sone-source.ts --id={id}` 或专用 debug 脚本 | 样例番号字段齐 · 无 error |
| **E2E** | 同上（含封面/NFO/整理） | 已采集 NFO 项全写入 · 封面可下载（或文档标注限制） |
| **报告** | 更新 `docs/sources/{id}.md` + 会话摘要 | 见 §3 模板 |

**禁止**：未分析 MDCX 就乱试 Referer/proxy/Flare；HTTP 200 无业务正文即算通。

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

**排序规则**（`catalogTypes.ts` / `ScrapeConfigPanel.tsx`）：同组内 **代理 → 自适应 → 过盾**，再 **已实现优先**，再 **tier**，再 **label 拼音**。

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
| 11 | avbase | ← 下一站 |
| 12 | mgstage | |
| 13 | javdb | |
| 14 | avsex | |
| 15 | avmoo | |
| 16 | javlibrary | |
| 17 | miss_av | |
| 18 | javday | |
| 19 | njav | |

> ⚠️ **不是** `sourceMaster.ts` 数组书写顺序。验证命令：`npx tsx scripts/_print-av-order.ts`

### 无码 / FC2 / 国产 / 欧美

各组内同样按上述排序规则；完成 AV 组后再进下一组。

---

## 6. 有问题立即修

| 类型 | 动作 |
|------|------|
| L1 失败 | 对齐 MDCX fixture/断言，改 parser |
| 测通失败 | 查 `access` 通道、探针 URL（API 站勿只打首页） |
| Live 缺字段 | 读 MDCX 字段来源，补 parser/merge |
| NFO 漏写 | 查 `nfo-e2e-checks.ts` + `metaCollectedFields` |
| 封面失败 | 读 MDCX `image_download` + `web_async` CF bypass |

修完**从失败环节重跑**，直到该站报告全绿或明确标注 ⚠️ 限制。
