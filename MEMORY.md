# Memory Bank

项目上下文与历史决策记录，按时间倒序追加。

---

## 2026-08-27 — 模块化重构 P0–P4

- **背景**：超大文件拆模块，提取通用逻辑，行为不变的纯重构。
- **决策/结论**：
  - P0：`styles.css` → `styles/` 多模块 + `index.css`
  - P1：前端 `api/`、`types/` 按域拆分
  - P2：`RecordDetailView` → `recordDetail/`；`NamingSettingsPanel` → `naming/`；`KindSettingsModal` drafts → `kindSettings/`
  - P3：`api/files.ts` → `api/files/` 路由模块；原文件 re-export
  - P4：`Pagination` 组件；`SettingRow` 已有共用
- **验证**：web/server typecheck、web build、server tests 402 pass
- **待办/遗留**：无（文档路径已同步；已 commit/push）

## 2026-08-27 — Dashboard 聚合 API + 活动分页 + 任务来源

- **背景**：主界面「建议后续（可选）」三项：聚合接口、活动服务端排序分页、真实来源字段。
- **决策/结论**：
  - `GET /api/dashboard` 一次返回 scrapeMax、actorTotal、周对比、recentActivity（分页/分类筛选）。
  - `jobs.trigger_source`（manual|monitor|qb）；监控/qB 建任务写入；files 列表 join 得 `triggerSource`。
  - 活动按 `COALESCE(organized_at, scraped_at, file_mtime) DESC` 排序；前端改 `fetchDashboard`，去掉 3 次独立 fetch。
- **待办/遗留**：历史任务/无 job_id 的文件来源显示「—」；Records 页仍按 id 排序（未改）。

---

- **背景**：按 FRAMEWORK-AUDIT 优先级继续修缺陷与改善项。
- **决策/结论**：
  - 宽屏模式落地（侧栏开关 + `mdcs.wideMode`）；暗色主题明确不做。
  - 水印样式扫描 API；theporndb「缺 Key」徽章；LLM `mdcs.llm.*`/`scrap.llm.*` 双写。
  - DESIGN / SOURCE-* / UI-DESIGN-SYSTEM / ROADMAP S1.3–1.6 文档对齐。
  - qB 设置 Tab 曾加后按用户要求删除（后端钩子仍保留，改 `ops.json`）。
- **待办/遗留**：JavDB 过盾、fc2_hub 封面属源站开放项；S4.14 revert / Amazon ASIN 仍为 P3 backlog。

---

## 2026-08-27 — 框架审计文档（v1.0 后体检）

- **背景**：用户要求对照文档检查框架是否还有缺陷/bug。
- **决策/结论**：新增 `docs/FRAMEWORK-AUDIT.md`；typecheck 通过；`npm test` 401/402（njav 搜索 fixture 404）；32 Provider 全实现；ROADMAP §1 / S6-ACCEPTANCE 同步更新。
- **待办/遗留**：JavDB/fc2_hub 等见 SOURCE-E2E §6；S1.6 主题宽屏与 DESIGN 规格二选一。

---

## 2026-08-27 — Gfriends 头像择优（Digigra 优先）

- **背景**：加藤ももか等头像抓到 AVDC 200×300  tight crop，观感「偏」。
- **决策/结论**：源权重 Digigra/GRAPHIS > Minnano > AVDC；合并 minnano 现名/别名查候选；下载多张后按竖构图+分辨率打分择优；保存完整原图。
- **待办/遗留**：已落盘旧头像需 `forceImage`/重新刮削才会换源。

---

## 2026-08-27 — 演员档案接 minnano + 头像完整显示

- **背景**：档案页只有假「映射名」简介；Gfriends 误选全身图且本地又做人脸裁切导致头像偏。
- **决策/结论**：
  - 档案：`minnano-av.com` 搜详情 → 生日/出身/三围标签/出道简介/外链；头像仍 Gfriends（优先写真站，见同日 Digigra 条目）。
  - 头像落盘不再方裁；前端 `object-fit: contain` 显示完整图。
- **待办/遗留**：wiki 级长简介未接；已刮削演员需点「重新刮削」刷新。

---

## 2026-08-27 — 演员映射表简中空文件修复

- **背景**：`enableActorMapping` 已开，但 `actors.zh-CN.json` 被写成 2 字节空文件，日文→中文实际不生效。
- **决策/结论**：从 mdcx `actor_database.xlsx` 重导四语种 actors 表（各约 5.1 万 key）；`loadNamedMap` 目标语种空表时回退其他语种；`resolveActorMapInfo` 复用 `mapActors(zh-CN)`。
- **待办/遗留**：已刮削入库的旧记录需重新刮削才会改名；改 maps 后需重启后端清内存缓存。

---

## 2026-08-27 — 演员本地档案刮削 + Emby 本地优先

- **背景**：刮削缓存页原先只聚合作品 actors 字段；用户要真刮削演员档案，Emby 同步优先用本地、免二次刮。
- **决策/结论**：
  - SQLite `actor_profiles` + `data/actors/{name}/avatar.*`；`POST /api/actors/scrape`（maps 规范化 + Gfriends 头像，头像失败仍落档）。
  - 列表/详情展示档案状态与头像；支持刮削选中/缺失。
  - `runEmbyActorSync` 本地档案优先写回 Emby，缺才走 Gfriends/映射，网络结果回写本地；返回 `fromLocal`。
- **待办/遗留**：百科类简介（wiki/minnano）未接；`actors.zh-CN.json` 仍为空需重导。

---

## 2026-08-26 — 封面日志相对路径 + data/covers 与片库路径澄清

- **背景**：详情刮削日志显示 `封面已保存：'E:/Mdcs/data/covers/...'`；用户要求相对路径，并质疑为何不是片库目标目录。
- **决策/结论**：
  - `data/covers/{kind}/` 是刮削阶段缓存，不是片库；整理阶段才把裁剪后的 `poster.jpg` / `thumb.jpg` 写入目标目录。
  - 日志文案改为「封面缓存已保存」+ 相对路径；整理补「海报/缩略图已写入」。
  - `coverLocal` 持久化为项目相对路径；读写用 `toProjectRelativePath` / `resolveProjectPath`。
  - 旧归档日志前端展示时净化绝对路径。
- **待办/遗留**：无（重跑刮削+整理后日志会带片库海报路径）。

---

## 2026-08-24 — 小黄书（xiao_huang_shu）E2E 通过

- **背景**：MDCX 无 crawler；xchina.co 全局代理 403；详情无 Referer 403；封面 `upload.xchina.io` undici/代理 403。
- **决策/结论**：
  - 搜索 `/search.html?keyword=` → `/video/id-*.html`；解析 JSON-LD `VideoObject`。
  - 单源 `proxyUrl:"null"`；封面 curl 直连 + Referer=`https://xchina.co/`。
  - 测通 `probeVia:curl` ~553ms；E2E `MDX-0006` 封面 53934 bytes · NFO 17/17。文档 `docs/sources/xiao_huang_shu.md`。
- **待办/遗留**：下一站按 UI 国产组顺序（`mdtv`）。

---

## 2026-08-24 — 黄色仓库（hscangku）E2E 通过 + 单站报告

- **背景**：门户 `hsck.net` 为 JS 跳转；搜索分页曾被当成详情；详情页封面常为广告 GIF。
- **决策/结论**：
  - 详情 href 仅认 `/v5/` 或 `/vodplay/`；门户解析 `strU` 跟镜像。
  - 单源 `baseUrl=https://556822.xyz` + `proxyUrl:"null"`；封面优先搜索卡 `data-original`。
  - E2E `MDX-0006`：封面 25546 bytes · NFO 9/9。文档 `docs/sources/hscangku.md`。
- **待办/遗留**：镜像会变，需在卡片里改 `baseUrl`；下一站 `xiao_huang_shu`。

---

## 2026-08-24 — Madouqu 单源直链落地 + E2E 修复完成

- **背景**：`madouqu` 在代理链路下出现 520/不稳定；切直连后可达，但 E2E 长时间 404 并误回落 Flare。用户要求该源单独走直链且不影响其他源。
- **决策/结论**：
  - `config/scrape.json` 为 `madouqu` 增加单源覆盖：`providerSettings.madouqu.proxyUrl = "null"`（仅该源禁用代理，全局代理保持原值）。
  - 修复 `scripts/e2e-fixtures.ts`：`resolveE2eFixture()` 优先使用 fixture 的 `code`，避免被 `sourceRel` 文件名覆盖，`madouqu` 实测样例改为 `MDX-0006`。
  - 修复封面链路：`fetchBuffer()` 支持 `proxyUrlOverride`；`downloadCover()` 透传源级 override，使封面下载与页面抓取一致走单源直连。
  - 复测结果：`madouqu` E2E（`MDX-0006`）全流程通过（刮削/封面/转移/海报水印/NFO 15/15）。
- **待办/遗留**：
  - `hdouban` 下一站按同一规范执行（MDCX 对照 → 测通 → E2E → 文档）。

---

## 2026-08-24 — fd2ppv 凭证 + curl-impersonate 直链已通

- **背景**：E2E 冷启动日志是 `curl-first`（无 cookie）→ 403 → Flare；用户指出本机已装 curl-impersonate，应能带 `cf_clearance`。
- **决策/结论**：磁盘 `data/meta/cf-clearance.json` 有 `fd2ppv.cc` 后，复刮打出 **`clearance-curl-ok`**（102403b / ~1.8s），**未走 Flare**。冷启动无有效凭证才会过盾；过盾后落盘，后续走 impersonate+cookie。
- **待办/遗留**：无。

---

## 2026-08-24 — 全源 impersonate curl（含 proxy_flare）

- **背景**：凭证+curl 原先只给 `proxy_adaptive`；javdb/avmoo/fc2_hub 等 `viaFlare:true` 直接过盾。
- **决策/结论**：有 curl-impersonate 时**所有源**先 curl（有 `cf_clearance` 则带 cookie+UA）；失败再 undici/Flare。SPA（`waitInSeconds`）空壳仍过盾。无 impersonate 时行为与改前一致。
- **待办/遗留**：重启服务后看 `curl-first` / `clearance-curl-ok`；avmoo 类仍可能 `via=flare`。

---

## 2026-08-24 — curl-impersonate（凭证+curl / 飞牛 NAS）

- **背景**：裸 `curl.exe` TLS ≠ Flare Chrome，`cf_clearance` 带不上；Windows `.bat` 包装 Node `spawn` 会 EINVAL。
- **决策/结论**：
  - 用 **lexiforest curl-impersonate v2.1.1**，`--impersonate chrome136`。
  - 本机：`tools/curl-impersonate/curl-impersonate.exe`；用户环境变量 `SCRAPE_CURL_BIN` / `SCRAPE_CURL_IMPERSONATE`。
  - 飞牛：Docker 镜像安装到 `/usr/local/bin/curl-impersonate`（amd64/arm64）。
  - `download.ts` 自动发现 `tools/` 或 `/usr/local/bin`，`.bat` 改打 exe。
- **待办/遗留**：飞牛需重新 `docker compose build`；本机重启 Cursor 后再跑带 clearance 的 scrape。

---

## 2026-08-24 — 对齐色花 Flare 会话生命周期

- **背景**：fc2_hub 复测卡死；对照 sehua / mdcx：色花靠全局单会话 + flareMonitor 清孤儿；mdcx 根本不开 session。
- **决策/结论**：
  - 失败路径：清本地后 **异步 destroy**（短超时），再 no-session 直打。
  - 新增 `flareMonitor.ts`：30s 清孤儿（`keepOwned`）；服务启动 `startScrapeNetworkRuntime()`。
  - **测通强制 `noSessionRetry`**，禁止 probe `sessions.create`（复测：fc2_hub probe ~18s · sessions=0）。
- **待办/遗留**：fc2_hub E2E 封面 storage 404；正式 E2E 待 Flare 稳定后再跑。

---

## 2026-08-24 — FlareSolverr 会话只开不关卡死修复

- **背景**：fc2_hub E2E/脚本并行时日志出现多次 `flare session create`，远端 Chrome 残留导致 FS 卡死。
- **决策/结论**：
  - `ensureHostSession` 创建前先 `sessions.list` + destroy 孤儿。
  - `destroySession` 打日志；`applyFlareSolverr` 换 URL 时真正 destroy。
  - 进程 exit / SIGINT / SIGTERM / e2e 结束调用 `releaseFlareSession` + `recycleFlareSessions`。
  - 紧急脚本：`npx tsx scripts/_flare-recycle.ts`（已清到 sessions=0）。
- **待办/遗留**：fc2_hub 完整落地（封面 storage 404）另续。

---

## 2026-08-24 — 多源字段 parser 优化（fc2 / carib / avsox / miss_av）

- **背景**：FC2 官方因中文 UI 标签（上架时间）漏采 premiered 等；用户问其它已测站是否同类问题。
- **决策/结论**：
  - **fc2**：多标签 premiered/runtime/JSON-LD 评分/og:video · E2E **13→23/30** · L1 6/6。
  - **carib**：`parseCaribRating`（★★★★★）· website · trailer smovie 兜底 · E2E **22→26/30** · L1 13/13。
  - **avsox/avmoo**：补 `website` · avsox 补 director 解析（值为 `-` 时跳过）。
  - **miss_av**：简繁标签别名（女優/發行商/標籤等）。
  - 新增 `scripts/_field-audit.ts`：对照 debug HTML 做漏采审计。
- **待办/遗留**：avsox/miss_av 缺项多为源站无 plot/trailer；dmm votes 已接 GraphQL total。

---

- **背景**：无码组 #2；旧 parser 按 JavBus 系 HTML，现站已迁 **AIO Quasar SPA**（与 Avmoo 同族）。
- **决策/结论**：
  - 重构 `avsox.ts`：复用 `pickAvmooMoviePath` / `isAioThinShell` · 新增 `avsoxSearchQueries`（CARIB→010117-339）。
  - 分组 **`uncensored`** · access **`proxy_flare`** · 测通 flare ~10s。
  - L1 **6/6**；Live **CARIB-010117-339** ~36s ✅；e2e-fixtures 改无码样例。
  - E2E **CARIB-010117-339** ✅：18/30 · NFO 20/20 · 封面 55KB · flare ~31s；e2e 过盾源 timeout 180s。
- **待办/遗留**：无。

---

## 2026-08-24 — Caribbean (carib) 完整落地

- **背景**：UI 无码组 Caribbean 卡片；`index.ts` 已注册但 `carib.ts` 缺失。
- **决策/结论**：
  - 实现 `carib.ts` + `carib.test.ts`（12/12）；直链 `/moviepages/{MMDDYY-NNN}/index.html`。
  - 分组 **`uncensored`** · access **`proxy_adaptive`** · 测通 `probeVia: curl` ~561ms。
  - EUC-JP：`fetchViaCurl` 改读 HTML meta charset（修 download.ts 硬编码 UTF-8）。
  - 演员限 `li.movie-spec` 出演行；genres 仅 `itemprop=genre`；premiered 番号 MMDDYY 兜底。
  - E2E **CARIB-010117-339**：22/30 字段 · NFO 24/24 · 封面 104KB · extrafanart 30 · 无码水印。
- **待办/遗留**：无。

---

## 2026-08-24 — access 两档：proxy 并入 adaptive

- **背景**：`proxy` 与 `proxy_adaptive` 取页入口相同，差只在遇盾是否回落 Flare；UI 三档易误导。
- **决策/结论**：
  - catalog 原 `proxy` **全部改为 `proxy_adaptive`**；`normalizeProviderAccess` 把遗留 `proxy`/`direct` 归一为 adaptive。
  - 取页：自适应 = curl→短 Node，遇盾 Flare；仅 `proxy_flare` 强制过盾。
  - UI 卡片只显示 **自适应 / 过盾**；同组排序 adaptive → flare。
