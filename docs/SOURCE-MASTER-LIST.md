# 数据源主清单（全站点）

> 版本：2026-08-23（**统计已过期**，现行以 `sourceMaster.ts` 为准：32 源全实现）  
> 用途：**MDCS / 色花 / MDCX / JavSP 四方对照**（历史全量表仍可作参考）。  
> **现行 UI catalog**：`sourceMaster.ts` **32 源**（综合站 + 品类枢纽；**已实现 32**）。2026-08-23 起清除单厂/窄前缀与主站冗余 API；2026-08-24 后陆续补齐 njav/r18dev/avsex/hscangku 等。  
> **最新体检**：[FRAMEWORK-AUDIT.md](./FRAMEWORK-AUDIT.md)  
> 相关：[SOURCE-CATALOG-8REF.md](./SOURCE-CATALOG-8REF.md) · [SOURCE-TEST-STRATEGY.md](./SOURCE-TEST-STRATEGY.md) · [catalog.ts](../apps/server/src/scrape/providers/catalog.ts)

---

## 1. 分层说明

| 层级 | 含义 | UI 卡片 | 实现优先级 |
|------|------|---------|------------|
| **T1** | MDCS 当前 catalog（综合站 + 品类枢纽） | ✅ 显示 | **32/32 已实现**（以 `sourceMaster.ts` 为准） |
| **T2** | MDCX 有爬虫、MDCS 未收录 | ❌ 暂不显示 | 按需求 backlog |
| **T3** | API 变体 / 同站多通道 | ❌ 合并到主源或高级设置 | 随主源接入 |
| **T4** | 无码官方子站（MDCX `official`） | ❌ | carib 已覆盖加勒比；其余按需 |
| **T5** | JavSP 等其它参考独有 | ❌ | 低优 |
| **—** | 非刮削源（论坛、工具类） | ❌ | 不纳入 |

**ID 映射惯例**

| MDCX | MDCS | 说明 |
|------|-------|------|
| fc2hub | fc2_hub | 同 javten |
| fc2ppvdb | fd2ppv | MDCX 用 fc2cmadb.com；色花/MDCS 用 fd2ppv.cc |
| 7mmtv / MMTV | sevenmmtv | 同 7mmtv.sx |
| airav_cc | airav_io | airav.wiki 废弃；io/cn 为主 |
| missav | miss_av | 域名易变 |
| guochan | madou + madouqu | **非独立站**，番号/文件名 helper |

---

## 2. Tier 1 — MDCS UI Catalog（历史 24 源表 · 已过期）

> **注意**：下表为 2026-08-23 快照（含 stub 标注）。现行 catalog 见 `apps/server/src/scrape/providers/sourceMaster.ts`：**32 源全实现**（含 njav、r18dev、avsex、hscangku、lulubar、javday 等）。请以代码与 [FRAMEWORK-AUDIT.md](./FRAMEWORK-AUDIT.md) 为准。

按 UI 分组顺序（`catalog.ts` → `PROVIDER_GROUP_ORDER`）。

### AV 组（14）

| id | 名称 | 默认 URL | access | MDCS | 色花 | MDCX | 备注 |
|----|------|----------|--------|-------|------|------|------|
| javbus | JavBus | https://www.javbus.com | proxy | ✅ | ✅ | javbus | 镜像多域 |
| javdb | JavDB | https://javdb.com | proxy_flare | ✅ | ✅ | javdb | CD 10s |
| dmm | DMM | https://www.dmm.co.jp | proxy | ✅ | ✅ | dmm | GraphQL 主路径 |
| libredmm | LibreDMM | https://www.libredmm.com | proxy | ✅ | ✅ | libredmm | JSON API |
| airav | AirAV | https://www.airav.wiki | proxy_adaptive | stub | ✅ | — | wiki 常 403，优先 airav_io |
| airav_io | AirAV.io | https://airav.io/cn | proxy_adaptive | ✅ | ✅ | airav_cc | |
| avsox | AvSox | https://avsox.click | proxy_flare | ✅ | ✅ | avsox | AIO JSON API |
| avmoo | Avmoo | https://avmoo.shop | proxy_flare | stub | ✅ | avmoo | AIO JSON API |
| jav321 | Jav321 | https://www.jav321.com | proxy | ✅ | ✅ | jav321 | POST 搜索 |
| javlibrary | JavLibrary | https://www.javlibrary.com/cn | proxy_flare | stub | ✅ | javlibrary | |
| miss_av | MissAV | https://missav123.com | proxy_flare | stub | ✅ | missav | 域名易变 |
| avbase | AVBase | https://www.avbase.net | proxy_adaptive | stub | ✅ | avbase | |
| mgstage | MGStage | https://www.mgstage.com | proxy_adaptive | stub | ✅ | mgstage | adc=1 |
| carib | Caribbean | https://www.caribbeancom.com | proxy | ✅ | ✅ | official† | †MDCX 走 official 子模块 |

