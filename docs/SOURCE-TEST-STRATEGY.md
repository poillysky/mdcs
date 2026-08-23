# 数据源测试策略：MDCX 完全复制 + 色花优化 + MDCS 扩展

> 版本：2026-08-22  
> 背景：用户要求深度分析 MDCX 全部数据源测试逻辑，**完全复制**后再以色花方式优化，并补充 MDCX 没有的源。  
> 相关：[SOURCE-E2E-TEST-LOG.md](./SOURCE-E2E-TEST-LOG.md) · [SOURCE-CATALOG-8REF.md](./SOURCE-CATALOG-8REF.md) · [sources/README.md](./sources/README.md)

---

## 1. 目标与原则

| 原则 | 说明 |
|------|------|
| **MDCX 为测试基准** | Provider 解析、FakeClient 断言字段、helper 单测、Registry 完整性 —— 优先对齐 `references/mdcx-diy/tests/crawlers/` |
| **色花为运行时优化** | `siteMirror` 多域种子、`access` 通道、`SOURCE_FIELD_CAPS` 合并策略、默认 Kind 源顺序 —— 不改 MDCX 断言，只增强 MDCS 网络层与合并 |
| **MDCS 独有 L3/L4** | MDCX 无「整理 + NFO 30 字段 + 封面下载」E2E；MDCS 在复制 MDCX L0–L2 之上保留 `e2e-sone-source.ts` |
| **单源有多少验多少** | NFO 必过项仅针对该源实际采集字段（`nfo-e2e-checks.ts` + `metaCollectedFields`） |
| **逐站一站一报告** | 见 [`SOURCE-SINGLE-SITE-TEST.md`](./SOURCE-SINGLE-SITE-TEST.md)；用户确认「下一个」后再测下一卡 |
| **有问题先对齐 MDCX** | 解析分歧以 `mdcx/crawlers/{id}.py` + 对应 `test_*.py` fixture 为准，再考虑色花差异 |
| **先分析、后测试（强制）** | 见 §1.1；禁止未读 MDCX 就 live 乱试 |

### 1.1 先 MDCX 分析，再测试（禁止无头苍蝇）

**任何站点**（新源完善、封面/测通/E2E 失败排查）在写代码或跑 live 之前，必须先完成 MDCX 对照分析并留下简短结论（可写在 `docs/sources/{id}.md` 或 PR/会话）：

| 步骤 | 读什么 | 产出 |
|------|--------|------|
| 1. 爬虫 | `mdcx/crawlers/{id}.py` | URL 链、解析 XPath/字段、**thumb vs poster**、`image_download` |
| 2. 单测 | `tests/crawlers/test_{id}*.py`、内联 fixture | L1 断言字段、样例番号、FakeClient URL |
| 3. 配置 | `config/v1.py`（`*_website` / `*_exclude`） | 哪些字段用该源、哪些 deliberately 排除 |
| 4. 下载 | `core/web.py`（thumb/poster_download）、`web_async.py`（CF bypass） | 图片是否直下、失败兜底（裁剪/Amazon/ignore） |
| 5. 测通 | `core/network_check.py`（`SPECIAL_CHECK_PATHS`） | 探针 URL 是否特殊 |

**然后**才定 MDCS 测试计划（L1 fixture → 测通路径 → live → E2E），按 [`SOURCE-PROBE.md`](./SOURCE-PROBE.md) 与 [`source-probe` skill] 执行。

**禁止**：

- 未读 MDCX 就反复改 Referer / proxy / Flare 超时「碰运气」
- 把「HTTP 200/403 一次 curl」当作结论
- 跳过 `image_download`、poster 策略等下载层分析（AVSex 教训）

**正例（AVSex）**：MDCX `image_download=False` + poster 在 `poster_website` + 下载靠 **通用 CF bypass**，非 CDN Referer 特判 → MDCS 应补 bypass 通道而非只改 Referer。

---

## 2. MDCX 测试体系（五层）

路径：`references/mdcx-diy/tests/crawlers/`（**40 个** `test_*.py` + `parser.py` + `conftest.py`）

### L0 — Registry / 框架