- **待办/遗留**：旧测通文档仍可能写三档，以本决策为准。

---

## 2026-08-24 — NJAV #18 完整落地（123AV 迁移）

- **背景**：综合组 #18 stub；JavSP 参考 `references/JavSP/javsp/web/njav.py`；MDCX 无 njav。
- **决策/结论**：
  - **域名迁移**：`njav.tv` → **`123av.com/ja`**（旧域搜索页仅迁移提示，无业务 HTML）。
  - **取数链**：JavSP 对齐 `/search?keyword={code}` → `/ja/v/{slug}`；解析新 DOM `watch__info-row`（旧 `detail-item` 作回退）。
  - **分类**：`general` + **`proxy_adaptive`**（Flare 冷启动 → curl ~0.9s）。
  - **封面**：`icdn.123av.me` · Referer=详情页 · E2E ~59KB。
  - **E2E SONE-001**：19/30 字段 · NFO 21/21 · studio/series/runtime 齐。
  - 文档：`docs/sources/njav.md` · `SOURCE-SINGLE-SITE-TEST.md` #18 ✅。
- **待办/遗留**：plot 站点无；UI 需刷新见 implemented。

---

## 2026-08-24 — MissAV #17 完整落地 + UI 全局参数接线

- **背景**：综合组 #17 stub；用户要求分类准确、完整 E2E；此前会话因 Agent 上下文截断多次未完成交接。
- **决策/结论**：
  - **Provider**：`miss_av.ts` — 直链 `/cn/{code}` → 搜索回退；解析 og + 详情区 `space-y-2`；fixture `data/_debug/missav-*`。
  - **分类**：`group: general`（日/无/国产聚合）；**`access: proxy_adaptive`**（非 proxy_flare）— 冷启动 cookie-direct 403→Flare；clearance 复用后 **curl ~0.5s**。
  - **封面**：fourhoi CDN 须 Referer=MissAV 详情页 → `imageReferer.ts` 增 `fourhoi.com` / `miss_av` 映射。
  - **全局 UI→后端**（非单站）：`fetchPageWithOpts` / `fetchPageForSite` / `siteFetchOpts`（proxy/UA/cookie）；`resolveProviderRetry`→orchestrator；GET `/api/scrape/config` `loadScrapeConfig(true)`；avbase/mgstage/sevenmmtv/airav/airav_io 改统一取页。
  - **E2E SONE-001**：25/30 字段 · 封面 ✅ · NFO 27/27 必过 · 通道 curl。
  - 文档：`docs/sources/miss_av.md` · `SOURCE-SINGLE-SITE-TEST.md` #17 ✅。
- **待办/遗留**：UI 下一项 **njav** #18；Agent 长任务易截断→一站一新对话 + MEMORY 交接。

---

## 2026-08-24 — JavLibrary #16 完整实战

- **背景**：UI 有码组 #16；用户本机可开官方 `javlibrary.com/cn`；服务端镜像须 Flare。
- **决策/结论**：
  - 对齐 JavSP/MDCX：镜像 f101w/c97k · CN 单次搜索 · `div.video` 新详情链。
  - 探针卡死根因：多域名串行 55s → 单镜像 Flare 优先，热 session ~4s。
  - E2E SONE-001：26/26 NFO · 封面 142KB · 24/30 字段 · `probeVia: flare`。
  - 分类：`av` + `proxy_adaptive`（镜像必 Flare；官方站浏览器或直连）。
  - 文档：`docs/sources/javlibrary.md` · `SOURCE-SINGLE-SITE-TEST.md` #16 ✅。
- **待办/遗留**：plot/series 站点无；可选 JA 详情补 titleZh（当前 CN 页亦为日文标题）。

---

## 2026-08-24 — 单站测试 §1.1 分类/链接核验规范

- **背景**：JavDay 初按 MDCX/文档放有码组+强制过盾；与用户认知不符。
- **决策/结论**：
  - 每站 E2E 后**必做** §1.1「分类与链接核验」；MDCX/旧文档**仅参考**。
  - `group` 看站点真实片种边界（跨品类 → `general`）；`access` 看 `probeVia`/刮削日志，不与分组绑定。
  - JavDay：`general` + `proxy_adaptive`（实测 direct ~0.9s，非 flare）。
  - 规范已写入 `docs/SOURCE-SINGLE-SITE-TEST.md` §1.1 + 报告模板。
- **待办/遗留**：已测源（avmoo/avsex 等）可择机按 §1.1 复核 group/access。

---

## 2026-08-23 — AVSex 单站复测 + extrafanart 接线

- **背景**：UI #14；实现已存在，补全剧照输出与测通稳定性。
- **决策/结论**：
  - `avsex.ts`：`parseAvsexDetailHtml` / scrape 输出 `extrafanartUrls`（live 12 张）。
  - `probe.ts`：avsex 超时 55s、`strictTimeout` 首请求放宽；测通 ✅ flare 6409ms。
  - E2E SONE-001：19/30 元数据 OK；`image.avsex.cc` CDN 403 → 封面/海报/剧照落盘失败（已知，cover 源保留 javbus）。
- **待办/遗留**：CDN 封面 bypass；UI 顺序下一项 **javdb**（#13 未测）。

---

- **背景**：单站测试 #12，原为 stub；SONE-001 不在 MGStage，E2E 改用 ABP-001。
- **决策/结论**：
  - 新增 `mgstage.ts`：解析 `detail_data` 表格 + `#introduction` + `#sample-photo`；`adc=1` Cookie。
  - 评分 4.2 + votes(4)；封面 `EnlargeImage`；搜索降级。
  - E2E ABP-001：28/30 · extrafanart 8/8 · NFO 30/30；缺 director（站点无）、trailer（API 不稳定）。
- **待办/遗留**：预告片 `sampleplayer/sampleRespons.php` 待出口/API 稳定；UI 顺序下一项 **javdb**。

---

- **背景**：单站测试 #11，原为 stub（E2E 报「源暂未实现」）。
- **决策/结论**：
  - 新增 `avbase.ts`：解析 Next.js `__NEXT_DATA__`（`/works/{CODE}` 详情 + `/works?q=` 搜索降级）。
  - 对齐 MDCX #449：演员名过滤纯数字序号；FANZA product 优先；封面 ps→pl。
  - `sourceMaster` `implemented: true`；注册 `index.ts`；`avbase.test.ts` 7/7。
  - E2E SONE-001：26/30 · extrafanart 15/15 · NFO 28/28；缺 rating/votes（站点无）。
- **待办/遗留**：UI 顺序下一项 **MGStage**（仍为 stub）。

---

- **背景**：用户要求未保留的 Scrap 残留一并清理。
- **决策/结论**：
  - 移除 `SCRAP_API_TOKEN` / `SCRAP_WEB_DIST` / `X-Scrap-Token` 向后兼容，仅保留 MDCS 环境变量与请求头。
  - SQLite 库名 `scrap.db` → `mdcs.db`；启动时自动重命名旧库（含 `-wal`/`-shm`）。
  - 前端 localStorage 仅 `mdcs.llm.*`；启动日志/导出文件名此前已统一为 `mdcs` 前缀。
- **待办/遗留**：`config/scrape.json`、`/api/scrape` 等为刮削领域术语，非旧项目名，保持不变。

---

## 2026-08-23 — 项目改名 MDCS

- **背景**：用户要求项目从 Scrap 改名为 mdcs。
- **决策/结论**：
  - npm 包名：`mdcs` / `mdcs-server` / `mdcs-web`；UI/文档/健康检查 `service: mdcs-server`。
  - 环境变量：`MDCS_API_TOKEN` / `MDCS_WEB_DIST` / `X-Mdcs-Token`。
  - 文档与脚本路径统一为 `e:\mdcs`（工作区目录待用户手动重命名）。
- **待办/遗留**：若 Cursor 工作区仍指向 `e:\Scrap`，需关闭后重开 `e:\mdcs`；GitHub 已推 `https://github.com/poillysky/mdcs`（main）。

---

- **背景**：extrafanart URL 可采（×15 jdbstatic），但下载需 javdb Referer/会话；当前环境 javdb 本身连不上，Flare 预热会长时间阻塞 E2E。
- **决策/结论**：解析层保留 extrafanart URL；`extrafanart.ts` 对 jdbstatic URL 跳过下载；删除 `downloadJdbstaticImage` 与临时脚本 `_test-jdb-dl.ts`。
- **待办/遗留**：逐站测试 **#3 iQQTV**；javdb 网络恢复后可再评估 jdbstatic 下载策略。

## 2026-08-23 — 设置 backlog 落地（Tenhow/Amazon/水印/fieldPriority）

- **背景**：用户要求完善设置审计中未落地项。
- **决策/结论**：
  - 新增 `scrape/hdPoster.ts`：Tenhow 演员索引搜 ASIN 图 → Amazon 标题/ASIN 搜图 → DMM 高清跳过 → strictMode 中止。
  - `runner.ts` 刮削封面阶段调用 `enhanceCoverWithHdPosters`。
  - 水印 `style`/`style4k` 经 `resolveWatermarkAssetDir` 映射 `assets/watermarks/{id}`（customDir 仍优先）。
  - 前端：下载 Tab 启用 Tenhow/严格模式；分区弹窗数据源 Tab 增加 `FieldPriorityEditor`。
  - 单测：`hdPoster.test.ts` · `poster.test.ts` resolveWatermarkAssetDir。
- **待办/遗留**：Amazon/Tenhow 需代理访问日亚/tenhow.net；实网刮削验收待用户跑任务。

## 2026-08-23 — MDCX 对齐 §8 六项收尾

- **背景**：用户问「5 待办能否完成」；指 `SETTINGS-MDCX-ALIGNMENT.md` §8 与 `SETTINGS-CONFIG-AUDIT.md` backlog 中可短期完成项。
- **决策/结论**：
  - §8 六项全部 ✅：NFO titleZh 优先、originaltitle 番号前缀、airav_io originalPlot、fieldPriority.originalPlot、KindSettingsModal 命名提示、`e2e-sone-source.ts --merge` 多源验收。
  - backlog 完成：outlineNoCdata UI、merge E2E；**未做** Tenhow/Amazon 搜图、分区 fieldPriority 编辑器（大功能）。
  - 单测：`nfo.test.ts` 3/3 · `merge.test.ts` 14/14。
- **待办/遗留**：可选跑 `--merge` 实网验收 SONE-001；逐站测试 **#11 avbase**。

## 2026-08-23 — 设置 UI 落地审计 + 配置修复

- **背景**：用户问设置参数是否真正生效；发现 kindProfiles 目录模板等「写了不用」。
- **决策/结论**：
  - 文档 `docs/SETTINGS-CONFIG-AUDIT.md`：分 Tab 标注 ✅/⚠️/❌。
  - 修复：merge  respect `useGlobal.sources`；Download 改 crop 不再污染 directoryTemplate；Amazon/Tenhow hint；分区命名提示。
  - NFO 对齐：titleZh 优先、originaltitle 番号前缀、originalPlot 回退 meta。
- **待办/遗留**：Tenhow/Amazon 搜图、amazonStrictMode 引擎；DMM 单测 E2E 接续。

## 2026-08-23 — 设置参数 MDCX/MDC-NG 对齐分析文档

- **背景**：用户要求对照 UI「设置」、刮削产物、SONE 片商目录与 MDC-NG NFO。
- **决策/结论**：
  - 目录 `{series_name}/{number}` 与 MDC-NG 一致；`kindProfiles.directoryTemplate` 仅在 `useGlobal.naming=false` 时生效。
  - NFO 差距：title 应中文、originaltitle 缺番号前缀、airav 缺 originalPlot；单源 E2E ≠ 生产多源 merge。
  - 文档：`docs/SETTINGS-MDCX-ALIGNMENT.md`
- **待办/遗留**：代码对齐 §8（title/originaltitle/originalPlot/fieldPriority）。

## 2026-08-23 — AirAV Provider 实现（#10 · wiki 入口）

- **背景**：catalog 已标 implemented，但 `index.ts` 未注册；需对齐色花 `scrapeAiravWiki`（先 io 后 wiki）。
- **决策/结论**：
  - `airav.ts` 委托 `airavIoProvider`，失败走 `scrapeAiravWikiFallback`（`/video/{CODE}` + 同源解析）。
  - 注册 `IMPLEMENTED` · L1 **3/3** · 测通 **1350ms(curl)** · Live **5944ms** · E2E **19/30 · 封面 112895B**。
  - 已实现 Provider **20** 个。
- **待办/遗留**：下一站 **#11 avbase**。

## 2026-08-23 — 数据源精简：只留综合站与品类枢纽

- **背景**：UI 64 源混入大量单厂/窄前缀站与主站冗余通道；用户要求只保留综合性站点。
- **决策/结论**：
  - **删除（UI+代码）**：单厂/窄站 — dahlia、faleno、prestige、fantastica、giga、xcity、getchu*、gyutto、kin8、heyzo、1pondo、pacopacomama、10musume、official、mywife、arzon*、cableav、fanza；冗余通道 — dmm_api、javdb_api、javdb_app、missav_api、avwiki、javmenu、fc2fan。
  - **灰区保留**：carib、mgstage、avsex、javday、njav、miss_av。
  - catalog **36** 源（T1=24 · T2=12）；已实现 **17**（去掉 dahlia/faleno/prestige）。
  - Provider/单测/debug 脚本/docs/sources/{dahlia,faleno,prestige}.md 已清。
- **待办/遗留**：`docs/SOURCE-MASTER-LIST.md` 等总表可择机同步；路径分类词里的 heyzo/1pondo 仅作目录识别，非数据源卡片。
- **逐站测试**（UI 排序）：#1–10 ✅ … **#11 avbase** 待测。

## 2026-08-23 — 7MMTV Provider 实现（#9 · stub→已实现）

- **背景**：catalog stub；综合 MDCX mmtv + 色花 scrape7mmtv。
- **决策/结论**：
  - GET `/zh/searchall_search/all/{CODE}/1.html` + POST 回退；有码 censored_content 优先。
  - L1 **3/3** · 测通 **639ms** · Live **7024ms** · E2E **23/30 · 封面 163227B · extrafanart ×3**。
  - 已实现 Provider **19** 个。
- **待办/遗留**：无。

## 2026-08-23 — UI 取消 T1/T2 层级标识

- **背景**：用户不需要 T2 扩展层级区分，只要源可用即可。
- **决策/结论**：移除卡片 `T2` 标签；排序去掉 tier；catalog 统一 `tier:1`；删除 `countMasterByTier`。
- **待办/遗留**：无。

## 2026-08-23 — AirAV.io 综合优化（#8 · MDCX+色花）

- **背景**：E2E 失败，详情 URL 404。
- **决策/结论**：
  - 综合色花镜像/`fetchPage` 流程 + MDCX 搜索匹配/ld+json/破解版过滤。
  - **根因修复**：`absUrl` 用 `URL()` 拼接，避免 `/cn/cn/video`。
  - L1 **8/8** · 测通 **909ms** · Live **8200ms** · E2E **19/30 · 封面 112895B**。
- **待办/遗留**：无。

## 2026-08-23 — R18.dev Provider 实现（#7 · stub→已实现）

- **背景**：catalog 中 r18dev 为 stub；UI #7 逐站测试需完整 Provider。
- **决策/结论**：
  - 新建 `r18dev.ts`：对齐 MDCX JSON API（dvd_id→combined、番号补零、content_id 变体、DMM 封面升级）。
  - `sourceMaster` 设 `implemented: true`，探针 `/videos/vod/movies/detail/-/dvd_id=sone00001/json`。
  - L1 **7/7** · 测通 **920ms** · Live **1948ms** · E2E **23/30 · NFO 25/25 · extrafanart ×15**。
  - 已实现 Provider **18** 个。
