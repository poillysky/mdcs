# 数据源测试记录

> 最后更新：2026-08-27  
> **逐源文档**：[docs/sources/README.md](./sources/README.md)（测一个写一个）  
> 环境：代理 `http://192.168.2.88:7893` · FlareSolverr `http://192.168.2.38:8191/v1`  
> 相关：`docs/SOURCE-CATALOG-8REF.md`（连接/取数） · `docs/SOURCE-PROBE.md`（测通） · `docs/SOURCE-TEST-STRATEGY.md`（测试策略） · **`docs/SOURCE-MASTER-LIST.md`**（全站点对照；现行 32 源见 `sourceMaster.ts`） · [FRAMEWORK-AUDIT.md](./FRAMEWORK-AUDIT.md)

---

## 1. 测试类型说明

| 类型 | 命令 | 覆盖范围 |
|------|------|----------|
| **刮削** | `npx tsx scripts/scrape-sone-sources.ts --id={源}` | 单源 Provider 拉元数据 + 封面 URL |
| **端到端 E2E** | `npx tsx scripts/e2e-sone-source.ts --id={源}` | 刮削 → 封面下载 → 硬链整理 → 命名 → 海报裁剪/水印 → NFO |
| **测通 L1** | UI 卡片 / `POST /api/scrape/providers/probe` | 站点可达（同刮削通道） |
| **测通 L2** | 未实现 UI | 样例番号真刮一小步 |

**图例**：✅ 通过 · ⚠️ 部分通过 · ❌ 失败 · — 未测 · 🔧 stub 未实现

**E2E NFO 检查**（2026-08-22，见 `scripts/nfo-e2e-checks.ts`）：

| 层级 | 说明 |
|------|------|
| **必过项** | 仅对单源刮削**实际采集到**的字段做必过判定（有多少验多少） |
| **未采集/可选** | 站点未返回的字段（如 FC2 无 actor、单源无 trailer）不判失败 |
| **生成器** | 已支持 `<thumb>`、`<fanart/>`、嵌套 `<ratings name="javdb">`（`nfo.ts` 2026-08-22） |

**水印说明**：全局 `watermark.enabled=true`；有码角标需 `markCensored=true` 或 strm 带字幕/4K 标签，故日本有码组多数显示「角标未出」属配置预期，非 bug。

---

## 2. 索引样例番号

E2E 默认从本地索引取 strm，定义见 `apps/server/scripts/e2e-fixtures.ts`。

| Kind | 测试番号 | 索引 strm |
|------|----------|-----------|
| japan_censored | **SONE-001** | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |
| japan_uncensored | **CARIB-010117-339** | `media/本地索引/日本无码/加勒比/CARIB/CARIB-010117-339.strm` |
| fc2（PPV） | **FC2-PPV-3275049** | `media/本地索引/FC2/未分类/FC2PPV/FC2-PPV-3275049.strm` |
| fc2（非 PPV） | **FC2-1545500** | `media/本地索引/FC2/未分类/FC2/FC2-1545500.strm` |
| china | **MDX-0001** | `media/本地索引/国产无码/麻豆传媒/MDX/MDX-0001.strm` |
| western | **PURETABOO.2026.07.14** | `media/_e2e/western/PURETABOO/PURETABOO.2026.07.14.strm`（ThePornDB） |
| western | **WeLiveTogether.12.02.23** | `media/_e2e/western/WeLiveTogether/WeLiveTogether.12.02.23.strm`（AVHeat） |
| fc2（PPV 统一） | **FC2-PPV-3275049** | `media/本地索引/FC2/未分类/FC2PPV/FC2-PPV-3275049.strm`（fc2_hub / fd2ppv） |

查看全部映射：`npx tsx scripts/e2e-sone-source.ts --list`  
换片：`--strm=media/本地索引/.../XXX.strm`

E2E 报告输出：`media/**/_scrap/{源}/organized/e2e-report.json`

---

## 3. 总览（现行 31 源）

> 以 `sourceMaster.ts` + 磁盘 `e2e-report.json` 为准（2026-08-24 刷新）。

| 源 | 分组 | E2E 样例 | E2E | 文档 |
|----|------|----------|-----|------|
| JavBus / DMM / LibreDMM / Jav321 / … | AV | SONE-001 | ✅ | 见 [sources/](./sources/) |
| JavDB | AV | SONE-001 | ❌ 过盾 | — |
| Avmoo / AvSox / AvBase / JavLibrary / MissAV / NJAV / … | AV/综合 | 各 fixture | ✅ | 见 sources |
| Caribbean / AvSox | 无码 | CARIB-010117-339 | ✅ | [carib](./sources/carib.md) [avsox](./sources/avsox.md) |
| FC2 Hub / FC2-PPV | FC2 | FC2-PPV-3275049 | ✅ | [fc2_hub](./sources/fc2_hub.md) [fd2ppv](./sources/fd2ppv.md) |
| FC2 | FC2 | FC2-1545500 | ✅ | [fc2](./sources/fc2.md) |
| Madou / Madouqu / 小黄书 / 黄色仓库 | 国产 | MDX-* | ✅ | 见 sources |
| LuluBar | 综合 | SONE-001 | ✅ | [lulubar](./sources/lulubar.md) |
| ThePornDB | 欧美 | PURETABOO.2026.07.14 | ✅ | [theporndb](./sources/theporndb.md) |
| AVHeat | 欧美 | WeLiveTogether.12.02.23 | ✅ | [avheat](./sources/avheat.md) |