### FC2 组（3）

| id | 名称 | 默认 URL | access | MDCS | 色花 | MDCX |
|----|------|----------|--------|-------|------|------|
| fc2_hub | FC2 Hub | https://javten.com | proxy_flare | ✅ | ✅ | fc2hub |
| fc2 | FC2 官方 | https://adult.contents.fc2.com | proxy | ✅ | ✅ | fc2 |
| fd2ppv | FC2-PPV | https://fd2ppv.cc | proxy_flare | ✅ | ✅ | fc2ppvdb |

### 国产组（2）

| id | 名称 | 默认 URL | access | MDCS | 色花 | MDCX |
|----|------|----------|--------|-------|------|------|
| madou | Madou | https://madou.club | proxy | ✅ | ✅ | guochan‡ |
| madouqu | Madouqu | https://madouqu.com | proxy | ✅ | ✅ | madouqu |

‡ madou.club 为 MDCS/色花源；MDCX 用 guochan 番号解析 + mdtv/madouqu 等

### 备选组（5）

| id | 名称 | 默认 URL | access | MDCS | 色花 | MDCX |
|----|------|----------|--------|-------|------|------|
| freejavbt | FreeJavBT | https://www.freejavbt.com | proxy | ✅ | ✅ | freejavbt |
| sevenmmtv | 7MMTV | https://7mmtv.sx/zh | proxy_adaptive | stub | ✅ | 7mmtv |
| iqqtv | iQQTV | https://iqq5.xyz/cn | proxy | ✅ | ✅ | iqqtv |
| theporndb | ThePornDB | https://api.theporndb.net | proxy | ✅ | ✅ | theporndb |
| xiao_huang_shu | 小黄书 | https://xchina.co | proxy | stub | ✅ | — |

**T1 统计（历史）**：24 源 · 16 已实现 · 8 stub → **现行：32/32 已实现**

---

## 3. Tier 2 — MDCX 有、MDCS 未收录（18+ 主站）

建议 id 与 MDCX `Website` 枚举一致，入 catalog 时 `implemented: false`、`uiTier: 2`（待扩展字段）。

### 有码 / 片商官方

| 建议 id | 名称 | 默认 URL | access（建议） | MDCX 爬虫 | 说明 |
|---------|------|----------|----------------|-----------|------|
| faleno | Faleno | https://faleno.jp | proxy | faleno.py | 片商官网 |
| prestige | Prestige | https://www.prestige-av.com | proxy | prestige.py | API 搜索 |
| fantastica | Fantastica | https://fantastica-vr.com | proxy | fantastica.py | VR |
| dahlia | Dahlia | https://dahlia-av.jp | proxy | dahlia.py | |
| giga | GIGA | https://www.giga-web.jp | proxy | giga.py | |
| kin8 | Kin8 | https://www.kin8tengoku.com | proxy | kin8.py | 无码 |
| javday | JavDay | https://javday.app | proxy_flare | javday.py | |
| xcity | XCity | https://tc.xcity.jp | proxy | xcity.py | API 搜索 |
| r18dev | R18.dev | https://r18.dev | api | r18dev.py | JSON API |
| cableav | CableAV | https://cableav.video | proxy_flare | cableav.py | |

### FC2 / 聚合

| 建议 id | 名称 | 默认 URL | access | MDCX | 说明 |
|---------|------|----------|--------|------|------|

### 国产 / 中文

| 建议 id | 名称 | 默认 URL | access | MDCX | 说明 |
|---------|------|----------|--------|------|------|
| madouqu | Madouqu | https://madouqu.com | proxy | madouqu.py | |
| lulubar | LuluBar | https://lulubar.co | proxy | lulubar.py | |
| hdouban | 好豆瓣 | https://ormtgu.com | proxy | hdouban.py | |
| hscangku | 黄色仓库 | http://hsck.net | proxy | hscangku.py | |
| mywife | Mywife | https://mywife.cc | proxy | mywife.py | 人妻系 |

### AIO 家族（tellme.pw 动态域）

| 建议 id | 名称 | 默认 URL | access | MDCX | 说明 |
|---------|------|----------|--------|------|------|
| avheat | AVHeat | https://avheat.shop | proxy_flare | avheat.py | 欧美；AIO namespace wav |
| avsex | AVSex | https://avsex.cc | proxy | avsex.py | |

> avmoo / avsox 已在 T1；三者共用 AIO JSON API，域名 tellme.pw 动态解析。

### 里番 / Getchu

| 建议 id | 名称 | 默认 URL | access | MDCX |
|---------|------|----------|--------|------|
| getchu | Getchu | http://www.getchu.com | proxy | getchu.py |

---

## 4. Tier 3 — API 变体 / 多通道（不单独占 UI 卡片）