- **待办/遗留**：无。

## 2026-08-22 — Prestige Provider 完善（T2 · proxy · JSON API）

- **背景**：T2 下一源；MDCX `prestige.py` 用 JSON API（非 HTML）；official 路由 100+ 前缀至 prestige-av.com。
- **决策/结论**：
  - 搜索 `/api/search` → `deliveryItemId.endsWith(番号)` → `/api/product/{uuid}`。
  - thumb=`packageImage`、poster=`thumbnail`、extrafanart=`media[]`；封面 URL 为 `/api/media/{path}`。
  - **前缀**：MDCX manual.py 全表；排除 DLDSS/FNS/JIMMY/FLN（已有独立 Provider）。
  - 样例 **ABW-130**；L1 **10/10** · probe ✅ ~439ms · live ✅ · E2E ✅（extrafanart 11/11 · NFO 27/27）。
  - catalog 已实现 **20** 个。
- **待办/遗留**：Fantastica 等下一 T2 stub；套装 SKU（TKTABW-130）靠 suffix 匹配。

## 2026-08-22 — Faleno Provider 完善（T2 · proxy · FNS/JIMMY/FLN）

- **背景**：T2 下一源；MDCX `faleno.py` + `official.py` FNS/JIMMY；与 Dahlia 同 Faleno Group 站群模板。
- **决策/结论**：
  - 搜索 `?s=` → `text_name` 详情链；FLN 直达 works；**仅 FNS/JIMMY/FLN**（FAVR 等拒绝）。
  - 発売日优先；搜索页 poster 覆盖 thumb 变换；extrafanart 接 Dahlia 同款管线。
  - 样例 **FNS-240**；L1 **10/10** · probe ✅ · live ✅ · E2E ✅（封面 171KB · extrafanart 10/10）。
  - catalog 已实现 **19** 个。
- **待办/遗留**：Prestige/Fantastica 等同模板厂牌可复用解析 helper。

## 2026-08-22 — Dahlia extrafanart + 前缀收窄（仅 DLDSS）

- **背景**：用户要求补 extrafanart；多前缀（FAVR/DCDSS）虽在同站但非 Dahlia 本厂专属，不应扩进 Provider。
- **决策/结论**：
  - **前缀**：严格 **DLDSS-only**，对齐 MDCX `official.py`；FAVR/DCDSS 拒绝并提示走通用源。
  - **extrafanart**：`parseDahliaExtrafanart`（`box_works01_ga a.pop_img`）→ `ProviderResult.extrafanartUrls` → merge → 整理/E2E 下载到 `extrafanart/`。
  - 新增 `organize/extrafanart.ts`；`downloadFanart=true` 时 organize runner 写入剧照。
- **待办/遗留**：avsex 等同理可接 extrafanart 管线；FAVR 若需官网元数据应另开 faleno Provider。

## 2026-08-22 — Dahlia Provider 完善（T2 · proxy · 仅 DLDSS）

- **背景**：UI T2 卡片 Dahlia；按 §1.1 先读 MDCX `dahlia.py`：无搜索、直达详情、thumb/poster 变换、`image_download=True`、official 路由仅 DLDSS。
- **决策/结论**：
  - Provider `dahlia.ts` 对齐 MDCX 解析链；`isDahliaCode` 限制 DLDSS 前缀。
  - 测通 `/works/dldss100/`；样例 **DLDSS-100**（DLDSS-001 已 404）。
  - 连接 proxy 直连 ~1.5s，无需 Flare；封面 `cdn.faleno.net` 可 curl（E2E 178KB ✅）。
  - L1 **5/5** · probe ✅ · live ✅ · E2E ✅。
  - `catalog.test.ts` 已实现计数更新为 **18**（含 avsex + dahlia）。
- **待办/遗留**：FAVR 等 Dahlia 旗下其他前缀未覆盖；extrafanart 解析有但未写 NFO。

## 2026-08-22 — 站点测试流程：先 MDCX 分析，再动手测

- **背景**：AVSex 封面下载曾出现「只改 Referer、盲目 curl/Flare 试探仍 403」；对照 MDCX 后发现其并无 avsex 专用 Referer，而是 **async_client 集成 CF bypass + thumb/poster 分字段 + 裁剪兜底**。
- **决策/结论**：
  - **后续所有站点测试**：必须先读 `references/mdcx-diy/mdcx/crawlers/{id}.py` + 对应 `tests/crawlers/test_*.py` + 相关 `config/v1.py` 字段策略（`poster_website` / `image_download` / exclude 列表），写清「MDCX 怎么做 → MDCS 差距 → 测试计划」，**再**写代码/跑 live/E2E。
  - **禁止**：未分析 MDCX 就乱试 proxy、Referer、Flare 超时等「无头苍蝇式」探测。
  - 分析 checklist：连接方式 · 刮削 URL 链 · 字段来源与 merge 排除 · **图片下载策略**（`image_download`、thumb/poster 分离、CF bypass 路径）· 测通路径 · 单测 fixture 从哪来。
  - 已写入 `docs/SOURCE-TEST-STRATEGY.md` §1.1。
- **待办/遗留**：AVSex 封面按 MDCX 链路补 CF bypass 下载 + thumb/poster 分离（分析已完成，实现待做）。

## 2026-08-22 — AVSex 封面链路（MDCX 分析后实现）

- **背景**：按 §1.1 先读 MDCX：`image_download=False`、下载靠 `async_client` CF bypass，非 Referer 特判。
- **决策/结论**：
  - 新增 `coverDownload.ts`（暖 avsex.cc → curl → CDN 过盾 → curl/FS 二进制检测）。
  - `ProviderResult.alternateCoverUrls` + avsex 搜索 poster `-1.jpg`；runner 多 URL 回退。
  - 测通：搜索页 + proxy_flare 冷启动补 session（~12s ✅）。
  - **实测**：`image.avsex.cc` Flare 仍返 446B 挑战页，curl 403 — 单源封面暂不可用；元数据/测通/刮削正常。
  - catalog `notes` + `docs/sources/avsex.md` MDCX 对照表。
- **待办/遗留**：若后续 FS/代理升级可复测封面；或接 MDCX 式 mirror bypass。

## 2026-08-22 — AVSex Provider 完善（T2 · proxy_flare）

- **背景**：UI T2 卡片 AVSex 继续对齐 MDCX `avsex.py`；上会话已有基础实现 + fixture。
- **决策/结论**：
  - `avsex.ts` 补 `parseAvsexMosaic`（article 区 badge，防导航误判）· `parseAvsexExtrafanart`；搜索 poster 优先 `rounded-t-md`。
  - L1 **11/11**；live 刮削 SONE-001 **13–16s**（Flare 双请求）；E2E 元数据 **20/30**，转移 hardlink ✅。
  - 封面 CDN `image.avsex.cc` 直连 403（与 javbus DMM 类似，需代理拉图，另开）。
  - 文档 `docs/sources/avsex.md`。
- **待办/遗留**：测通偶发 Flare 超时（probe 3.6s fail vs scrape ok）；封面下载走 proxy。

## 2026-08-22 — Jav321 DMM 图片校验 L1（移植 MDCX test_jav321.py）

- **背景**：用户选择补 Jav321 MDCX DMM 图片校验单测，与刮削主流程解耦（L1 先行）。
- **决策/结论**：
  - 新增 `jav321DmmImages.ts`：`validateDmmImageIfNeeded` / `filterDmmExtrafanart` / `resolveDmmPosterUrl` / `normalizeExtrafanartUrls` / `removeCoverFromExtrafanart` 等，对齐 MDCX `jav321.py` AWS 升级与剧照抽检逻辑。
  - `jav321.test.ts` 扩展至 **13/13**（原 rating 4 + DMM 图片 9）；`checkUrl` 注入，抽检索引可固定 `[0,1,2]` 保证确定性。
  - 尚未接入 `jav321.ts` 刮削流程（封面仍用页面 pl.jpg）；接入需 HEAD 探活 + 代理，另开任务。
- **待办/遗留**：~~刮削时可选调用 `validateDmmImageIfNeeded` 升级 cover 至 awsimgsrc~~ ✅ 已接入（见下条）。

## 2026-08-22 — Jav321 封面 DMM 校验接入刮削

- **背景**：L1 完成后用户要求把 `validateDmmImageIfNeeded` 接到 `jav321.ts` 封面解析。
- **决策/结论**：
  - `createJav321ImageCheckUrl` 复用 `probeImageUrl`（Range 探活 + now_printing 过滤 + pl ≥30KB）。
  - 解析 cover 后调用 `validateDmmImageIfNeeded`，失败则置 null（对齐 MDCX 校验失败清空）。
  - SONE-001 E2E：cover 从 `pics.dmm.co.jp` → `awsimgsrc.dmm.co.jp` pl，909KB（原 166KB）；NFO 20/20 仍通过。

## 2026-08-22 — 逐源测试 #5 Jav321（UI #4，L1 + 实测通过）

- **背景**：iQQTV 之后按 UI 代理组顺序测 Jav321；`jav321.test.ts` 从 vitest 改为 `node:test`。
- **决策/结论**：
  - L1 **4/4**（`parseJav321Rating` 对齐 MDCX gif/5 分制）；测通 350ms · direct；E2E SONE-001 486ms，NFO 20/20。
  - 封面 DMM pl 166KB、poster 57KB、有码水印正常；片商「エスワン ナンバーワンスタイル」、评分 4/5。
  - actor/series/genre 空属站点精简页特性（SONE-002 同款），非回归；详见 `docs/sources/jav321.md`。
- **待办/遗留**：代理组已实现源 **全部测完**（DMM / FreeJavBT / iQQTV / Jav321 / JavBus / LibreDMM）；可进入下一组或补 MDCX DMM 图片校验 L1。

## 2026-08-22 — 逐源测试 #4 iQQTV（UI #3，L1 移植 + 实测通过）

- **背景**：FreeJavBT 之后按 UI 代理组顺序测 iQQTV；对齐 MDCX 双语字段与 title 清洗。
- **决策/结论**：
  - 重构 `iqqtv.ts`：导出 `matchIqqtvNumber` / `getIqqtvRealUrl` / `parseIqqtvOutline` / `parseIqqtvDetailHtml` / `removeIqqtvWebNumberSuffix` / `getIqqtvRealTitle`；JP+CN 并行详情合并（`title`=JP 原标题、`titleZh`=CN、`plot`=CN 简介、`originalPlot`=JP 简介）。
  - `removeIqqtvWebNumberSuffix` 完整移植 MDCX `_clean_web_number_token` + `_same_web_number`（含 caribbeancom 前缀剥离）。
  - L1 **6/6**；测通 1280ms · direct；E2E SONE-001 2624ms，NFO 23/23；封面 119KB、poster 45KB、有码水印正常。
- **待办/遗留**：下一站 **Jav321**（UI #4）；iqqtv 无 director/runtime/trailer 属站点特性。

## 2026-08-22 — 逐源测试 #3 FreeJavBT（UI #2，L1 移植 + 实测通过）

- **背景**：按 UI 代理组顺序，DMM 之后测 FreeJavBT。
- **决策/结论**：
  - 重构 `freejavbt.ts`：导出 `parseFreejavbtDetailHtml` / `parseFreejavbtTitle`，对齐 MDCX `test_freejavbt.py`（含男优过滤、span/b 元数据）。
  - L1 **3/3**；测通 1372ms；E2E SONE-001 1750ms，NFO 20/20。
  - 封面来自第三方 CDN（非 DMM pl），体积偏小（23KB）——与色花策略一致，freejavbt 不宜作封面主源。
- **待办/遗留**：下一站 **iQQTV**（UI #3）；live 标题偶夹男优名可后续对齐 MDCX title 清洗。

## 2026-08-22 — 逐源测试 #2 JavBus（L1 + 实测通过）

- **背景**：DMM 完成后按顺序测 JavBus。
- **决策/结论**：
  - L1：`javbus.test.ts` 已移植 MDCX `test_javbus_new.py` fixture，**5/5** 通过。
  - L4 测通 443ms · direct；E2E SONE-001 511ms，NFO 23/23（javbus 无 plot/rating/trailer 属正常）。
  - 封面 174KB、poster 44KB、有码水印正常。
- **待办/遗留**：下一站 **LibreDMM**（代理组内第三个已实现源）。

## 2026-08-22 — 逐源测试 #1 DMM（L1 移植 + 实测通过）

- **背景**：用户要求按顺序逐站测试，第一站 DMM；先移植 MDCX 测试逻辑再跑 live。
- **决策/结论**：
  - L1：`dmm.test.ts`（GraphQL fixture 移植 `test_dmm_trailer_url.py` + `test_dmm_api.py`）、`dmmCid.ts` 完整移植 MDCX `generate_cid_candidates`、`buildGraphqlTrailerCandidates` 对齐 MDCX 不用 freepv 兜底。
  - L1 单测 **17/17**；L4 测通 GraphQL 372ms；E2E SONE-001 380ms，NFO 31/31。
- **待办/遗留**：按 UI 顺序下一站（有码 AV·代理组内 javbus 等）；dmmCid 可继续补 MDCX `test_dmm_direct.py` 全量 probe 用例。

## 2026-08-22 — UI 全量 64 源卡片

- **背景**：用户要求 UI 添加全部站点。
- **决策/结论**：
  - `sourceMaster.ts` 为 catalog 唯一数据源（64 id）；`catalogTypes.ts` 拆类型防循环依赖。
  - UI 按 **5 组**展示：有码 AV / 无码 AV / FC2 / 国产 / 欧美（合并原备选·API·参考）。
  - 卡片标记 **stub**（未实现）、**T2–T5** 层级；测通跳过 `probeable: false`（official、fc2fan）。
- **待办/遗留**：扩展源 Provider 实现；Phase B L1 单测。

## 2026-08-22 — 数据源全站点主清单

- **背景**：用户要求先把所有数据源站点列完整。
- **决策/结论**：
  - `docs/SOURCE-MASTER-LIST.md`：T1（24 UI）+ T2（MDCX 18）+ T3（API 6）+ T4（官方子站 4）+ T5（JavSP 9）= **64 id**。
  - 代码索引 `apps/server/src/scrape/providers/sourceMaster.ts` + `sourceMaster.test.ts`。
  - UI 仍只展示 T1 catalog；T2+ 作 backlog。
- **待办/遗留**：catalog 增 tier 字段后把 T2 stub 写入；高优 stub 实现（javlibrary/miss_av/avbase…）。

## 2026-08-22 — 数据源测试策略（MDCX 复制 + 色花优化）

- **背景**：用户要求深度分析 MDCX 全部源测试逻辑，完全复制后再以色花优化，并补 MDCX 没有的源。
- **决策/结论**：
  - MDCX 五层：L0 Registry · L1 FakeClient · L2 ParserTestBase golden · L3 helper · L4 live（默认 skip）。
  - MDCS 目标栈：L0–L2 复制 MDCX（16 implemented 源补全 `{id}.test.ts`）+ 保留 L3/L4（E2E + NFO 30 字段）。
  - 色花吸收层：`siteMirror` / `access` / `SOURCE_FIELD_CAPS` —— 只影响取 HTML，不改 L1 断言。
  - MDCS 独有源：**carib**、**madou**、**xiao_huang_shu**；MDCX `guochan` → madou/madouqu 番号 helper。
  - 完整映射与路线图：`docs/SOURCE-TEST-STRATEGY.md`。
- **待办/遗留**：Phase B 补 10 源 L1 单测（javbus ✅）；fc2_hub / madouqu E2E 复测；stub 源按 Phase E backlog。