**统计（2026-08-24）**

- Catalog：**31** 源，**31** 已实现  
- 磁盘 E2E 报告：**30/31**（缺 **javdb**）

---

## 4. 逐源明细

### 4.1 AV 组

#### JavBus — ✅ 全通过

| 项目 | 结果 |
|------|------|
| 索引样例 | SONE-001 |
| 刮削 | ✅ ~746–780ms |
| 封面 | ✅ javbus 域；右侧裁剪 |
| 转移 | ✅ hardlink |
| 命名 | `日本有码/エスワン ナンバーワンスタイル/SONE/SONE-001/SONE-001.strm` |
| 水印 | 配置未出有码角标（markCensored=false） |
| NFO | ✅ 六项齐全 |
| 报告 | `media/片商目录/日本有码/SONE/SONE-001/_scrap/javbus/organized/e2e-report.json` |

#### JavDB — ❌ 未通过

| 项目 | 结果 |
|------|------|
| 索引样例 | SONE-001 |
| 刮削 | ❌ 过盾超时 / 无响应（proxy_flare；出口 CF 403 敏感） |
| E2E | 未测 |
| 备注 | 可试换代理出口；进阶路线 mdcx App API 未接入 |

#### DMM — ✅ 全通过

| 项目 | 结果 |
|------|------|
| 索引样例 | SONE-001 |
| 刮削 | ✅ ~317ms；GraphQL `api.video.dmm.co.jp` |
| 封面 | ✅ ~909KB DMM pl.jpg |
| 转移 | ✅ hardlink |
| 命名 | 同 JavBus（含 studio 路径段） |
| 水印 | 配置未出有码角标 |
| NFO | ✅ 六项齐全 |
| 报告 | `.../SONE-001/_scrap/dmm/organized/e2e-report.json` |

#### LibreDMM — ✅ 全通过

| 项目 | 结果 |
|------|------|
| 索引样例 | SONE-001 / **SONE-002** |
| 刮削 | ✅ ~415–557ms；JSON `/movies/{code}.json` |
| 封面 | ✅ mono pl（outlet CID `77sone00x`） |
| 转移 | ✅ skip / hardlink |
| NFO | ✅ 已采集项 **21/21 必过** |
| 字段 | **19/30** |
| **注意** | 命中 **アウトレット** 条目，非 digital 正式作 |
| 报告 | [libredmm.md](./sources/libredmm.md) |

#### AirAV — 🔧 未实现

Provider stub；未测。

#### AirAV.io — ❌ 刮削失败

| 项目 | 结果 |
|------|------|
| 刮削 SONE-001 | ❌ 详情页不匹配（~110s；搜索/跳转消歧问题） |
| E2E | 未测 |

#### AvSox — ❌ 刮削失败

| 项目 | 结果 |
|------|------|
| 刮削 SONE-001 | ❌ 搜索无结果（~62s；Flare + 站点索引） |
| E2E | 未测 |

#### Avmoo — 🔧 未实现

Provider stub；未测。

#### Jav321 — ✅ 全通过

| 项目 | 结果 |
|------|------|
| 刮削 | ✅ ~453ms；POST `/search` → 详情 |
| 封面 | ✅ DMM digital pl.jpg |
| 转移 | ✅ skip |
| 命名 | `日本有码/エスワン ナンバーワンスタイル/SONE/SONE-001/...` |
| NFO | ✅ 已采集项 17/17 必过 |
| 字段 | **15/30** → **18/30**；未采集含 actor/series/genre/votes（见 [jav321.md](./sources/jav321.md)） |
| 报告 | `.../SONE-001/_scrap/jav321/organized/e2e-report.json` |

#### JavLibrary / MissAV / AVBase / MGStage — 🔧 未实现

Provider stub；未测。

#### Caribbean — ✅ 全通过