| 文件 | 作用 |
|------|------|
| `test_crawler.py` | 每个 `Website` 枚举必须有可实例化爬虫；`validate_crawler_registry()` 无遗漏 |
| `test_compat.py` | 配置迁移、废弃站（如 `AIRAV`）兼容 |

**MDCS 对应**：`catalog.test.ts`（24 源 catalog、`implemented` 计数）→ 扩展为 **每个 `implemented: true` 必须在 `providers/index.ts` 注册且非 stub**。

### L1 — FakeClient 单元/集成（默认 CI 可跑）

**模式**（以 `test_fc2hub.py`、`test_javbus_new.py` 为代表）：

```python
class FakeXxxClient:
    async def get_text(self, url, **kwargs):
        if url == "期望 URL":
            return ("""<html>...</html>""", "")
        return None, "unexpected url"

@pytest.mark.asyncio
async def test_xxx_crawler():
    crawler = XxxCrawler(client=FakeXxxClient(), base_url="...")
    res = await crawler.run(CrawlerInput(number="...", ...))
    assert res.data.title == "..."
    assert res.data.thumb == "..."
    # … CrawlerData 全字段
```

**特点**：

- **内联 HTML/JSON**，不依赖网络
- URL 断言（验证搜索链 → 详情链）
- 断言 `CrawlerData`：**number, title, actors, tags, thumb, trailer, studio, release, runtime, series, …**
- 部分测 **域名轮换**（`RotatingJavbusClient`）
- 部分测 **monkeypatch** API（DMM GraphQL、FC2 sample API）

**conftest.py 说明**：爬虫目录默认 `pytestmark = integration`，但 FakeClient 测试**本身无网络**；CI 用 `-m "not network and not integration"` 跳过整包 —— MDCS 应把 FakeFetch 测试标为 **unit**，与 live 分离。

### L2 — HTML Golden 回归（ParserTestBase）

| 组件 | 路径 |
|------|------|
| 基类 | `tests/crawlers/parser.py` → `ParserTestBase` |
| 数据 | `tests/crawlers/data/{parser}/cases.json` + `*.html` + 期望 `*.json` |
| 入口 | `test_parsers.py` parametrized：**dmm/mono、dmm/digital、dmm/rental、javdb** |
| 更新 | `--overwrite` 重写 golden |

**现状**：MDCX 仅 DMM/JavDB 子解析器有 golden；其余源靠 L1 内联 fixture。

**MDCS 复制策略**：

- Phase 1：已实现 16 源全部 L1 FakeFetch（内联 HTML，移植 MDCX fixture 文本）
- Phase 2：复杂源（dmm、javdb、javbus）补 `data/{id}/` golden，对齐 `ParserTestBase` 语义

### L3 — Helper / 纯函数单测

| 文件 | 测什么 |
|------|--------|
| `test_dmm_direct.py` | CID 猜测、`dmm_direct` 路径 |
| `test_dmm_trailer_url.py` | 预告 URL 拼装 |
| `test_fc2_trailer.py` | FC2 sample API |
| `test_iqqtv_title_cleanup.py` | 标题清洗 |
| `test_guochan.py` | 国产番号/文件名解析（`get_number_list`） |
| `test_aio_sites.py` | 多站共用 aio 逻辑 |

**MDCS 对应**：已部分存在 —— `dmmCid.test.ts`、`dmmTrailer.test.ts`、`jav321.test.ts`（rating）、`carib.test.ts`（premiered/plot）、`fc2_hub.test.ts`（MDCX 对齐）。**每个 provider 的 export 解析函数都应有对应 `.test.ts`**。

### L4 — Live 集成（默认跳过）

- `conftest.py`：`--network`、`--site` 命令行
- 真实 HTTP；CI 不跑
- MDCS 对应：`scrape-sone-sources.ts`、`probe-one.ts`、UI 测通

---

## 3. MDCX 源 ↔ 测试文件对照

`Website` 枚举见 `mdcx/config/enums.py`（约 40 值，含 `dmm_api`、`javdb_api` 等变体）。