## 2026-08-22 — FC2 Hub MDCX 对齐

- **决策/结论**：fancybox 封面优先 · col-8 卖家 · card-text 标签 · col.des 简介 · FC2 sample 预告；`fc2_hub.test.ts` 6 项；E2E 待 Flare 复测。

## 2026-08-22 — NFO 补全 + 单源「有多少验多少」

- **背景**：E2E 原先只检 6 项 NFO，与 mdc 参考 NFO（40+ 节点）差距大。
- **决策/结论**：
  - `nfo.ts` 补 `<thumb>`、`<fanart/>`、嵌套 `<ratings name="javdb">`；`nfoCtx.ts` 统一 `buildNfoWriteContext` + `ensureThumbBesidePoster`。
  - E2E 校验改为 `metaCollectedFields`：仅对单源**实际采集**字段做必过判定。
  - DMM GraphQL 增 `directors` + `website`；javdb 增评分；javbus 增 og:description plot。
  - 整理流水线 NFO 写在 poster/thumb 生成之后（runner + e2e-sone-source）。
- **待办/遗留**：DMM trailer（GraphQL `sampleMovie` 字段名待探）；多源合并 E2E 仍可选。

## 2026-08-22 — LibreDMM 逐源测试通过

- **决策/结论**：SONE-001 E2E 全通过 · 水印 censored；命中 **outlet** 条目（77sone001）已文档化；`docs/sources/libredmm.md`。

## 2026-08-22 — DMM 逐源测试通过

- **决策/结论**：SONE-001 测通 GraphQL 405ms · E2E 全通过 · 封面 910KB · 水印 censored；文档 `docs/sources/dmm.md`。

## 2026-08-22 — JavBus 水印重测通过

- **背景**：用户要求开水印配置后再测。
- **决策/结论**：`scrape.json` → `watermark.markCensored: true`；JavBus SONE-001 E2E 海报角标 **censored** ✅；文档 `docs/sources/javbus.md` 已更新。

## 2026-08-22 — 逐源测试文档（测一个写一个）

- **背景**：用户要求按 UI 卡片顺序，测一个源写一份文档。
- **决策/结论**：`docs/sources/` 目录；首篇 [javbus.md](docs/sources/javbus.md)；索引 [docs/sources/README.md](docs/sources/README.md)；辅助脚本 `probe-one.ts`。
- **待办/遗留**：下一张卡片 DMM。

## 2026-08-22 — 数据源 E2E 测试记录文档

- **背景**：用户要求把每个数据源测试情况写成文档。
- **决策/结论**：`docs/SOURCE-E2E-TEST-LOG.md` — 24 源总览表 + 逐源明细 + 索引样例 + 批量刮削快照 + 待办；E2E 报告路径索引。
- **待办/遗留**：见文档 §6（JavDB、fc2_hub 封面、stub 源、Madouqu/fd2ppv 补测）。

## 2026-08-22 — E2E 索引番号样例 + 多 Kind 端到端

- **背景**：用户指出索引里已有各源对应番号，不应全用 SONE-001；Carib/FC2/国产需各自格式。
- **决策/结论**：
  - `apps/server/scripts/e2e-fixtures.ts` — 数据源→索引 strm 映射；`--list` / `--strm=` 覆盖。
  - E2E 脚本改为按 fixture 取 code/kind/strm；输出 `media/_e2e/{kind}/{code}/`（有码仍用片商目录 SONE 路径）。
  - `buildPlanForFile` 修复：jobOptions.libraryRoot 可替代空 kind.libraryAbs。
- **实测**：
  - carib `CARIB-010117-339` ✅ 刮削/转移/无码水印；NFO 缺 premiered
  - fc2 `FC2-1545500` ✅；fc2_hub `FC2-PPV-3275049` 刮削✅ 封面404
  - 有码组 libredmm/jav321/freejavbt/iqqtv 此前 SONE-001 ✅
- **待办/遗留**：madou/madouqu 待验；fc2_hub 封面链失效；jav321 NFO 缺 studio/actor

## 2026-08-22 — 八参考逐源连接/取数规格

- **背景**：用户要每个数据源的连接方式、怎么获取数据，按 8 参考项目最优合成。
- **决策/结论**：`docs/SOURCE-CATALOG-8REF.md` — 24 源 × access/取数路径/Cookie/八项目覆盖/MDCS 状态；取数模式 A–G（HTML/POST/JSON/GQL/自适应/网关）；DMM 以 MDCX GraphQL 为最优。
- **待办/遗留**：可选接 mdcx javdb App API、javbus-api 网关；L2 深度测通 UI。

## 2026-08-22 — 八参考项目「测通」最优规格（跨项目）


- **背景**：用户要求数据源链接测试方式按 `references/` 下 8 项目一起对照，做成后续多项目可复用的最优实现。
- **决策/结论**：
  - 主规格 = **色花 L1**（同通道/认盾/access/串行/镜像）+ **MDC L2 思想**（能连≠能刮）+ MDCS API 特例。
  - 落地：`docs/SOURCE-PROBE.md`；跨项目 Skill：`~/.cursor/skills/source-probe/SKILL.md`。
  - DMM 测通改为 GraphQL（与刮削同路），不再只打年龄门首页。
- **待办/遗留**：UI「深度测通」L2 可后补；水印角标需开 `markCensored` 或具备字幕/4K 条件才会画出。

## 2026-08-22 — DMM Provider（GraphQL）+ SONE-001 端到端通过


- **背景**：代理组顺序 JavBus 后是 DMM；旧 HTML 详情已跳转 `video.dmm.co.jp` SPA，年龄门 declare 不再下发可用 Cookie。
- **决策/结论**：
  - 对齐 MDCX：`POST https://api.video.dmm.co.jp/graphql`（`ppvContent`）+ `guessDmmCids`；封面 CDN 探测兜底。
  - catalog `dmm.implemented=true`；修 `collectByRe` 非 g 正则；单源 `metaSourcesOverride` 合并时改用覆盖列表（否则字段优先序会排除 dmm）。
  - 实测 SONE-001：317ms；封面 909KB；hardlink；NFO/命名通过；水印角标仍因 `markCensored=false` 未出。
- **待办/遗留**：代理组下一站 LibreDMM（此前已跑通过，可复核）；可将 dmm 写入 japan_censored meta/cover 源序。

## 2026-08-22 — STRM 豁免最小体积


- **背景**：JavBus 端到端测出 `minFileSizeMb=100` 会跳过 strm，正式扫描入库失败。
- **决策/结论**：`passesMinSize` / 源目录清理的「删小文件」对 `.strm` 一律豁免（仅为播放指针，体积极小）。其它后缀仍按最小体积过滤。
- **待办/遗留**：无

## 2026-08-22 — JavBus SONE-001 端到端实测通过

- **背景**：用户点 JavBus，要求真刮削并验文件转移、命名/后缀、封面水印、NFO。
- **决策/结论**：
  - 封面上次失败根因：脚本 `fetchBuffer` 8s 且无 Cookie；已改为 30s + javbus 年龄 Cookie。
  - 端到端脚本 `apps/server/scripts/e2e-sone-source.ts --id=javbus`：源 strm 硬链到隔离目录 `_scrap/javbus/organized/`，不覆盖 mdc 原目录。
  - **通过**：刮削 746ms；封面 173806B；hardlink；路径 `{category}/{studio}/{series_name}/{number}` → `日本有码/エスワン ナンバーワンスタイル/SONE/SONE-001/SONE-001.strm`（`series_name`=番号前缀 SONE，不是系列名）；NFO 标题/演员/片商/发行/海报齐全。
  - **水印未出角标**：全局 `markCensored=false`，strm 无 4K/字幕后缀；海报仍做了 **右侧裁剪**（poster 53KB）。
- **待办/遗留**：下一站按目录继续一站一测。


## 2026-08-22 — ThePornDB API Key 写进数据源弹窗

- **背景**：用户要求需填 API 的源在卡片设置弹窗里填写，而不是只靠环境变量。
- **决策/结论**：catalog `needsApiKey`；弹窗首项 API Key，写入 `scrape.json` 的 `theporndbApiKey`。探活/刮削读配置 Key（环境变量仍可兜底）。
- **待办/遗留**：无

- **背景**：用户点 JavBus 卡片弹窗，要求美化（标题被做成 12px 全大写 JAVBUS，表单贴边）。
- **决策/结论**：标题改为 15px 正文色、取消 uppercase；页脚次按钮+主按钮、安全区留白；表单改 SettingRow + org-stack，与设置页同一套行结构。
- **待办/遗留**：无

## 2026-08-22 — 一站一测收口（跳过出口封锁源）

- **背景**：MGStage 卡住后继续向下；用户确认 JavDB 实在不行就跳过。
- **决策/结论**：
  - **续测已通**：sevenmmtv=`curl`；avsox / avmoo / javlibrary / miss_av / fd2ppv=`flare`。avmoo 第一次 25s 排队超时，加长预算后 6.6s 通过。
  - **跳过（出口 CF 403，SIN）**：javdb.com、fc2_hub(javten.com)；同因 mgstage CloudFront 403。
  - **配置缺口**：theporndb 无 API Key。
  - 目录 25 源：通 21，跳过/配置 4。换日本/住宅节点后再验这 3 个封锁源。
- **待办/遗留**：无（本轮探活结束）

## 2026-08-22 — 色花网络层 100% 移植（镜像+自适应）

- **背景**：用户确认 javbus 跟色花（proxy）+ 完整 5 步移植。
- **决策/结论**：
  - 从 sehua-next 拷入：`flaresolverr` / `download`(fetchPage) / `adaptiveFlare` / `siteMirror` / `airavMirror` / `iqqtvMirror` / `scrapeCancel`
  - `fetch.ts` 适配层：access→viaFlare + 抛错兼容 Provider；`providerSite` 读镜像缓存并传 `sourceId`
  - `probe.ts` 对齐色花：skipDiscover、airav 跟镜像、javbus 备用种子、`probeVia`/`resolvedBaseUrl`
  - 启动 `initScrapeNetworkStores` → `data/meta/*.json`（mirrors/clearance）
  - catalog：javbus=`proxy`；avmoo/avsox/fc2_hub/fd2ppv/miss 等 URL/access 对齐色花；iqqtv 默认 `iqq5.xyz/cn`
- **实测**：dmm/javbus=`direct` OK；iqqtv 镜像 OK；airav/airav_io=`curl` OK；mgstage Flare 经代理仍 CloudFront 403（出口问题，非逻辑缺失）
- **待办/遗留**：重启 `npm run dev` 后 UI 测通；mgstage/javdb 等换出口再验；可选 curl-impersonate

## 2026-08-22 — 色花网络层移植规格（镜像 + 自适应）

- **背景**：用户要求先 100% 复制色花逻辑再优化测试；对照 MDCS 缺口。
- **决策/结论**：
  - MDCS **缺**：siteMirror/airavMirror/iqqtvMirror、curl 通道、clearance 复用、FS session 单飞、host 闸、探活 skipDiscover+回写。
  - MDCS **已有薄实现**：proxy_adaptive≈undici→Flare；flare 已注入 `proxy:{url}`。
  - 移植分 5 步：①Flare 客户端 ②fetchPage 三连 ③三镜像模块 ④probe 共用 ⑤回归；磁盘 `site-mirrors.json` / `airav-mirror.json` / `iqqtv-mirror.json` / `cf-clearance.json`。
  - 边界：不搬 Python 调度/UI 外壳；javbus 色花是 proxy+禁 Flare，MDCS 现为 adaptive——移植时需显式决策。
- **待办/遗留**：等用户确认后从 Step1 开工

## 2026-08-22 — Flare 必须注入 scrape 代理（对齐色花）

- **背景**：airav CF 403；Flare 90s 超时「卡住」。对照色花/mdc-ng。
- **决策/结论**：
  - 根因：MDCS `flareGet` **未**把 `proxy: { url }` 交给 FlareSolverr，FS 浏览器裸连目标站；色花/scrape-web 默认注入全局代理。
  - 修复：`flare.ts` 注入配置/当前代理；调 FS API 用 undici **直连 Agent**；adaptive/flare 超时抬到 ≥45s；挑战页判失败。
  - 实测：airav.wiki 过盾约 7–8s OK；探活 OK。
- **待办/遗留**：继续一站一测 airav_io…

## 2026-08-22 — 一站一测：DMM 通过

- **背景**：按网络配置（proxy `192.168.2.88:7893`）从 UI 代理组首卡起一站一测。
- **决策/结论**：DMM / LibreDMM 探活 OK；DMM 补年龄门 Cookie。
- **待办/遗留**：airav 已修 Flare 代理注入后通过

## 2026-08-22 — 色花站点探活逻辑深挖（对照结论）

- **背景**：逐站测通前需对齐色花，避免 MDCS 只看 HTTP 状态误判。
- **决策/结论**（以 `references/sehua-next-web` 为准，旧 scrape-web 更简）：
  1. **调度**：API `run_scrape_sources_test` **串行**一站一测；注释明确并行会拖垮 Flare。日调度也串行。
  2. **单站**：`POST :9210/api/sources/probe` → `fetchPage`（与刮削同通道）；成功=有 HTML 且 **非** CF 挑战页；记录 `probeVia`（direct/curl/flare）。
  3. **超时**：proxy≈18s；flare/adaptive≈36s；airav_io≈42s；API httpx 余量 50–70s。探测 `strictTimeout`，禁止全量镜像发现。
  4. **access**：proxy=代理不过盾；proxy_flare=强制 Flare；proxy_adaptive=先 curl→短 Node→Flare（`ADAPTIVE_FLARE_SOURCE_IDS`）；iqqtv=direct。
  5. **特例**：airav_io 跟跳转镜像；javbus 可试 1 备用种子；theporndb 用 API Key 搜 SONE-001；默认 Cookie（javbus/javdb/dmm/mgstage/fc2）。
  6. **旧 scrape-web**：`probeSource` 仅 undici GET，`<500` 即 ok，**不认盾**。
- **待办/遗留**：MDCS 应对齐 next：串行、挑战页判定、adaptive 超时与 curl 回落、airav 镜像、theporndb API 探活；修 Flare 超时后再测 airav 系。

## 2026-08-22 — 直连并入代理

- **背景**：本机 Clash TUN 全局代理，直连分组无意义；用户要求「直连合并代理」。
- **决策/结论**：catalog 原 `access:direct` 全部改为 `proxy`；UI 去掉「直连」分组；`normalizeProviderAccess` / fetch 将遗留 `direct` 归一为 `proxy`。网络面板「直连」测通仍保留（测不经 undici 代理）。
- **待办/遗留**：可继续用配置的 proxy/flare 做逐源探活

## 2026-08-22 — 数据源卡片单测联通按钮

- **背景**：用户要求每张数据源卡片增加单独测联通性按钮。
- **决策/结论**：卡片底部右侧加「测通」；调用已有 `POST /api/scrape/providers/probe`（带 `id`）；与「测试全部」互斥忙碌；结果写回状态点并 toast。
- **待办/遗留**：无

## 2026-08-22 — 数据源卡片按访问方式分组

- **背景**：用户要求卡片按直连 / 代理 / 代理过盾等分类，不再按 AV/FC2 内容域。
- **决策/结论**：UI 按 `access` 分组展示：`direct` 直连、`proxy` 代理、`proxy_flare` 代理过盾、`proxy_adaptive` 代理自适应；catalog 仍保留色花 `group` 字段供源链/业务用。
- **待办/遗留**：无

## 2026-08-22 — 一站一过：libredmm / airav_io / freejavbt