| 项目 | 结果 |
|------|------|
| 索引样例 | **CARIB-010117-339**（不可用 SONE-001） |
| 刮削 | ✅ ~934ms |
| 封面 | ✅ caribbeancom l_l.jpg（103KB） |
| 转移 | ✅ skip |
| 命名 | `日本无码/カリビアンコム/CARIB-010117-339/CARIB-010117-339/...` |
| 水印 | ✅ **uncensored** 角标 |
| NFO | ✅ 已采集项 **23/23 必过** |
| 字段 | **21/30** |
| 报告 | [carib.md](./sources/carib.md) · `media/_e2e/japan_uncensored/CARIB-010117-339/_scrap/carib/organized/e2e-report.json` |

---

### 4.2 FC2 组

#### FC2 Hub — ✅ 通过（2026-08-24 · FC2-PPV-4962908）

| 项目 | 结果 |
|------|------|
| 索引样例 | **FC2-PPV-4962908**（推荐；旧样例 3275049 标签空/旧图易 404） |
| L1 / 测通 | ✅ 13/13 · probe flare |
| 刮削 | ✅ studio=`野菜` · genres 齐 · series=`FC2系列` · trailer |
| 封面 | ✅ thumbnail CDN · 145KB · poster/thumb |
| 剧照 | ✅ extrafanart ×3 |
| 转移 | ✅ hardlink |
| NFO | ✅ 已采集 **26/26** |
| 详情 | [sources/fc2_hub.md](./sources/fc2_hub.md) |

#### FC2 — ⚠️ 部分通过

| 项目 | 结果 |
|------|------|
| 索引样例 | **FC2-1545500** |
| 刮削 | ✅ ~4.1s；官方 adult.contents.fc2.com |
| 封面 | ✅ ~8KB |
| 转移 | ✅ hardlink |
| 命名 | `FC2/ハメタロウ/FC2/FC2-1545500/...` |
| 水印 | ✅ uncensored + face crop |
| NFO | ⚠️ 缺 **actor** |
| 报告 | `media/_e2e/fc2/FC2-1545500/_scrap/fc2/organized/e2e-report.json` |

#### FC2-PPV（fd2ppv）— ✅ 通过（2026-08-24）

| 项目 | 结果 |
|------|------|
| 索引样例 | **FC2-PPV-3275049**（4962908 在 FD2 **无条目 404**） |
| L1 / 测通 | ✅ 2/2 · probe **curl** ~2s · access=`proxy_adaptive` |
| 刮削 | ✅ actor=`えりか` · studio · genres · premiered/runtime |
| 封面 | ✅ xximgs.webp · ~3KB · poster/thumb |
| 转移 | ✅ |
| NFO | ✅ 已采集 **21/21** |
| 详情 | [sources/fd2ppv.md](./sources/fd2ppv.md) |

---

### 4.3 国产组

#### Madou — ⚠️ 部分通过

| 项目 | 结果 |
|------|------|
| 索引样例 | **MDX-0001**（SONE-001 会「未找到」） |
| 刮削 | ✅ ~2.2s |
| 封面 | ✅ madou.club |
| 转移 | ✅ hardlink |
| 命名 | `国产/麻豆番外篇/MDX/MDX-0001/...` |
| 水印 | ✅ uncensored |
| NFO | ⚠️ 缺 **premiered** |
| 报告 | `media/_e2e/china/MDX-0001/_scrap/madou/organized/e2e-report.json` |

#### Madouqu — ❌ 待补测

| 项目 | 结果 |
|------|------|
| 刮削 SONE-001 | ❌ 未找到 |
| E2E MDX-0001 | 未跑 |
| 待办 | `npx tsx scripts/e2e-sone-source.ts --id=madouqu` |

---

### 4.4 备选组

#### FreeJavBT — ⚠️ 部分通过

| 项目 | 结果 |
|------|------|
| 刮削 | ✅ ~869–974ms |
| 封面 | ✅ 第三方图床 |
| 转移 | ✅ hardlink |
| NFO | ⚠️ 缺 **studio** |
| 报告 | `.../SONE-001/_scrap/freejavbt/organized/e2e-report.json` |

#### 7MMTV — 🔧 未实现

Provider stub；未测。

#### iQQTV — ✅ 全通过

| 项目 | 结果 |
|------|------|
| 刮削 | ✅ ~1.8–2.8s；中文标题/简介 |
| 封面 | ✅ iqqk4.quest |
| 转移 | ✅ hardlink |
| 命名 | `日本有码/S1 Style/SONE/SONE-001/...` |
| NFO | ✅ 六项齐全 |
| 报告 | `.../SONE-001/_scrap/iqqtv/organized/e2e-report.json` |

#### ThePornDB — ✅ 全通过（2026-08-24）

| 项目 | 结果 |
|------|------|
| 刮削 | ✅ SONE-001（日番）· PURETABOO.2026.07.14（欧美 `--strm`） |
| E2E | ✅ NFO 20/20 |
| 备注 | UI 主站 `theporndb.net` · API `api.theporndb.net` · 欧美 `parse=` 搜索 |