| MDCX Website | 爬虫文件 | MDCX 测试文件 | MDCS SourceId | MDCS 单测 | MDCS E2E |
|--------------|----------|---------------|----------------|------------|-----------|
| javbus | javbus.py | test_javbus_new.py, test_javbus.py | javbus | ❌ | ✅ |
| javdb | javdb_new.py | test_javdb_new.py, test_javdb_api.py, test_javdb_app.py | javdb | ❌ | ❌ |
| dmm | dmm_new/* | test_dmm_api.py, test_dmm_direct.py, test_dmm_trailer_url.py + test_parsers | dmm | ✅ 部分 | ✅ |
| dmm_api | dmm_api.py | test_dmm_api.py | — | — | — |
| libredmm | libredmm.py | test_libredmm.py | libredmm | ❌ | ✅ |
| jav321 | jav321.py | test_jav321.py | jav321 | ✅ | ✅ |
| javlibrary | javlibrary.py | test_javlibrary.py | javlibrary | ❌ stub | — |
| avbase | avbase_new.py | test_avbase.py | avbase | ❌ stub | — |
| avsox | avsox | test_aio_sites.py | avsox | ❌ | ❌ |
| avmoo | avmoo | test_aio_sites.py | avmoo | ❌ stub | — |
| airav_cc | airav_cc.py | test_airav_cc.py | airav_io | ❌ | ❌ |
| fc2 | fc2.py | test_fc2.py, test_fc2_trailer.py | fc2 | ❌ | ✅ |
| fc2hub | fc2hub.py | test_fc2hub.py | fc2_hub | ✅ | ⚠️ |
| fc2ppvdb | fc2ppvdb.py | test_fc2ppvdb.py | fd2ppv | ❌ | ✅ |
| fc2club | fc2club.py | test_fc2club.py | — | — | — |
| freejavbt | freejavbt.py | test_freejavbt.py | freejavbt | ❌ | ⚠️ |
| iqqtv | iqqtv.py | test_iqqtv.py, test_iqqtv_crawler.py, test_iqqtv_title_cleanup.py | iqqtv | ❌ | ✅ |
| madouqu | madouqu.py | test_madouqu.py | madouqu | ❌ | ❌ |
| guochan | guochan.py | test_guochan.py | madou* | ❌ | ⚠️ |
| mgstage | mgstage.py | — | mgstage | ❌ stub | — |
| 7mmtv (MMTV) | mmtv.py | test_mmtv.py | sevenmmtv | ❌ stub | — |
| missav | missav.py | test_missav.py | miss_av | ❌ stub | — |
| theporndb | theporndb.py | test_theporndb.py | theporndb | ❌ | ❌ |
| getchu / getchu_dmm | getchu*.py | test_getchu.py | — | — | — |
| kin8, prestige, faleno, giga, mywife, r18dev, xcity, hdouban, official, … | 各 py | 各 test_*.py | — stub | — | — |

\* MDCX `guochan` 是国产番号/文件名工具 + 多站；MDCS 拆为 `madou` + `madouqu` 两个 Provider，测试需 **移植 guochan helper + 各站 FakeClient**。

**MDCS 独有（MDCX 无对应 Website）**：

| MDCS SourceId | 说明 | 测试策略 |
|----------------|------|----------|
| **carib** | Caribbean.com | 参考 JavSP/色花；已有 `carib.test.ts`；E2E 用 CARIB-010117-339 |
| **madou** | madou.club | 对齐 MDCX guochan 番号逻辑 + madou HTML fixture |
| **xiao_huang_shu** | xchina.co | 色花 htmlMeta；MDCX 无，新建 fixture |
| **airav** | airav.wiki stub | 对齐 airav_cc 测试时可复用 |

---

## 4. 色花相对 MDCX 的差异（优化层，不改断言）

色花 **无** `*.test.ts` / pytest；测试知识在实现与 `siteMirror.ts` 里。MDCS 吸收：

| 能力 | 色花位置 | MDCS 落地 | 测试方式 |
|------|----------|------------|----------|
| 多域种子 / 镜像 | `siteMirror.ts` | `providerSite.ts` + probe | L4 probe + `network.test.ts` |
| access 四档 | `SOURCE_DEFS.access` | `catalog.ts` `ProviderAccess` | probe 与 scrape **同通道** |
| 字段能力 caps | `sourceFields.ts` | `metadataPrefs` / merge | merge.test.ts + E2E 未采集不判失败 |
| Kind 默认源序 | `DEFAULT_KIND_SOURCES` | scrape 合并配置 | 多源 E2E 可选 |
| 默认 Cookie | `defaultCookieFor` | `catalog.defaultCookie` | FakeFetch 断言 headers 含 Cookie |
| Flare 注册策略 | `viaFlare` / `registerFlare` | `proxy_flare` / adaptive | fc2_hub `probePath: /en` 等 |

**原则**：MDCX FakeClient 断言 **页面解析结果**；色花优化只影响 **如何拿到 HTML**（L4），不改变 L1 期望字段。

---

## 5. MDCS 目标测试栈（MDCX + 扩展）

```
┌─────────────────────────────────────────────────────────────┐
│ L4  Live E2E     e2e-sone-source.ts + nfo-e2e-checks (30 字段) │
│ L3  Live 刮削    scrape-sone-sources.ts / probe-one.ts        │
├─────────────────────────────────────────────────────────────┤
│ L2  Golden HTML  tests/scrape/data/{id}/*.html + expected.json│
│ L1  FakeFetch    providers/{id}.test.ts（移植 MDCX fixture）   │
│ L0  Registry     catalog.test.ts + providers/index 注册完整性  │
└─────────────────────────────────────────────────────────────┘
```

### L1 模板（TypeScript / node:test 或 vitest）

```typescript
// providers/javbus.test.ts — 移植 test_javbus_new.py
import { describe, it, expect, vi } from "vitest";
import { javbusProvider } from "./javbus.js";

vi.mock("../network/fetch.js", () => ({
  fetchText: async (url: string) => {
    if (url.endsWith("/SSIS-243")) return FAKE_DETAIL_HTML;
    throw new Error(`unexpected: ${url}`);
  },
}));

describe("javbus", () => {
  it("maps detail page like MDCX", async () => {
    const r = await javbusProvider.scrape({ code: "SSIS-243", kind: "japan_censored" });
    expect(r?.fields.title).toContain("Sample Title");
    expect(r?.fields.actors).toEqual(["演员A"]);
    // …
  });
});
```

**要求**：每个已实现源的 L1 测试至少覆盖 MDCX 同名测试中的 **全部 assert 字段**。

### L2 Golden 目录（建议）

```
apps/server/tests/scrape/data/
  dmm/mono/
    cases.json
    detail-son001.html
    detail-son001.json
  javdb/
  javbus/
  fc2_hub/          ← 已内联于 fc2_hub.test.ts，可迁出
```

### L3/L4 索引样例（已有）

见 `apps/server/scripts/e2e-fixtures.ts`：

| Kind | 番号 | 用途 |
|------|------|------|
| japan_censored | SONE-001 | AV 组默认 |
| japan_uncensored | CARIB-010117-339 | Caribbean |
| fc2 PPV | FC2-PPV-3275049 | fc2_hub / fd2ppv |
| fc2 | FC2-1545500 | fc2 官方 |
| china | MDX-0001 | madou / madouqu |

### NFO 30 字段（MDCS 独有）

`nfo-e2e-checks.ts` 检查的 include 字段；E2E 报告写 `e2e-report.json` 的 `nfoFieldChecks` + `collectedFieldGaps`。

---

## 6. 差距汇总

| 维度 | MDCX | MDCS 现状 | 目标 |
|------|------|------------|------|
| 源总数 | ~40 Website | 24 catalog，16 implemented | 24 全测；MDCX 有而 MDCS 无的入 backlog |
| L1 FakeClient | ~35 源有 test | **5** 文件（dmm×2, jav321, carib, fc2_hub） | 16 implemented 全覆盖 |
| L2 Golden | dmm×3 + javdb | 0 | 先 dmm/javdb/javbus |
| L0 Registry | test_crawler.py | catalog.test.ts 仅计数 | + index 注册 vs implemented 一致 |
| L4 E2E | 无 | 10 源已测 | 16 源 + 逐源 md |
| 色花 siteMirror | 有 | 部分在 providerSite | probe 与 scrape 共用 seeds |

---

## 7. 实施路线图

### Phase A — 基础设施（1–2 天）

1. 统一测试 runner：`vitest` 或 `node:test`（现有混用 → 统一 vitest）
2. 新增 `tests/scrape/fakeFetch.ts`：`createFakeFetch(map: Record<string, string>)`
3. 扩展 `catalog.test.ts`：`implemented` ↔ `getProvider(id)` 非 stub
4. 文档：`docs/sources/{id}.md` 模板增加 **「MDCX 测试对齐」** 小节

### Phase B — 移植 MDCX L1（按 UI 组顺序）

| 优先级 | 源 | MDCX 参考 | MDCS 动作 |
|--------|-----|-----------|------------|
| P0 | javbus | test_javbus_new.py | ✅ `javbus.test.ts`（2026-08-22） |
| P0 | javdb | test_javdb_new.py | 新建 + 标记 integration 若需真 HTML |
| P0 | libredmm | test_libredmm.py | 新建 |
| P0 | fc2, fd2ppv | test_fc2.py, test_fc2ppvdb.py | 新建 |
| P1 | freejavbt, iqqtv | test_freejavbt.py, test_iqqtv*.py | 新建 |
| P1 | madou, madouqu | test_guochan.py + test_madouqu.py | helper + provider |
| P1 | airav_io, avsox | test_airav_cc.py, aio | 新建 |
| P2 | theporndb | test_theporndb.py | mock API JSON |

**已有**：dmm（部分）、jav321、carib、fc2_hub。

### Phase C — L2 Golden

1. 从 MDCX `test_parsers` 移植 dmm mono/digital/rental 样例 HTML（或 E2E 快照脱敏）
2. javdb Parser golden
3. `--update-golden` npm script

### Phase D — L4 E2E 扫尾

按 [SOURCE-E2E-TEST-LOG.md](./SOURCE-E2E-TEST-LOG.md) §6 待办：

1. **fc2_hub** — MDCX 对齐后复测 FC2-PPV-3275049 封面
2. **madou / madouqu** — MDX-0001（非 SONE-001）
3. **freejavbt** — SONE-001 E2E
4. stub 源实现后再测

### Phase E — MDCX 有、MDCS 无（产品 backlog）

| 源 | MDCX | 建议 |
|----|------|------|
| missav / missav_api | ✅ | 低优；与 miss_av stub 合并规划 |
| mgstage, 7mmtv | ✅ | 色花有 seeds；implement 后复制 test_mmtv |
| getchu, kin8, prestige, faleno | ✅ |  niche；按需 |
| fc2club | ✅ | 与 fd2ppv 重复度 high |
| official, r18dev, xcity | ✅ | 官方/开发源；低优 |
| javlibrary | ✅ | 高价值；复制 test_javlibrary + Flare |
| avbase | ✅ | adaptive；复制 test_avbase |

**不纳入 MDCS catalog**：forum（色花有、MDCS 故意无）、avheat/avsex/cnmdb 等 MDCX 小众源。

---

## 8. 单源完成定义（Definition of Done）

某源 `{id}` 测试完成需满足：

- [ ] **L1** `{id}.test.ts` 通过，字段断言 ⊇ MDCX 同名 test
- [ ] **L0** catalog `implemented: true` 且 index 注册
- [ ] **L4** E2E `e2e-sone-source.ts --id={id}` 出报告
- [ ] **NFO** `nfoFieldChecks` 必过项全绿；`collectedFieldGaps` 写入文档
- [ ] **文档** `docs/sources/{id}.md` + 更新 SOURCE-E2E-TEST-LOG 总览

---

## 9. 命令速查

```bash
# L1 单源
cd apps/server && npx vitest run src/scrape/providers/fc2_hub.test.ts

# L3 刮削
npx tsx scripts/scrape-sone-sources.ts --id=javbus

# L4 E2E
npx tsx scripts/e2e-sone-source.ts --id=javbus
npx tsx scripts/e2e-sone-source.ts --list

# 测通
npx tsx scripts/probe-one.ts --id=fc2_hub
```

---

## 10. 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-22 | 初版：MDCX 五层分析 + 源映射 + MDCS 四层目标栈 + 路线图 |