- **背景**：继续逐站实测。
- **决策/结论**：
  - **libredmm**：复核通过（JSON API，色花无对应源）；SSIS-001 OK
  - **airav_io**：本机 `airav.io`/`airav.wiki` 均 HTTP 403（无代理）；catalog 改为 `access:proxy`、默认 URL `https://airav.io/cn`（对齐色花）；错误提示需配 proxyUrl；**暂挂**待代理
  - **freejavbt**：通过；补 og:image 封面（对齐色花 missav.ts 内 freejavbt）
- **待办/遗留**：配代理后重测 airav_io / iqqtv；配 Flare 后测 javdb 等

## 2026-08-22 — 一站一过：jav321 真刮削通过

- **背景**：jav321 冒烟「页面不匹配」；对照色花 POST `/search` + follow 重定向。
- **决策/结论**：
  - `fetchPostForm` 从 undici `request`（不跟 302、空 body）改为 `fetch` + `redirect:follow`，并带 Cookie/UA/代理覆盖
  - 解析：panel-info 优先，缺则 og:title / og:image（色花路径）
  - 实测 SSIS-001：标题/简介/片商/演员/发行/时长/封面 OK
- **待办/遗留**：下一站建议 libredmm（上次已 OK，复核即可）或 airav_io（403 需代理）

## 2026-08-22 — 一站一过：javbus 真刮削通过

- **背景**：用户要求按站实测刮削，对照色花。
- **决策/结论**：
  - 根因：年龄验证页；对齐色花 `defaultCookieFor(javbus)=existmag=all; age=verified; dv=1`
  - catalog 增加 `defaultCookie`；`resolveProviderSite` 空配置时注入
  - 解析对齐色花：h3/og 标题、bigImage href、star-name；cheerio 补发行/片商/时长/标签
  - 实测 SSIS-001：标题/演员/封面/片商/时长 OK
- **待办/遗留**：下一站 jav321（此前「页面不匹配」）

## 2026-08-22 — 各源探活/刮削冒烟（本机）

- **背景**：用户要求每个数据源站点逻辑复制测试。
- **决策/结论**：
  - 脚本 `apps/server/scripts/test-providers.ts`；Provider 已统一走 `providerSite`
  - 本机结果（`proxyUrl`/`flareSolverrUrl` 皆空）：探活 **11/24 OK**；已实现刮削 **6/15 OK**
  - 刮削 OK：libredmm / carib / fc2 / madou / madouqu / freejavbt
  - 主因：未配 Flare（javdb/avsox/fc2_hub/fd2ppv 等）、HTTP 403（airav_io/iqqtv 等需代理）、theporndb 无 Key；javbus/jav321 样例解析失败待查
- **待办/遗留**：配好代理+Flare 后重跑；查 javbus「未找到标题」、jav321「页面不匹配」

## 2026-08-22 — Provider / probe 统一走 providerSite

- **背景**：数据源卡片已落盘 `providerSettings`（baseUrl/Cookie/UA/冷却/代理），但各 scrape 仍硬编码 DEFAULT_BASE + `getCatalogEntry().access`。
- **决策/结论**：已实现 Provider 与 `probe.ts` 统一用 `prepareProviderFetch` + `siteFetchOpts`；`access`/Cookie/UA/代理/冷却由此注入。`theporndb` 仍用 undici，但 baseUrl（及可选 UA）经 helper 解析。
- **待办/遗留**：stub Provider 未改；avsox catalog 默认 `avsox.website` 会覆盖代码里 `avsox.click` fallback（与 resolve 优先级一致）。

## 2026-08-22 — 数据源去掉 Forum，按色花分组

- **背景**：Forum 卡片无 URL；用户要求删除，并按色花分类整理。
- **决策/结论**：
  - 从 `SOURCE_CATALOG` 移除 `forum`（论坛标题仍用本地 `forum_titles.json`，与 Provider 无关）
  - 增加 `group`：`av` / `fc2` / `chinese` / `other`，UI 分区展示；顺序对齐色花 SOURCE_DEFS
  - MDCS 独有 `libredmm`→av、`iqqtv`→other；`xiao_huang_shu` 补默认 URL
- **待办/遗留**：无

## 2026-08-22 — 数据源管理卡片样式对齐参考图

- **背景**：用户提供 MDC「数据源管理」截图，要求卡片样式 + 点开详情。
- **决策/结论**：
  - UI：标题「数据源管理」、状态更新时间、「测试全部」、卡片网格（名称+状态点+开关+URL，冷却显示 CD 角标）
  - 弹窗：网站地址 / Cookie / UA / 冷却 / 覆盖重试 / 代理；落盘 `scrape.json.providerSettings`
  - 探活读每源 `baseUrl`/Cookie/UA/代理；`fetchText` 支持对应覆盖
- **待办/遗留**：stub Provider 未改；avsox catalog 默认 `avsox.website` 会覆盖代码里 `avsox.click` fallback（与 resolve 优先级一致）。

## 2026-08-22 — 数据源页拆成「数据源 / 字段配置」两子页

- **背景**：用户要求参考色花，不要把 Provider 与字段优先级挤在同一页。
- **决策/结论**：
  - `sourcesTabs.ts`：`/sources` → 数据源，`/sources/fields` → 字段配置
  - `SourcesPage` Tab 条（对齐设置页样式）；`App` 走 `SourcesPage`
  - `ScrapeConfigPanel` variant：`providers` / `fields`（另保留 `project`、`sources`）
- **待办/遗留**：全局分区源链、拖拽排序、隐藏未配置字段、恢复默认等 DESIGN §4.6 增强项未做

## 2026-08-22 — Emby 演员真同步

- **背景**：设置·演员页原为预留字段；用户要求按截图配置并做真同步。
- **决策/结论**：
  - Push：Emby 拉演员 → Gfriends 上头像 + `scrape_maps` 轻量元数据/外链 → 写回 Emby
  - `ops.actors` 扩展 URL/Key/UserId、媒体库、定期刮削、入库天数、刷新、元数据/图片、覆盖模式
  - API：`/api/ops/actors/emby/test|libraries|sync`；`startEmbyActorScheduler`（约 6h）
  - UI：设置·演员对齐截图（测试连接 / 立即同步）
- **待办/遗留**：Jellyfin 无前缀、wiki 级简介生日、演员页嵌 Emby 列表未做

## 2026-08-22 — 设置·NFO 页完善（字段开关对齐 MDC）

- **背景**：NFO Tab 原先只有合并策略；用户按 MDC 截图要求完善配置。
- **决策/结论**：
  - 新增 `scrape.json.nfo`（`nfoConfig.ts`）：`enabled`、`include.*` 字段开关、`tagExtras` 附加标签、`tagline`/`tagFormats` 模板；与顶层 `nfoMergeStrategy` 双向对齐
  - `buildMovieNfo` / `writeMovieNfo` 按开关写 XML；整理 runner 传入字幕/分辨率/分集/海报上下文
  - UI `NfoSettingsPanel` 分区：启用、标题、简介、演员、发行、国家、年份、评分、系列/标签、附加标签、格式、片商、海报、合集
- **待办/遗留**：评分/导演/预告/网址依赖刮削字段，当前多数源未产出则勾选也不写；分区专属仍主要覆盖 mergeStrategy

## 2026-08-22 — actors/tags 映射定为初版，刮削后再完善

- **背景**：用户确认当前 `actors.*.json`（约 5.1 万 key）与 `tags.*.json`（约 1.0 万 key）先作基础数据落盘。
- **决策/结论**：来源为 mdcx-diy xlsx 一次性转换，够跑通映射链路；**真实刮削跑起来后，再按未命中/错映/缺链等问题完善一轮**（人工或脚本回填），不要把当前表当最终定稿。
- **待办/遗留**：刮削积累样本后复盘并更新 `data/scrape_maps/actors|tags.*.json`

## 2026-08-22 — forum_titles 剔除非中文

- **背景**：色花堂「影片名称」大量为日文官方片名；用户要求非中文剔除。
- **决策/结论**：导出增加 `is_chinese_title`：有假名丢弃、汉字主导（核心字符汉字≥55%、拉丁过多丢弃）；落盘前去开头番号。重导后 **184088 → 55600**。
- **待办/遗留**：纯汉字日文片名（无假名）仍可能漏网；重启后端清缓存

## 2026-08-22 — 基础数据空文件修复与重导

- **背景**：今早发现 `forum_titles.json`、`actors.zh-CN.json` 被写成仅 CRLF（2 字节），映射失效。
- **决策/结论**：
  - 重跑 `scripts/export_metadata_base_data.py`：forum **184088**、actors **51157**/语种、tags **10040**/语种
  - 写入改为 `.tmp` 再 `replace`，避免中断留下空文件；支持 `--forum` / `--actors` / `--tags`
  - 修 tags：openpyxl `iter_rows` 二次迭代会再读表头，改成同一迭代器跳过首行
- **待办/遗留**：改映射后需**重启后端**清 `maps.ts` 缓存；actors/tags 仅为初版，刮削后再完善（见上条）

## 2026-08-21 — 元数据基础数据落盘

- **背景**：用户确认用 `192.168.2.38:5435/ed2k` + mdcx-diy xlsx 做好基础数据。
- **决策/结论**：
  - 脚本 `scripts/export_metadata_base_data.py`：从 `resource_sources` 抽【影片名称】等 → `data/forum_titles.json`（约 **18.4 万** 番号）；mdcx `actor_database.xlsx` / `info_database.xlsx` → `data/scrape_maps/actors|tags.{zh-CN,zh-TW,ja,en}.json`（演员约 **5.1 万** key，标签约 **1.0 万** key）
  - 跳过 info/actor 中「删除」行；演员外链非 javdb 时写 `url` 字段
  - `data/` 仍 gitignore，需本机生成；改文件后重启后端清缓存
- **待办/遗留**：未接色花堂实时拉帖；库更新后重跑导出脚本即可

## 2026-08-21 — 元数据后端完全接入

- **背景**：元数据 Tab 多项开关此前只入库；用户要求完全接上。
- **决策/结论**：
  - `applyMetadataPrefs` 改为 async：色花堂标题（`data/forum_titles.json` → 否则 `titleZh`）、演员/标签映射（`data/scrape_maps/*`）、严格校验、LLM 翻译
  - LLM 配置写入 `scrape.json.llm`（系统设置保存）；命名助手仍同步 localStorage
  - NFO actor 可写映射表产出的 `url`
  - 样例映射与说明在 `data/scrape_maps/`、`data/forum_titles.json`
- **待办/遗留**：已由「基础数据落盘」 remedi；实时拉帖仍未接

## 2026-08-21 — 元数据设置页对齐参考图

- **背景**：用户提供 MDC 元数据 Tab 截图，要求配置页对齐。
- **决策/结论**：页面拆为「数据校验 / 元数据优化 / 自动翻译 / 翻译引擎」四区；勾选卡片 + 映射语言下拉 + System Prompt；配置扩展 `useForumZhTitle`/`enableActorMapping`/`enableTagMapping`/`mappingLanguage`/`translateEngine`/`customSystemPrompt`，写入 scrape.json。演员/标签映射与 LLM 翻译仍为配置占位，后处理逻辑后续里程碑。
- **待办/遗留**：色花堂标题优先、演员/标签映射表、真实翻译调用尚未接入 runner

## 2026-08-21 — 应用用户更新的水印图

- **背景**：用户替换 `assets/watermarks/default` 内图片（随机文件名）。
- **决策/结论**：目视映射后处理并接入：`CYnXD→wuma` `oDx7S→umr` `RoMpH→leak` `wR8Ez→sub` `mJ2Du→4k` `FbOhT→8k`；4K/8K 去近白底；统一拉到高度 320；文件夹缺「有码」，按同风格补 `youma.png`；同步 public；预览宽高比改为胶囊 600/320、分辨率 355/320。
- **待办/遗留**：若用户另有「有码」原图，可替换生成的 `youma.png`

## 2026-08-21 — 水印角标统一美化

- **背景**：有码 `youma.png` 宽高比明显大于其他胶囊标（716×320 vs ~630×320），预览/叠放视觉不一致。
- **决策/结论**：用 SVG→PNG 重绘全套默认角标，风格统一为微立体渐变 + 顶光 + 白字描影、透明底；胶囊标统一 **640×320**，4K/8K 统一 **360×320**；同步 `assets` 与 `apps/web/public`；预览堆叠宽高比常量改为 2.0 / 1.125。生成脚本：`assets/watermarks/_gen_unified.js`。
- **待办/遗留**：无

## 2026-08-21 — 优化水印 PNG 接入

- **背景**：用户提供优化后的角标图（中文临时文件名），要求重命名并处理预览叠放。
- **决策/结论**：
  - 重命名：`(1)无码→wuma` `(2)有码→youma` `(3)8K→8k` `(4)流出→leak` `(5)字幕→sub` `(8)4K→4k` `破解→umr`
  - 去近白底 + 透明 + 去 AI 角标残留 + 收紧裁切；同步到 `apps/web/public/watermarks/default` 供预览
  - 水印页预览改为真实 PNG，stack 横向叠放，高度跟 `heightRatio`
- **待办/遗留**：边缘仍可能有轻微锯齿（源图 AI 抠图质量）；thumb/fanart 流水线仍 mainly poster

## 2026-08-21 — 内置水印 PNG 资源

- **背景**：用户提供 MDC 风格角标合图，询问能否提取。
- **决策/结论**：从合图拆出 `4k/8k/sub/umr/leak/wuma.png` 到 `assets/watermarks/default`；缺「有码」按同风格补 `youma.png`；默认 `customDir` 指向该目录，引擎空目录时仍回退内置路径。
- **待办/遗留**：无

## 2026-08-21 — 设置·水印页对齐 MDC

- **背景**：水印 Tab 原先只有简易开关/文字角标；用户要求按 MDC 完成页面。
- **决策/结论**：
  - 配置扩展：样式、自定义 PNG 目录、布局(堆叠/顺逆时针)、起始位置、heightRatio/偏移/间距、图片类型、4K/8K、每类固定位置
  - 引擎：优先读自定义目录 PNG（youma/wuma/umr/leak/sub/4k/8k），缺失则 SVG 文字角标；整理传入 resolution
  - UI：左表单 + 右预览 +「显示全部水印」；保存写入 scrape.json
- **待办/遗留**：style/style4k 暂仅「默认」；thumb/fanart 勾选已存配置，当前整理流水线 mainly 写 poster

## 2026-08-21 — 命名引擎三缺口补齐

- **背景**：UI/配置已齐，整理运行时仍缺：plan 前字幕探测、NFO 媒体标题、真分辨率。
- **决策/结论**：
  - plan：`findSubtitlesForCode`（与 runner 同源 subtitleLibraryPath）→ `{subtitle}`/字幕后缀在命名阶段生效；顺带从文件名识别 `cd/part/pt`
  - NFO：`mediaTitleTemplate` 渲染结果写入 `<title>`，`<originaltitle>` 仍用刮削原标题
  - 分辨率：`resolution.ts` 支持 path / probe(ffprobe) / prefer_* + Fallback；`resolutionTextMap` 映射显示文案
- **待办/遗留**：无 ffprobe 时 probe 模式为空（需本机安装）；`publish_number`/`director` 仍空（刮削源未给）

## 2026-08-21 — 命名混写兼容 + AI 读输入框

- **背景**：补齐「混写兼容」与 AI ✦ 交互（不再用 window.prompt）。
- **决策/结论**：
  - 引擎：先保护 `{{ }}`/`{% %}`，再替换 `{field}`，最后 Nunjucks 渲染；基础缺字段「未知」、Jinja 缺字段为空，可同模板混写
  - AI：✦ 读取输入框自然语言；空则提示填写；已是模板则提示先清空再写描述；生成结果写回输入框
- **待办/遗留**：无