#### AVHeat — ✅ 全通过（2026-08-24）

| 项目 | 结果 |
|------|------|
| 刮削 | ✅ ~30s（Flare wait=5s；偶发 session 重试） |
| 样例 | **WeLiveTogether.12.02.23** · 标题 Office Play |
| 封面 | ✅ 126236 bytes · netcdn |
| 剧照 | ✅ extrafanart ×6 |
| NFO | ✅ 已采集项 **20/20 必过** |
| 报告 | `media/_e2e/western/WeLiveTogether.12.02.23/_scrap/avheat/organized/` |
| 备注 | AIO **wav** 族；识别码 `Series.YY.MM.DD`；`RK.2012.02.23` 站内搜不到 |
| 详情 | [sources/avheat.md](./sources/avheat.md) |

#### 小黄书 — ✅ 已实现

| 项 | 结果 |
|----|------|
| 刮削 / E2E | ✅ 2026-08-24（MDX-0006；单源须 `proxyUrl: null` 直连） |
| 详情 | [sources/xiao_huang_shu.md](./sources/xiao_huang_shu.md) |

---

## 5. 批量刮削快照（SONE-001）

来源：`media/片商目录/日本有码/SONE/SONE-001/_scrap/summary.json`（2026-08-22）

仅刮削、无整理/NFO；**FC2/Carib/Madou 等因番号格式在此 batch 中误标失败**，应以 §2 索引样例为准。

| 源 | 刮削 | 耗时 | 错误 |
|----|------|------|------|
| javbus | ✅ | 780ms | — |
| javdb | ❌ | — | 过盾超时 |
| libredmm | ✅ | 1170ms | — |
| airav_io | ❌ | 110s | 详情页不匹配 |
| avsox | ✅ | ~31s | E2E 18/30 · [详情](./sources/avsox.md) |
| jav321 | ✅ | 1003ms | — |
| carib | ✅ | ~16s | E2E 22/30 · [详情](./sources/carib.md) |
| fc2_hub / fc2 / fd2ppv | ❌ | — | 番号格式无效 ※ |
| madou / madouqu | ❌ | — | 未找到 ※ |
| freejavbt | ✅ | 869ms | — |
| iqqtv | ✅ | 2811ms | — |
| theporndb | ❌ | — | 缺 API Key |

---

## 6. 已知问题与待办

| 优先级 | 项 | 说明 | 状态 |
|--------|-----|------|------|
| P1 | JavDB 过盾 | 批量易超时；换出口 / 稳 Flare；可选后续接 mdcx App API | 开放（非框架阻断） |
| P1 | fc2_hub 封面 | fancybox 优先已对齐 MDCX；失效 storage 链靠多源合并补图 | 开放（站点限制） |
| P2 | jav321 缺 actor/genre | SONE-001 精简页无 star/genre 链接；rating 已补 | 站点限制 |
| P2 | carib rating/trailer | 站点无结构化字段 | 站点限制 |
| P2 | theporndb 缺 Key | UI 卡片显示「缺 Key」徽章；填控制台 Token 后可用 | ✅ UI 提示已加 |
| P3 | AVHeat 索引覆盖 | 本地 `STUDIO.YYYY.MM.DD` 须映射站点 ID | 开放 |
| P3 | LibreDMM outlet | 文档化或优先正式作 CID | 开放 |
| P3 | 有码水印角标 | `markCensored=true` 重验 | 配置项 |

---

## 7. 复现命令

```powershell
cd e:\MDCS\apps\server

# 查看索引样例表
npx tsx scripts/e2e-sone-source.ts --list

# 单源 E2E（日本有码）
npx tsx scripts/e2e-sone-source.ts --id=javbus

# 单源 E2E（加勒比 / FC2 / 国产 / 欧美）
npx tsx scripts/e2e-sone-source.ts --id=carib
npx tsx scripts/e2e-sone-source.ts --id=fc2
npx tsx scripts/e2e-sone-source.ts --id=madou
npx tsx scripts/e2e-sone-source.ts --id=avheat
npx tsx scripts/e2e-sone-source.ts --id=theporndb

# 仅刮削（batch，默认 SONE-001 多源）
npx tsx scripts/scrape-sone-sources.ts --id=jav321

# 自定义索引片
npx tsx scripts/e2e-sone-source.ts --id=fc2_hub --strm=media/本地索引/FC2/未分类/FC2PPV/FC2-PPV-4963424.strm
```

---

## 8. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-08-24 | E2E fixtures：FC2 组统一 3275049 · ThePornDB 改 western 样例 · 日志总览刷新 |
| 2026-08-24 | ThePornDB E2E 闭环（SONE-001 + PURETABOO.2026.07.14） |
| 2026-08-22 | 初版：10 源 E2E + 15 源刮削快照；索引样例 fixtures；plan.ts libraryRoot 修复 |