| id | 父源 | 默认 URL | 用途 | MDCX |
|----|------|----------|------|------|
| dmm_api | dmm | https://api.thejavdb.net/v1 | 第三方 DMM 聚合 API | dmm_api.py |
| javdb_api | javdb | https://javdb573.com | Web 镜像 + API | javdb_api.py |
| javdb_app | javdb | https://apidd.czssdgz.com | **App API**（免 Flare 备选） | javdb_app.py |
| missav_api | miss_av | https://missav.ws | Recombee API 通道 | missav_api.py |
| getchu_dmm | getchu | （同 getchu） | Getchu DMM 子模块 | getchu_dmm.py |
| official | — | （动态） | 路由到 prestige 等官网 | official.py |

**MDCS 接入建议**：javdb 优先接 `javdb_app` 作 Flare 失败 fallback；dmm 已直连 GraphQL，无需 dmm_api。

---

## 5. Tier 4 — 无码官方子站（MDCX `official_uncensored`）

| 子站 id | 名称 | 默认 URL | MDCS 状态 |
|---------|------|----------|------------|
| carib | Caribbean | https://www.caribbeancom.com | ✅ T1 `carib` |
| heyzo | HEYZO | https://www.heyzo.com | 未实现 |
| 1pondo | 1Pondo | https://www.1pondo.tv | 未实现 |
| pacopacomama | Pacopacomama | https://www.pacopacomama.com | 未实现 |
| 10musume | 10Musume | https://www.10musume.com | 未实现 |

番号路由见 MDCX `official_uncensored.py`（HEYZO-、CARIB-、010117- 等前缀）。

---

## 6. Tier 5 — JavSP 等其它参考（MDCS/MDCX/色花均无）

| id | 名称 | 说明 |
|----|------|------|
| fanza | FANZA/DMM | JavSP HTML 路线；MDCS 已用 DMM GraphQL |
| fc2fan | FC2Fan | FC2 聚合 |
| fc2ppvdb | FC2PPVDB | JavSP 名；≈ fd2ppv / fc2cmadb |
| avwiki | AVWiki | |
| javmenu | JavMenu | |
| njav | NJAV | |
| gyutto | Gyutto | 同人 |
| dl_getchu | DL Getchu | 里番 DL 版 |
| arzon | Arzon | 素人 |
| arzon_iv | Arzon IV | 写真 |

---

## 7. 故意不纳入

| 项 | 原因 |
|----|------|
| **forum** | 色花 TypeId 有；MDCS **故意不做**（论坛非元数据源） |
| **AIRAV** (airav.wiki) | MDCX 废弃枚举；用 airav_io |
| **guochan** | MDCX 模块名，非 URL；逻辑并入 madou/madouqu |
| **javspider_stack** | 磁力栈，非元数据 |

---

## 8. 全量 ID 速查（按字母）

<details>
<summary>点击展开 60+ id</summary>

```
10musume          T4  official 子站
1pondo            T4
airav             T1  stub
airav_io          T1  ✅
avbase            T1  stub
avheat            T2
avmoo             T1  stub
avsex             T2
avsox             T1  ✅
avwiki            T5
cableav           T2
carib             T1  ✅
dahlia            T2
dmm               T1  ✅
dmm_api           T3
faleno            T2
fantastica        T2
fc2               T1  ✅
fc2_hub           T1  ✅
fd2ppv            T1  ✅
freejavbt         T1  ✅
getchu            T2
getchu_dmm        T3
giga              T2
hdouban           T2
heyzo             T4
hscangku          T2
iqqtv             T1  ✅
jav321            T1  ✅
javbus            T1  ✅
javday            T2
javdb             T1  ✅
javdb_api         T3
javdb_app         T3
javlibrary        T1  stub
kin8              T2
libredmm          T1  ✅
lulubar           T2
madou             T1  ✅
madouqu           T1  ✅
mgstage           T1  stub
miss_av           T1  stub
missav_api        T3
mywife            T2
official          T3  路由
pacopacomama      T4
prestige          T2
r18dev            T2
sevenmmtv         T1  stub
theporndb         T1  ✅
xcity             T2
xiao_huang_shu    T1  stub
```

</details>

---

## 9. 扩展 catalog 路线图

| 阶段 | 动作 |
|------|------|
| **现在** | 本文档 + T1 24 源维持 UI |
| **Phase 1** | ~~catalog 增 tier~~ ✅ 64 源已全部入 UI catalog |
| **Phase 2** | 高价值 T2：javlibrary、miss_av、avbase、mgstage、sevenmmtv（与 T1 stub 合并实现） |
| **Phase 3** | javdb_app fallback；T4 heyzo/1pondo 等无码官方 |
| **Phase 4** | 小众 T2（getchu、kin8、prestige…）按需求 |

---

## 10. 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-22 | 初版：T1–T5 全站点主清单 + 四方对照 + 扩展路线 |