## 2026-08-21 — 设置·命名 P0+P1（保留 .chs）

- **背景**：用户确认命名页大改：P0 UI + P1 引擎一起做；AI ✦ 必做；**保留**字幕 `.chs` 能力。
- **决策/结论**：
  - 引擎：`nunjucks` 渲染 `{{ }}` / `{% if %}`；仍兼容 `{field}`；常用 filter 已注册
  - 配置：`scrape.naming` 扩展为完整命名模型（目录/标题/视频/图片/分类规则/马赛克/字幕/分辨率/后缀等）
  - UI：命名 Tab 长表单 + 导入/导出/测试/保存；模板旁 ✦ 调系统 LLM（localStorage）生成 Jinja2
  - `.chs`：下载页与命名页同源开关；`copySubtitlesBesideVideo` 再次尊重 `addChsSuffix`；整理 runner 读 download ∨ naming
  - 流水线：`plan.ts` 用全局 naming 建上下文 + `buildVideoNameSuffix`；预览 API 同步增强
- **待办/遗留**：已由同日「命名引擎三缺口补齐」收口

## 2026-08-21 — 海报 face 裁剪真检脸

- **背景**：face 原先只是中心裁；按建议落地真人脸检测。
- **决策/结论**：
  - 采用 `@vladmandic/face-api` TinyFaceDetector + `@tensorflow/tfjs` CPU（免原生编译）+ 现有 `sharp` 裁切
  - 流程：检脸 → 选主体（分/面积/略偏右）→ 按比例锚点裁；无人脸或模型失败 → 居中裁
  - 模型从 `node_modules/@vladmandic/face-api/model` 懒加载
  - UI 文案改为「人脸识别（失败则居中）」
- **待办/遗留**：未做旋转兜底（MDC 有）；未接 YuNet ONNX（后处理重）；大批量整理可再考虑 worker 池

## 2026-08-21 — 设置·下载「海报裁剪」区块

- **背景**：用户要求在高清海报下增加海报裁剪内容设置（参考 MDC 截图）。
- **决策/结论**：
  - 下载 Tab 新增「海报裁剪」：七区分区裁剪下拉 + 裁剪比例 / 独立海报裁剪 / 优先裁剪结果
  - 分区 `posterCrop` 写 `kindProfiles`；比例与开关写 `download.cropRatio|cropIndependentPoster|preferCropResult`
  - 引擎：`resolveEffectiveKindProfile` 裁剪不跟命名全局开关；`processPosterImage` 吃比例与独立裁剪
  - 命名 Tab 去掉全局「海报裁剪」单项（避免与下载区重复）
- **待办/遗留**：人脸识别仍为中心裁占位；双图质量对比（缩略裁 vs 高清原图）未做

## 2026-08-21 — 设置·下载「高清海报」对齐 MDC

- **背景**：用户给参考图，要求完善高清海报区块。
- **决策/结论**：
  - UI：Amazon 高清海报 / Tenhow 高清海报 / 严格模式 / DMM 优先高清（ps→pl）
  - 配置：`amazonHdPoster` / `tenhowHdPoster` / `amazonStrictMode`；`amazonHdPoster` 与引擎已有 `skipAmazon` 互反同步
  - 分区弹窗下载专属开关同步更新
- **待办/遗留**：Amazon/Tenhow **主动搜图**流水线仍未接（P3）；当前 Amazon 开关只影响是否过滤封面候选中的 Amazon 图；严格模式仅落库

## 2026-08-21 — 分区弹窗：整理对齐 + 源链 Tag 编辑

- **背景**：上会话「继续」中断；待完成整理 Tab 对齐参考图，以及弹窗数据源从逗号输入升级。
- **决策/结论**：
  - **整理 Tab**：顶「使用全局」→ 专属时整理目录/模式/硬软链降级/元数据目录/失败删除；来源目录始终在底部；全局时整理目录文案统一（不再叫「输出目录」）；启用状态只在外层卡片开关，保存时用 `kind.enabled` 不覆盖
  - **数据源 Tab**：新增 `SourceChainEditor`（序号 Tag + ↑↓ 排序 + 下拉添加 + 移除）；「使用全局」开启时源链只读展示已存分区链；关闭后可改
- **待办/遗留**：源链仍无真正「全站一份」模板（各区 `kindProfiles`）；字段级优先级仍只在数据源页

## 2026-08-21 — 外层全局 / 弹窗分区 配置分层

- **背景**：用户明确：七区卡片弹窗管分区差异；设置 Tab 与数据源页只做全局。
- **决策/结论**：
  - **设置·命名** → 只写 `scrape.naming`（全局模板）；引擎经 `resolveEffectiveKindProfile`：分区 `useGlobal.naming!==false` 用全局，否则用 `kindProfiles` 专属
  - **数据源页** → 去掉分区源链/命名编辑，仅 Provider 开关 + 全局字段优先级；分区源链只在弹窗「数据源」Tab
  - **弹窗** → 继续承载整理/下载/命名/水印/元数据/NFO/数据源的专属覆盖
- **待办/遗留**：源链无「全站一份」语义（各区仍存 `kindProfiles`）；弹窗「使用全局」开启时源链只读展示已存分区链（已用 Tag 编辑器）

## 2026-08-21 — 分区监控目录设置弹窗（全局/专属）

- **背景**：用户要求按参考图一次性完成「监控目录设置」弹窗（Tab + 使用全局配置 + 专属表单）。
- **决策/结论**：
  - **UI**：点击七区卡片打开 `KindSettingsModal`；标题 `监控目录设置 - {来源路径}`；Tab：整理/下载/命名/水印/元数据/NFO/数据源；底栏「保存修改」「关闭」
  - **整理专属**：挂 `libraries.kinds[kind].useGlobalOrganize` + sticky（`organizeMode`/`metadataDir`/`deleteMetadataOnFail`）；路径仍在 kind 上
  - **下载/水印/元数据/NFO 专属**：挂 `scrape.kindProfiles[kind].useGlobal` + 对应 override 字段；`resolveKindScrapePrefs` 合并全局
  - **命名/数据源**：开关控制本弹窗是否可改；数据仍写 `kindProfiles`（与设置页同源）
  - **引擎**：整理用 `resolveOrganizeForKind`；刮削下载/元数据与整理水印/NFO/字幕走分区 prefs
- **待办/遗留**：命名「全局」尚无独立全局模板（沿用设置·命名分区值）；数据源 UI 为逗号输入，未复用刮削源拖拽链

## 2026-08-21 — 全站 UI 统一为监控页主题

- **背景**：用户要求项目所有页面同一主题风格，以监控页配方为基准。
- **决策/结论**：
  - **卡片**：`.panel` / `.mon-panel` / `.card` 统一为边框 + `shadow-sm` + 44px 浅底框头 + 12px uppercase 标题
  - **开关**：全局胶囊 `.switch input[type=checkbox]`（空 `span` 隐藏）；行内用 `SettingRow` + 胶囊
  - **设置各 Tab**：整理/系统/网络/命名/NFO/下载/元数据/水印/Webhook/演员 → `mon-panel` + `SettingRow` + `mon-panel-lead`
  - **业务页**：仪表盘 `.card`/`.stat-card`、任务/记录/文件等 `.panel` 靠 CSS 对齐；不硬套 SettingRow
  - **例外保留**：七区 kind-cfg+Modal、水印双栏、Webhook subcard 内表单
- **待办/遗留**：刮削源页（ScrapeConfigPanel）仍为旧 panel 内容结构（壳已统一）；真机扫各路由观感

## 2026-08-21 — 设置页保存钮统一为文档流底栏

- **背景**：用户要求各设置页「保存」贴页面最底、随页面滚动，不要视口悬浮条。
- **决策/结论**：
  - 统一用 `.page-save-row`（`position: static` + `margin-top: auto`），去掉 `settings-save-bar` 的 `position: fixed`
  - 各 Tab 根容器加 `*-settings`（`min-height: calc(100dvh - 180px)`），短内容时按钮顶到可视底；长内容随文档流滚走
  - 测试/探测等次要操作仍留在表单区；主保存只在底栏
- **待办/遗留**：刮削配置页（`ScrapeConfigPanel`）仍有分区/字段级保存，未纳入本次；真机扫一眼各 Tab 短/长内容观感

## 2026-08-21 — MDC 整理规则缺口落地（P0）

- **背景**：对照 MDC-NG §4，整理页开关多「可存不生效」。
- **决策/结论**：
  - **覆盖分流**：`overwriteImages` 接入 poster；字幕跟随 `onConflict`/`overwriteVideoSubtitle`
  - **失败删元数据**：刮削失败时清封面/meta JSON，及 `metadataDir/<code>` 子目录
  - **自动清理**：整理成功后 `cleanupSourceDirectory`（同层杂项；白名单保护视频）
  - **监控过滤**：与扫描共用 `scanFilter`（后缀/黑名单/体积）
  - **元数据路径**：独立 meta 根下保留 `relativeDir`，减撞名
  - **全局模式**：改 `defaultMode` 时清分区 sticky `organizeMode`
  - **本页 UI**：补硬链/软链失败降级；文案对齐 MDC
- **待办/遗留**：清理仅处理源视频同层目录（不深递归）；分区级模式覆盖 UI 仍无（依赖清 sticky）

## 2026-08-21 — iOS 显示规范 + 触控加固

- **背景**：用户反馈 iOS 上下拉/说明过小，要求写文档并再优化。
- **决策/结论**：
  - 新增 `docs/UI-IOS.md`（16px 控件、44px 热区、safe-area、dvh、select 外观、固定底栏）
  - `displayMode.ts` 增加 `html.is-ios`；已有 `is-standalone`
  - 移动端：全站 input/select/textarea ≥16/44；通用 select 去原生压扁；按钮/导航/Tab 加大；hint 14px
  - 保存条叠加 safe-area；挂链 DESIGN-SYSTEM / PLAYBOOK / DENSITY / cursor 规则
- **待办/遗留**：真机 Safari + 主屏幕各验一次；侧栏触控展开仍依赖 hover（后续可做抽屉按钮）

## 2026-08-21 — 按 UI-DENSITY 收紧全站密度

- **背景**：用户要求按 `docs/UI-DENSITY.md` 重调 Web 页面。
- **决策/结论**：
  - 壳层：主区 padding 24/32、页头下边距 16、页标题 24px
  - 面板/表/弹窗：panel-body 16、表行 8×12、modal 三区收紧
  - 统计条：20px 数字 + 12px 卡内边距；仪表盘 `.card` 补齐样式
  - 设置：panel 纵向 gap 16、小写大写区块标题；嵌套项改 `settings-subcard`
  - 整理页去掉重复「整理规则」intro；删未用 radio-cards CSS
- **待办/遗留**：浏览器目视扫设置各 Tab / 任务列表 / 仪表盘

## 2026-08-21 — UI 紧凑与协调排版指南

- **背景**：用户要求写文档，指导如何把页面做得更紧凑、更协调。
- **决策/结论**：
  - 新增 `docs/UI-DENSITY.md`：密度刻度、对齐轴、字号阶梯、MDCS 设置/列表/仪表盘配方、验收清单
  - 明确「紧凑 ≠ 拥挤」；与 DESIGN-SYSTEM「留白」关系：松在首屏/空状态，紧在表单/表格
  - 已挂链到 `UI-DESIGN-SYSTEM.md`、`UI-PLAYBOOK.md`、`.cursor/rules/ui-design-system.mdc`
- **待办/遗留**：按该指南实改设置页等（未在本次改样式）

## 2026-08-21 — 侧栏改用 Heroicons Solid

- **背景**：用户选 B，要截图同款好看实心图标，不要手绘。
- **决策/结论**：
  - 依赖 `@heroicons/react`（国内源 `registry.npmmirror.com` 安装）
  - `navIcons.tsx` 映射：Home / Sparkles / Clock / User / Folder / GlobeAlt / Cog6Tooth（24/solid）
  - 去掉侧栏 emoji；`lucide-react` 暂留未用
- **待办/遗留**：无

## 2026-08-21 — iOS 添加到主屏幕 / 独立全屏适配

- **背景**：用户要求支持 iOS「添加到主屏幕」全屏模式并做布局适配。
- **决策/结论**：
  - 增加 `public/manifest.webmanifest`（`display: standalone`）+ Apple meta（`apple-mobile-web-app-capable`、`black-translucent`、`viewport-fit=cover`）
  - 图标：`public/icons/`（180/192/512，品牌色 + S，用 sharp 生成，非手绘插画）
  - CSS：`safe-area-inset` + `100dvh`；侧栏/主区/Toast 避让刘海与底部横条
  - iOS Safari 非独立窗口时底部引导条；`html.is-standalone` 标记
- **待办/遗留**：真机 Safari 验收「分享 → 添加到主屏幕」；生产需重新 `web` build 使 public 资源进 dist

## 2026-08-21 — 整理 Tab 规则化 + 七路径迁入监控

- **背景**：用户指出「整理」不应是七路径配置，应对齐 MDC 整理规则；七路径改放监控；并要求加入软链接与原地整理。
- **决策/结论**：
  - `OrganizeConfig` 扩展：metadataDir、覆盖开关、体积/后缀/黑名单/垃圾过滤/破解词、cleanup（默认关）
  - 整理模式新增 `softlink` / `inplace`（保留 copy/move/hardlink）
  - 七路径 UI → `KindPathsPanel`，挂在 **设置 · 监控** 顶部
  - **设置 · 整理** 重做为规则页；`PUT /api/kinds/organize` 保存
  - 扫描侧已读过滤项；整理引擎支持 softlink/inplace 与独立元数据目录
- **待办/遗留**：自动清理真正删文件、失败删元数据目录、覆盖图片与视频分流落地；DESIGN 原文「不做软链/原地」已按用户要求推翻

## 2026-08-21 — Web 浅色极简样式迁移

- **背景**：用户要求按 UI-DESIGN-SYSTEM 优化全站 Web 样式。
- **决策/结论**：
  - `styles.css` `:root` 换成浅色 Token（钢青主色 + 鼠尾草辅助）
  - 去掉径向渐变背景、品牌渐变、glow、厚阴影、backdrop 模糊
  - 侧栏/主按钮/Toast/表格/Chip/设置 Tab 对齐克制规范；字重上限 600
  - 旧变量 `--bg-card` 等保留别名，减少漏改
- **待办/遗留**：浏览器目视验收各页；个别内联 `style`/`#333` 边框如有再清

## 2026-08-21 — UI 设计契约入库（极简克制）

- **背景**：用户要求把全站视觉规范写入文档，供 Cursor 强制遵守，并优化 Web 样式前先立约。
- **决策/结论**：
  - 完整契约：`docs/UI-DESIGN-SYSTEM.md`（含固定色值/字号/间距/圆角/阴影 Token）
  - Cursor 规则：`.cursor/rules/ui-design-system.mdc`（匹配 `apps/web/**/*.{tsx,ts,css}`）
  - 气质：浅色极简克制；红线禁止渐变发光、厚阴影、夸张动效、网红风
  - 主色钢青 `#3D5C63` + 辅助鼠尾草 `#7D8B74` + 中性灰；与旧暗色蓝光主题冲突时以新契约为准
  - `UI-PLAYBOOK` 视觉节改为指向 DESIGN-SYSTEM
- **待办/遗留**：下一步按 Token 重做 `apps/web/src/styles.css`（暗→浅迁移）

## 2026-08-21 — S6 全部收口 → v1.0.0

- **背景**：用户要求 S6 全部完成。
- **决策/结论**：
  - **S6.1/6.2**：验收清单 `docs/S6-ACCEPTANCE.md`；失败文案补磁盘满/Flare/鉴权
  - **S6.3**：orchestrator/runPool 单源隔离；`POST /api/scrape/providers/probe` + 15min 冷却跳过
  - **S6.4**：DB 索引加固；`npm run bench:scan` 万级增量判定吞吐
  - **S6.5/6.6**：失败演练表；路径白名单已有；可选 `MDCS_API_TOKEN`；`redactSecrets`
  - **S6.7**：`LazyCover` + `VirtualList`；WS 增量沿用
  - **S6.8–6.10**：`docs/USER.md`、Dockerfile/compose、`scripts/start.*`、CHANGELOG、版本 **1.0.0**
  - **S6.11**：ROADMAP 附录 B 勾选已验证
  - **S6.12**：删除未使用 `LivePage`；生产可托管 `web/dist`
- **待办/遗留**：Emby 真同步、人脸检测、LLM 翻译、revert 等后置增强

## 2026-08-21 — S5.6–5.8 预设 / 演员 / qB

- **背景**：用户选 S5 全收口（含 P2/P3）。
- **决策/结论**：
  - **S5.6**：创建任务「配置复用」不复用/上次/预设；保存/删除/导出/导入 JSON；手动建任务写入 `lastJob`
  - **S5.7**：择本地演员库（从 `scrape_cache` 聚合）；`/actors` 列表+搜索；设置·演员 Tab 存 Emby 预留字段但不联动
  - **S5.8**：`POST/GET /api/ops/qb/completed`；监控 Tab 配置开关/模式/分区/分类过滤；自动任务 `remember: false`
- **待办/遗留**：进入 S6；Emby 真同步后置

## 2026-08-21 — S5.1–5.5 监控 + Webhook

- **背景**：用户要求推进 S5。
- **决策/结论**：
  - 新增 `config/ops.json` + `/api/ops/config`；监控/Webhook 与 scrape 配置分离
  - **S5.1/5.2**：设置·监控 Tab；兼容模式默认 30s 轮询；目录空则自动用启用分区 sourceRoot；变更触发建任务（15s 防抖 + 活跃任务去重）
  - **S5.3**：性能模式 `fs.watch`（失败提示改兼容）
  - **S5.4/5.5**：Webhook Tab（Endpoint 全字段 + 测试）；任务 done/failed 派发；`{{ var }}` 模板；重试/超时可配
  - 单测 **103**；typecheck ✅
- **待办/遗留**：S5.6 预设 / S5.7 演员 / S5.8 qB；S6 交付

## 2026-08-21 — S4 收口（4.8/4.9/4.11/4.12）

- **背景**：用户要求继续完成所有未完成任务；范围对齐为 **S4 剩余项**（不含 S5/S6 整阶段、不含 P3 revert）。
- **决策/结论**：
  - **S4.12**：任务覆盖 — sources→orchestrator；download/metadata/watermark/nfo/organize/naming 均已接线；创建任务 move 强确认
  - **S4.11**：设置·元数据 Tab（严格模式/封面校验/trimPlot/翻译开关）；翻译 LLM 仍后置
  - **S4.8**：sharp 水印角标 + 右侧/中心裁剪；设置·水印 Tab + 预览
  - **S4.9**：字幕库路径 + `.chs`；整理时按番号匹配复制
  - 单测 **100**；typecheck ✅
- **待办/遗留**：S4.14 revert（P3）；真人脸检测；S5 监控/Webhook；LLM 翻译落地

## 2026-08-21 — S4.10 下载 Tab

- **背景**：S4.4/4.6/4.7 完成后继续 P1。
- **决策/结论**：
  - 设置·下载 Tab：下载内容开关、coverDownloadStrategy、preferHighResPoster、skipAmazon
  - `downloadPrefs.ts`：Amazon URL 过滤 + ps→pl；runner 读全局配置；任务级 download 覆盖可生效
  - Amazon/Tenhow 主动搜图仍为 P3，本步只做跳过与升清
  - fanart 等资源类型仅存配置，未接产物流水线
  - 顺手修复 `organize/plan.ts` 中损坏的 `joinLibraryTarget` 调用（typecheck 阻断）
- **待办/遗留**：S4.12 其余 Tab 覆盖真生效；face 真实裁剪

## 2026-08-21 — S4.4/4.6/4.7 命名·NFO 合并·裁剪配置

- **背景**：继续 S4 P1 项。
- **决策/结论**：
  - **S4.4**：设置·命名 Tab；按 Kind 编辑 directory/fileName/suffix；`POST /api/organize/preview` 测试路径
  - **S4.6**：`nfoMergeStrategy` prefer_nfo | prefer_scraped；写入前合并本地 NFO；设置·NFO Tab
  - **S4.7**：`posterCrop` 按 Kind 可配（有码默认 right，无码/FC2/写真等 none）；face 占位待图像库
  - 修复 plan.ts 中 ctx 先用后定义的 bug
- **待办/遗留**：S4.10 下载 Tab；S4.12 任务高级覆盖真生效；face 真实裁剪

## 2026-08-20 — S4 P0：Plan / Organize / NFO

- **背景**：S3 完成后进入入库闭环；用户继续推进。
- **决策/结论**：
  - **S4.1**：`organize/template.ts` + `plan.ts`，`{field}` 模板；空段省略；`GET /api/organize/plan/:kind`
  - **S4.2/4.3**：`fsops.ts` hardlink（失败 fallback copy）/ copy / move；冲突 skip|overwrite|rename；任务 `dryRun` 只出计划不落盘
  - **S4.5**：`nfo.ts` 写 Emby/Kodi `movie.nfo`（uniqueid/actor/genre/plot CDATA）
  - **S4.13**：状态 `organizing → done|failed`；写 `target_path` / `organized_at`
  - scheduler：`organize_only` / `full` 接入 `runOrganizeForKinds`
  - typecheck ✅；单测 **86** 项
- **待办/遗留**：S4.4 命名 Tab UI；S4.6 NFO 合并；S4.7 海报裁剪；move 强确认文案（任务创建侧）

## 2026-08-20 — S3 刮削引擎全部收口（S3.4 / S3.8–S3.16）

- **背景**：用户要求 S3 全部完成。
- **决策/结论**：
  - **S3.4**：`classifyFromPath` → 扫描写入 `files.mosaic`（有码/无码/破解/流出）
  - **S3.8/S3.9**：批次 B/C 共 11 源实现并注册；catalog `implemented` 合计 **15**
  - **S3.10**：本地封面跳过重复下载；`size` 策略 HEAD 比 Content-Length；runner 写回 `coverLocal`
  - **S3.11**：源链上下排序 + 字段优先级可编辑/点 Tag 屏蔽；同步 scrape.json
  - **S3.12/13**：记录列表（筛选/搜索/批量重试）+ 详情（fieldSources Tag 高亮 sourceRuns）
  - **S3.14**：设置·系统 Tab（并发/超时/封面策略/TPDB Key + LLM 测试）
  - **S3.15**：scrape_only/full 前半已跑通；full 整理明示待 S4
  - **S3.16**：记录页顶部单番号调试
  - typecheck ✅；单测 **79** 项通过
- **待办/遗留**：进入 **S4**（Plan/Organize/NFO）；LLM 仅浏览器侧探活，未接命名翻译

## 2026-08-20 — S3.6 FAST/SLOW 双通道

- **背景**：批次任务若串行打 javdb（proxy_flare），Flare 会堵住 javbus/jav321 等快源。
- **决策/结论**：
  - `access === proxy_flare` 判定慢源（javdb）；`proxy_adaptive` 仍走快通道
  - 快通道跳过过盾源；不够且非全员空号 → `message=needs_flare` 交慢通道；全员空号直接 `not_found` 不再耗 Flare
  - `runner` 使用 `exportFastConcurrency` / `exportSlowConcurrency` 两个独立池；慢通道带上快通道 `priorBySource` 再合并
  - 单次 API 默认 `channel=auto`（快不够再补慢）；可显式传 fast/slow
- **待办/遗留**：S3.12 刮削记录页展示 sourceRuns；S3.15 scrape_only 任务闭环；S3.4 Classify

## 2026-08-20 — S3.5 字段优先级引擎 + S3.7 Provider 批次 A

- **背景**：继续 S3 刮削引擎；S3.5 合并语义需对齐 DESIGN §10.5，S3.7 实现有码核心四源。
- **决策/结论**：
  - **S3.5**：新增 `scrape/merge.ts`——`resolveFieldSourceOrder`（空 `[]` 继承 global/meta；非空严格不回退）、`pickFieldStrict`/`pickCoverStrict`、plot←outline / genres←tags 别名；`ScrapeMeta.fieldTimings` 可观测；`orchestrator` 去掉 javbus 早停与全源 fallback
  - **S3.7**：实现 `jav321`（POST `/search` + panel-info）、`libredmm`（JSON 详情/搜索 + processing 重试）、`javdb`（Flare 搜索+详情）；`fetchJson`/`fetchPostForm`；catalog `implemented: true`
  - typecheck ✅；单测 **63** 项通过（含 merge 10 项）
- **待办/遗留**：S3.12 刮削记录页；S3.4 Classify + mosaic

## 2026-08-20 — S3.2 网络栈 + S3.3 识别规则 v2

- **背景**：用户要求继续并完成当前阶段推进项。
- **决策/结论**：
  - **S3.2**：引入 `undici` ProxyAgent；`fetchText` 按 access（direct/proxy/proxy_flare/proxy_adaptive）走直连/代理/Flare；启动与保存配置时同步代理；网络 Tab 增加「测试代理」
  - **S3.3**：`identify.ts` 对齐 JavSP avid 关键规则（HEYDOUGA/无分隔符/域名剥离/东热/TMA/纯数字等）+ FC2-PPV；fixture **37** 条 + 路径回退；单测共 53 项通过
- **待办/遗留**：S3.5 字段合并引擎；S3.7 Provider 批次 A

## 2026-08-20 — S3.1 Provider 注册表

- **背景**：S2 已全部完成，进入 S3 刮削引擎；首步 Provider 目录与 UI 开关。
- **决策/结论**：
  - 新增 `scrape/providers/catalog.ts`：25 源 SOURCE_CATALOG（id/label/url/probe/access/implemented）
  - `scrape.json` 增加 `disabledProviders`；`/api/scrape/config` 返回 `catalog`
  - 数据源页 Provider 卡片网格 + 启用开关；刮削时跳过 disabled 源
- **待办/遗留**：S3.2 网络栈代理接入；S3.7 批次 A Provider 实现

## 2026-08-20 — S2 控制面闭环收尾（S2.1/7/8/9）

- **背景**：用户要求 S2 剩余项全部完成后再进 S3。
- **决策/结论**：
  - **S2.1**：Dashboard 失败文件总数 + 可点击下钻至 `/files?status=failed`、`/tasks?status=…`
  - **S2.7**：`JobAdvancedSettingsModal` 七 Tab + `useGlobal` 开关；`jobs.options_json` 存任务覆盖
  - **S2.8**：网络 Tab 增加 `requestTimeoutSec`、直连/Flare 测试连接 API
  - **S2.9**：WS `job_update` 推送 + `useJobEvents` 增量更新 Dashboard/任务列表
- **待办/遗留**：S2 出口已达成；下一阶段 S3 刮削引擎

## 2026-08-20 — S2.3–S2.5 + S2.10 scan_only

- **背景**：继续控制面闭环；任务列表、文件管理、scan_only 增量扫描。
- **决策/结论**：
  - **S2.5**：`/api/jobs` 支持 status/mode/q 筛选与分页；JobsPage 独立拉取 + 5s 轮询
  - **S2.3–S2.4**：FilesPage 增加已索引文件分页列表、「创建扫描任务」、目录树名称过滤
  - **S2.10**：`shouldSkipScanEntry` 按 mtime+size 跳过未变化文件；`rescan` 模式 force 重扫；任务执行中实时更新进度；单测 5 条
- **待办/遗留**：S2.1 失败下钻；S2.7–S2.9；文件多选建任务（非全分区）

## 2026-08-20 — S2 控制面闭环（七路径 + 任务弹窗）

- **背景**：继续 ROADMAP，完成 S2.1–S2.6 控制面核心 UI。
- **决策/结论**：
  - 新增 `OrganizeSettingsPanel`（S2.2 ✅）：七路径 Tab + 内联表单 + 脏检查 + 右下角保存条
  - `SettingsPage` 支持 `/settings/organize`、`/settings/network`；删除 `ProjectPage`/`ConfigPage`
  - `CreateJobModal`（S2.6 ✅）：模式/分区/dry-run
  - Dashboard、FilesPage、JobsPage 列表已有雏形（S2.1/3/4/5 部分完成）
- **待办/遗留**：
  - S2.7 任务高级设置弹窗；S2.8 网络测试连接；S2.9 WS 增量刷新
  - S1.3–S1.4 设计 Token / 基础组件仍未抽离

## 2026-08-20 — S0 收尾 + S1 壳 + S2 起步

- **背景**：用户「继续」按 ROADMAP 逐步重构；会话内完成 S0 全项与 S1 大部分。
- **决策/结论**：
  - **S0**：`docs/API.md` 契约文档；`ApiError` + `CODE_MESSAGES` 全链路；`pathPolicy` 目录浏览 API 越权返回 `path_not_allowed`；`npm test` 8 项通过
  - **S1**：`AppShell` + 七路由 + 旧路由重定向；删除 `Shell.tsx`；Settings 11 Tab 壳；Actors 占位
  - **S2 起步**：Dashboard 四卡 + 最近任务/文件表；FilesPage 路径扫描 + 只读目录树
- **待办/遗留**：
  - S1.3–S1.4 设计 Token 与基础组件库未抽离
  - S2.2 七路径 CRUD 仍在 ConfigPage；S2.5–S2.6 任务弹窗待做


- **背景**：按 `ROADMAP.md` 开始逐步重构，先执行 S0.2（配置类型单源）。
- **决策/结论**：
  - 新增 `apps/server/src/config/schema.ts`，集中定义默认配置与规范化逻辑：
    - `createDefaultLibrariesConfig` / `normalizeLibrariesConfig`
    - `createDefaultScrapeConfig` / `normalizeScrapeConfig`
  - `loadConfig.ts` / `loadScrape.ts` 改为统一走 schema：缺省自动补全、非法 JSON 抛中文错误、保存前二次规范化
  - `types.ts` 增加 `LibrariesConfig.server/web` 可选结构，兼容现有 `libraries.json`
  - 修复 `config/validate.ts` 的类型冲突（`OrganizeMode`/`OrganizeFallback`）
  - `npm run typecheck --prefix apps/server` 通过
- **待办/遗留**：
  - 继续 S0.3：API 契约与错误码映射统一

## 2026-08-20 — ROADMAP：地基到交付逐步计划

- **背景**：用户要做超越所有参考项目的相对完美产品，要求把项目拆成可逐步执行的小步骤计划表。
- **决策/结论**：
  - 新增 `docs/ROADMAP.md` v1.0：北极星标准、S0→S6 共约 70+ 可勾选小步骤、完成标准、周节奏、旧 UI 对照、超越对照表
  - 新增 `docs/README.md` 文档索引（对应 ROADMAP S0.1）
  - `DESIGN.md` §8 改为指向 ROADMAP，阶段与 S0–S6 对齐
- **待办/遗留**：
  - 用户确认后从 S0.2（配置类型）起改代码

## 2026-08-20 — 补齐 UI-COPY + UI-WIREFRAMES

- **背景**：用户说「继续」，承接此前「文案库 / 低保真布局」二选一提案，两份一并补齐。
- **决策/结论**：
  - 新增 `docs/UI-COPY.md`：术语表、全局按钮/Toast/确认框/空状态、各页字段文案、七路径显示名、API→用户错误映射；约定落点 `messages.ts`
  - 新增 `docs/UI-WIREFRAMES.md`：全局骨架 + Dashboard/任务/记录/演员/文件/数据源/设置各 Tab ASCII 草图、响应式断点、实现勾选清单
  - `UI-PLAYBOOK.md` / `DESIGN.md` 增加交叉链接与文档分工表
- **待办/遗留**：
  - 前端重构时按 WIREFRAMES 改 IA，文案统一走 COPY

## 2026-08-20 — 新增 UI 体验手册（页面好看/交互自然）

- **背景**：用户要求再写一份独立文档，专门说明 MDCS 页面如何设计得更好看、交互更自然、操作更顺手。
- **决策/结论**：
  - 新增 `docs/UI-PLAYBOOK.md`（v1.0）
  - 文档聚焦 UI/UX 落地：视觉系统、交互规则、操作流、微文案、可用性、性能体验、分阶段实施与验收清单
  - 与 `docs/DESIGN.md` 分工明确：DESIGN 定义“做什么”，PLAYBOOK 定义“怎么做得好用好看”
- **待办/遗留**：
  - 后续前端改版按 `UI-PLAYBOOK.md` 的 P1→P3 逐项验收

## 2026-08-20 — DESIGN v1.2 八参考项目引擎对照

- **背景**：用户要求对照 `references/` 下 8 个参考项目源码，检查 DESIGN 文档完善空间（前次 Task 中断后续做）。
- **决策/结论**：
  - 盘点 8 项目：sehua-next-web（引擎主参考）、mdcx-diy、JavSP、javinizer-go、JavSP-Web、javbus-api、javspider_stack、jellyfin-jav-scraper
  - `docs/DESIGN.md` 升 **v1.2**：新增 §10 参考项目能力对照与补全清单；扩展 §5 双通道/识别/字段优先级语义；§6 ScrapeMeta 完整字段
  - 明确非目标：javspider 磁力管理、Jellyfin 插件形态
  - 高优缺口：Provider 注册表+access、JavSP 级识别、API 目录白名单、FAST/SLOW 规格、NFO 合并策略
- **待办/遗留**：
  - 按 §10.8 优先级推进 P1 引擎与 UI IA 迁移

## 2026-08-20 — DESIGN v1.1 UI 全量补全（MDC 字段级）

- **背景**：用户反馈 v1.0 设计文档 UI 细节太少，要求完整参考 MDC-NG-UI。
- **决策/结论**：
  - 重建 `docs/DESIGN.md`（删除旧拼接版后单文件重写），版本升至 **v1.1**
  - §4 扩展为 **完整 MDC UI 规格**：全局交互、侧栏、Dashboard、手动任务（含高级设置各 Tab 覆盖表）、刮削记录、文件管理双模式、数据源 Provider/全局/字段优先级、设置 11 Tab 字段表
  - 命名 Tab 补全马赛克/字幕/分辨率/后缀全表；NFO Tab 补全 14.x 分组；演员 Tab 补全 Emby 配置；Webhook 补全 Body 变量与七路径触发分类
  - MDCS 差异统一标注 **【MDCS】**：七路径、写真源链、整理三模式、演员/Webhook/监控 Phase 标注
- **待办/遗留**：
  - 按 §4.9 映射表拆 Phase 1→4 前端实现任务

## 2026-08-20 — DESIGN v1.0 从零重写（MDC 底座）

- **背景**：用户明确要求忽略现有代码实现，以 MDC 文档为设计底座，从头重写项目设计文档。
- **决策/结论**：
  - `docs/DESIGN.md` 整体重写为 v1.0 基线文档，不做增量修补
  - 采用 MDC 页面架构（主界面/任务/记录/文件管理/数据源/设置/Webhook）作为 UI 结构
  - 在底座上补入色花 `japan_gravure`，统一为七大路径模型
  - 明确了目标态 API、任务级高级设置覆盖、Webhook payload、阶段实施路线
- **待办/遗留**：
  - 按 v1.0 文档逐节拆实现任务（Phase 1->4）

## 2026-08-20 — DESIGN：MDC 底座改为七路径 UI 架构

- **背景**：用户要求以 MDC 作为 Web UI 设计底座，并将原 6 路径补齐色花 `japan_gravure`（日本写真），统一为 7 大路径配置。
- **决策/结论**：
  - `docs/DESIGN.md` 新增 `3.0.B UI 架构基线（MDC 底座 + 七路径本土化）`
  - 明确侧栏与页面职责、全局/按区覆盖规则、任务与统计按 `KindId` 下钻
  - 增加“6→7 补齐策略”表，强调 `japan_gravure` 为本土化补齐项
  - 在 `3.0.1` 增补七路径最小可用 JSON 配置示例，显式包含 `japan_gravure`
- **待办/遗留**：
  - 将该 UI 基线进一步收敛为实现清单（页面字段级 API 对齐）

## 2026-08-20 — MDC-NG：Part 6 全量补齐

- **背景**：用户一次性补充了主界面、数据源优先级(全局+字段)、文件管理(双模式)、Webhook Endpoint 完整表单截图。
- **决策/结论**：
  - `docs/references/MDC-NG-UI.md` 全文重写 §18.5–§18.8，新增主界面 Dashboard、文件管理双模式、数据源全局/字段优先级完整源链、Webhook Endpoint 字段级详情（含 Body 变量表）
  - 文档状态升级为 **Part 1–6 全量已录**；仅演员管理缺详情页
  - 变更记录追加 Part 6 行
- **待办/遗留**：
  - 演员管理详情页（非 MDCS 目标，优先级低）
  - 可开始收敛为 MDCS UI 正式设计章节

## 2026-08-20 — MDC-NG 界面结构参考（Part 3）

- **背景**：用户提供 MDC 设置 · 水印 Tab 截图。
- **决策/结论**：`docs/references/MDC-NG-UI.md` 追加 §11 水印 Tab；MDCS 映射标注为 Phase 3 后置
- **待办/遗留**：Part 4 — 网络/元数据/NFO/系统/Webhook 及侧栏页

## 2026-08-20 — MDC-NG 界面结构参考（Part 4）

- **背景**：用户继续提供 MDC 设置页截图，涵盖网络、元数据、NFO、演员。
- **决策/结论**：
  - `docs/references/MDC-NG-UI.md` 追加 §12–§15
  - 记录了代理/Flare、元数据优化与翻译、NFO 字段选择、演员 Emby 联动
  - MDCS 映射更新为：网络=现有项目配置；元数据/NFO=Phase 3 重点；演员=后置独立模块
- **待办/遗留**：Part 5 — 系统、Webhook、侧栏详情页、数据源页

## 2026-08-20 — MDC-NG 界面结构参考（Part 2）

- **背景**：用户继续提供 MDC 设置页截图（下载下半、命名 Tab 全量）。
- **决策/结论**：`docs/references/MDC-NG-UI.md` 追加 §6.3–6.5、§10 命名 Tab；更新 MDCS 映射 §11
- **待办/遗留**：Part 3 — 水印/网络/元数据/NFO/侧栏其余页

## 2026-08-20 — MDC-NG 界面结构参考（Part 1）

- **背景**：用户提供 MDC-NG v1.36.0 截图，作为 MDCS 项目配置/设置 IA 的设计输入；后续还有 Part 2。
- **决策/结论**：
  - 新建 `docs/references/MDC-NG-UI.md` 稳定记录侧栏、设置 Tab、整理/监控/下载页字段
  - `DESIGN.md` §2.1 增加 MDC-NG 参考行并链到该文档
  - MDCS 映射草案写入参考文档 §7，待 Part 2 补全后再收敛为正式 UI 章节
- **待办/遗留**：用户补截图 → 命名/水印/网络/NFO/主界面/数据源等 Tab

## 2026-08-20 — 配置弹窗草稿被轮询覆盖

- **背景**：用户在分区配置弹窗里选目录，过一会选中项自动变回「未绑定」。
- **决策/结论**：
  - 根因：`App` 每 8s 刷新 `kinds`，`ConfigPage` 的 `useEffect([editingId, kinds])` 用服务端数据覆盖本地 `draft`
  - 修复：弹窗打开期间 `draft` 只随 `editingId` 初始化，轮询刷新不再覆盖未保存编辑
  - 轮询改为 `silent` 刷新，避免扫描按钮周期性闪烁禁用
  - `libraryRoot` 默认空字符串；去掉 `library/{id}` 不存在则清空的 hack
  - 目录占用提示排除当前正在编辑的分区
- **待办/遗留**：无

## 2026-08-20 — index 只读映射，不自动生成

- **背景**：用户说明 index 由其他服务生成文件，MDCS 不得写入，只需读取目录并映射到七区路径。
- **决策/结论**：
  - `config/libraries.json` 增加 `indexRoot: "index"`
  - 启动时不再 `mkdir` 来源/输出目录
  - `GET /api/kinds/folders` 只列出 `index/` 一级子目录
  - 配置弹窗从来源下拉选择文件夹，绑定到 `sourceRoot`
  - 未绑定来源时禁止扫描
- **待办/遗留**：index 未出现时等外部服务生成

## 2026-08-20 — 滚动条与中文弹出提示

- **背景**：用户要求优化全部滚动条，以及弹出提示的中文与配色。
- **决策/结论**：
  - 全局细滚动条（WebKit + Firefox），贴合深色主题
  - 右上角 Toast：成功绿 / 注意黄 / 失败红 / 提示蓝
  - 英文或接口原文会转成中文后再弹出
- **待办/遗留**：无

## 2026-08-20 — Web 四标签页 UI 重构

- **背景**：用户要求从页面驱动功能设计，多标签结构 + 大方美观。
- **决策/结论**：
  - 侧边栏导航四页：分区配置 / 任务队列 / 实时日志 / 数据源
  - WebSocket 实时事件流（`/api/events`）+ 单番号调试 + 文件索引
  - 任务页支持创建/暂停/继续/取消
  - 数据源页编辑 `scrape.json`（代理、源链、并发）
  - 深色渐变主题，响应式布局
- **待办/遗留**：字段优先级可视化编辑；libraries 全局 organize API

## 2026-08-20 — Phase 2 刮削引擎 + 前端 3050

- **背景**：用户要求前端改 3050 并继续 Phase 2 刮削。
- **决策/结论**：
  - 前端端口统一改为 **3050**（vite / libraries.json / start-dev.cmd / DESIGN）
  - 新增 `apps/server/src/scrape/`：config loader、orchestrator、javbus provider、cache、runner
  - API：`POST /api/scrape`（单番号）、`GET/PUT /api/scrape/config`
  - 任务调度接入 `scrape_only` / `full` 模式
  - 元数据缓存：`scrape_cache` 表 + `data/meta/{kind}/{code}.json`
  - 封面下载至 `data/covers/{kind}/`（需网络可达 javbus）
  - 其他源（jav321 等）暂为 stub，待后续实现
- **待办/遗留**：Phase 3 Organize + NFO；补充更多 provider；配置页 UI

## 2026-08-20 — 独立前后端，不接入色花

- **背景**：用户明确 MDCS 为独立刮削服务，有独立前后端，不接入色花。
- **决策/结论**：
  - 后端 `apps/server` :9210，前端 `apps/web` :3050（Vite + React）
  - 配置拆分：`libraries.json`（路径）+ `scrape.json`（源链，自维护）
  - `references/sehua-next-web` 仅阅读参考，零运行时依赖
  - Phase 2 刮削在 `apps/server/src/scrape/` 独立实现
- **待办/遗留**：Phase 3 Organize + NFO

## 2026-08-20 — 项目初始化

- **背景**：下载 sehua-next-web v1.0.14 作为刮削参考，并收集多个开源 AV/JAV 刮削项目对照。
- **决策/结论**：
  - 色花项目路径：`references/sehua-next-web/`，刮削源码在 `apps/scrape/`
  - 参考项目均在 `references/` 下（JavSP、javinizer-go、javspider_stack、javbus-api、mdcx-diy、JavSP-Web、jellyfin-jav-scraper）
  - 永久规则写入 `.cursor/rules/general-rules.mdc` 和 `memory-bank.mdc`
- **待办/遗留**：后续可对比各项目 JavBus 刮削实现差异

## 2026-08-20 — 架构 v0.2：文件夹刮削整理服务

- **背景**：明确产品为「源文件夹 → 刮削 → 分类整理 → 目标文件夹」，本地数据规模 20 万。
- **决策/结论**：
  - 设计报告升级 v0.2：`docs/DESIGN.md`
  - 双平面架构：控制面（API/UI）+ 数据面（Scan/Scrape/Organize）
  - SQLite Day 1：`files` 表索引 20 万行 + 断点续刮状态机
  - 七步流水线：Scan → Identify → Classify → Scrape → Plan → Organize → Artifact
- **待办/遗留**：确认七区各自的 sourceRoot / libraryRoot 实际路径

## 2026-08-20 — 整理模式：同盘硬链接

- **背景**：用户确认 inbox 与 library 同盘。
- **决策/结论**：
  - 全局默认 `organizeMode: hardlink`
  - `organizeFallback: copy`（硬链接失败时降级，防偶发异常）
  - 七区默认统一硬链接；仅当某区需清空 inbox 时单独改 `move`
- **待办/遗留**：Phase 1 代码；刮削源链可从色花 kindProfiles 导入

## 2026-08-20 — 文件夹配置（项目相对路径）

- **背景**：路径不用盘符，只要来源/输出文件夹配置。
- **决策/结论**：
  - `config/libraries.json`：七区 `sourceRoot` / `libraryRoot`
  - 目录：`inbox/{kind}/`（来源）、`library/{kind}/`（输出）
  - 整理默认 hardlink（同盘）
- **待办/遗留**：Phase 2 接入 sehua 刮削引擎；Phase 3 整理/NFO

## 2026-08-20 — Phase 1 骨架可启动

- **背景**：按设计实现 apps/server，国内 npm 源安装依赖。
- **决策/结论**：
  - 服务路径：`apps/server/`，端口 `9210`
  - 依赖：Express + tsx + node:sqlite（Node 22 内置，无 native 编译）
  - 国内源：根目录 `.npmrc` → npmmirror
  - 已实现：七区配置、SQLite、扫描、任务 API、WebSocket 事件流
  - 启动：`start-dev.cmd` 或 `npm run dev`（根目录）
- **待办/遗留**：刮削/整理 Phase 2/3

## 2026-08-20 — 架构 v0.3：以色花七区为底座

- **背景**：用户确认 7 大路径/文件类型，要求每类可单独配置，以色花为底座。
- **决策/结论**：
  - 设计报告升级 v0.3：`docs/DESIGN.md`
  - 七区 = 7 个 KindProfile（对齐色花 `kindProfiles` + `naming.byKind` + `posterCrop.byKind`）
  - 相对色花新增：`sourceRoot`（输入文件夹）、`organizeMode`（move/hardlink/copy）
  - SQLite 表 `kinds` 存七区配置；`files.kind` 关联七区
  - 刮削引擎直接 fork 色花 `apps/scrape`
- **待办/遗留**：用户提供七区实际路径后开始 Phase 1 代码

## 2026-08-20 — MDC-NG：补全系统/任务/记录/数据源等页面结构

- **背景**：用户继续提供 MDC-NG 的系统、手动任务、刮削记录、演员管理、文件管理、数据源管理截图。
- **决策/结论**：
  - 已写入 `docs/references/MDC-NG-UI.md`：将其作为 Part 5+ 补全（§18.1–§18.6）
  - 文档顶栏将「系统」标记为已录；本次补齐 `Webhook`（§18.7）
- **待办/遗留**：
  - 后续把这些 UI 能力逐项映射到 MDCS（线程/超时/OpenAI、任务创建、记录详情、数据源 provider/字段映射）
