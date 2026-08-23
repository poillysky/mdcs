# 数据源连接方式与取数路径（八参考项目最优合成）

> 版本：2026-08-22  
> 八参考：`sehua-next-web` · `mdcx-diy` · `JavSP` · `JavSP-Web` · `javinizer-go` · `javbus-api` · `javspider_stack` · `jellyfin-jav-scraper`  
> MDCS 落地：`apps/server/src/scrape/providers/catalog.ts`（UI T1）+ `sourceMaster.ts`（全量）+ 各 Provider

---

## 1. 连接方式（access）速查

| access | 含义 | 网络栈 | 典型超时 | 八项目共识 |
|--------|------|--------|----------|------------|
| **proxy** | 经全局代理 HTTP(S)，**不**默认回落 Flare | undici / curl | ~18s | 色花/MDCS 默认；JavSP 用 requests+代理；javbus-api 自建代理 |
| **proxy_flare** | 强制 FlareSolverr（须注入 scrape 代理） | FS 浏览器 → HTML | ~36s | javdb / javlibrary / avsox / fc2_hub 等 CF 站 |
| **proxy_adaptive** | curl → 短 Node → Flare，可复用 clearance | 三连 | ~36–42s | airav 系 / mgstage / sevenmmtv / avbase |
| **api** | 无 HTML 详情页，REST/GraphQL + Key | undici POST/GET JSON | ~15s | theporndb、dmm（MDCX 新路线） |

**硬规则（八项目最优交集）**

1. 测通与刮削 **同 access、同 Cookie、同代理**。  
2. Flare 请求带 `proxy:{url}`；调 FS HTTP API 直连。  
3. API 源勿只打营销首页（DMM 用 GraphQL，TPDB 用带 Key 搜索）。  
4. HTML 源认 CF 挑战页，HTTP 200 不算通。

---

## 2. 逐源规格（MDCS 24 源）

图例：**取数** = 最优取数路径；**八项目** = 谁有实现（●=有，○=薄/仅部分字段，—=无）

### AV 组

| id | 连接 | 怎么取数 | Cookie/特殊 | 八项目 | MDCS |
|----|------|----------|-------------|--------|-------|
| **javbus** | proxy | `GET {base}/{CODE}` → regex 标题/封面/女优 + cheerio 片商标签 | `existmag=all; age=verified; dv=1`；镜像缓存 + 备用 seejav | 色花● mdcx● JavSP● javbus-api●(REST) jellyfin● | ✅ |
| **javdb** | proxy_flare | 搜索 `/search?q=` 或直链 `/v/{id}` → 详情 HTML；mdcx 另有 **App API** `/api/v2/search` | `over18=1; locale=zh`；CD 10s | 色花● mdcx●(web+app) JavSP● jellyfin● | ✅ |
| **dmm** | proxy + **api** | **最优**：`POST api.video.dmm.co.jp/graphql` → `ppvContent(id)`（MDCX/MDCS）；封面 `pics.dmm.co.jp/.../pl.jpg` | 年龄 Cookie 对 SPA 首页无效；CID 由番号猜测 | 色花●(旧HTML) mdcx●(GQL) JavSP●(fanza HTML) | ✅ GQL |
| **libredmm** | proxy | `GET /movies/{CODE}.json` 轮询；失败则 `/search.json?q=` | 无；JSON 直出 | 色花● mdcx● MDCS 独有 | ✅ |
| **airav** | proxy_adaptive | `airav.wiki` 搜索 → 详情 HTML | CF 自适应 | 色花● JavSP●(airav) | stub |
| **airav_io** | proxy_adaptive | 镜像 `airav.io/cn` 搜索 → `/video?hid=`；跟跳转写镜像缓存 | 需代理；官方常 403 | 色花● | ✅ |
| **avsox** | proxy_flare | `/cn/search/{code}` → 详情（avmoo 系 HTML） | CF | 色花● JavSP●(avsox) | ✅ |
| **avmoo** | proxy_flare | 同 avsox 家族 | CF | 色花● JavSP● | stub |
| **jav321** | proxy | `POST /search`（form）→ 302 跟到详情；panel-info / og 元数据 | 须 `redirect:follow` | 色花● JavSP●(jav321) | ✅ |
| **javlibrary** | proxy_flare | `/cn/vl_searchbyid.php?keyword=` → 详情 `#video_title` | 强依赖 Flare | 色花● mdcx● JavSP●(javlib) | stub |
| **miss_av** | proxy_flare | missav 域名搜索 → 详情；mdcx 有 **MissAV API** | 域名易变 | 色花● mdcx●(web+api) | stub |
| **avbase** | proxy_adaptive | avbase.net 搜索 HTML | 自适应 | 色花● | stub |
| **mgstage** | proxy_adaptive | mgstage 详情 HTML + `adc=1` Cookie | CloudFront 看出口 | 色花● JavSP●(mgstage) mdcx● | stub |
| **carib** | proxy | `caribbeancom.com` 番号路径 HTML | 无码番号格式 | 色花● JavSP● | ✅ |

### FC2 组

| id | 连接 | 怎么取数 | Cookie/特殊 | 八项目 | MDCS |
|----|------|----------|-------------|--------|-------|
| **fc2_hub** | proxy_flare | javten.com 搜索 FC2-PPV-{id} | CF 403 看出口 | 色花● | ✅ |
| **fc2** | proxy | `adult.contents.fc2.com/article/{id}/` | `adult_check=1` | 色花● JavSP●(fc2) | ✅ |
| **fd2ppv** | proxy_flare | fd2ppv.cc 搜索 HTML | CF | 色花● JavSP●(fc2ppvdb 类似) | ✅ |

### 国产组

| id | 连接 | 怎么取数 | Cookie/特殊 | 八项目 | MDCS |
|----|------|----------|-------------|--------|-------|
| **madou** | proxy | madou.club 搜索 → 详情 | — | 色花● mdcx●(mdtv 系) | ✅ |
| **madouqu** | proxy | madouqu.com 搜索 → 详情 | — | 色花● mdcx● | ✅ |

### 备选组

| id | 连接 | 怎么取数 | Cookie/特殊 | 八项目 | MDCS |
|----|------|----------|-------------|--------|-------|
| **freejavbt** | proxy | 详情 HTML；封面只认 URL 含番号的 DMM/javbus 链 | 不用 og 播放器截帧 | 色花● | ✅ |
| **sevenmmtv** | proxy_adaptive | 7mmtv.sx 搜索 HTML | curl 常优 | 色花● mdcx●(mmtv) | stub |
| **iqqtv** | proxy | `{base}/cn/search.php?kw=` → 详情；中文标题/简介 | 镜像 iqq5.xyz | 色花●(曾 direct) | ✅ |
| **theporndb** | proxy + **api** | `GET api.theporndb.net/jav?q=` Bearer Key | 弹窗填 Key | 色花● mdcx● | ✅ |
| **xiao_huang_shu** | proxy | xchina.co 搜索 HTML | — | 色花● | stub |

---

## 3. 取数模式分类（八项目怎么选）

| 模式 | 适用源 | 代表实现 | 何时优先 |
|------|--------|----------|----------|
| **A. 直链详情 HTML** | javbus, carib, fc2 | 色花 regex+cheerio；JavSP `resp2html` | 有稳定 `/{code}` 且无 CF |
| **B. 搜索 → 详情 HTML** | javdb, javlibrary, airav_io, madou* | 色花 fetchPage 串行 | 需消歧或多结果 |
| **C. POST 表单 → 重定向** | jav321 | MDCS `fetchPostForm` + follow | 站点只接受 POST 搜索 |
| **D. JSON REST** | libredmm, theporndb | 直接 parse JSON | 有公开 JSON/API |
| **E. GraphQL** | **dmm** | MDCX `dmm_new` / MDCS `dmm.ts` | SPA 详情、HTML 年龄门失效 |
| **F. 自适应三连** | airav*, mgstage, avbase, sevenmmtv | 色花 fetchPage curl→Node→Flare | TLS/CF 不稳定 |
| **G. 自建 API 网关** | javbus（可选） | javbus-api 代理转发+解析 | 多客户端复用、隔离 CF |

**MDCS 默认**：A/B/C 走 `fetchText`→`fetchPage`；D/E 走 undici；F 走 `proxy_adaptive`；G 不内置（可将来接 javbus-api URL）。

---

## 4. 八项目分工（避免重复造轮）

| 项目 | 角色 | 借鉴什么 |
|------|------|----------|
| **sehua-next-web** | **引擎主参考** | access 定义、fetchPage、Provider 全集、镜像、串行测通 |
| **mdcx-diy** | **单站深挖** | DMM GraphQL、javdb App API、network_check 样例番号、CF bypass |
| **JavSP** | **识别+多源 fallback** | fanza 搜索 CID、各站 xpath 字段、CrawlerID 枚举 |
| **JavSP-Web** | JavSP 壳 | 同 JavSP |
| **javinizer-go** | Go 版刮削器 | 源优先级、整理/NFO 思路（非网络层） |
| **javbus-api** | **JavBus 专用网关** | 代理配置、REST 化 javbus（仅 javbus） |
| **javspider_stack** | 磁力栈 | **非**元数据源，不测通/不刮削 |
| **jellyfin-jav-scraper** | 插件形态 | javbus/javdb 简单 HTML 刮削（薄） |

---

## 5. MDCS 实施对照（当前 vs 最优）

| 能力 | 八项目最优 | MDCS 现状 |
|------|------------|------------|
| access 四档 | ✅ 色花 | ✅ catalog |
| fetchPage 三连 | ✅ 色花 | ✅ download.ts |
| DMM GraphQL | ✅ MDCX | ✅ dmm.ts + probe |
| TPDB API Key | ✅ mdcx | ✅ 弹窗 + probe |
| javdb App API | ✅ mdcx | ❌ 未接（仅 HTML+Flare） |
| javbus-api 网关 | 可选 | ❌ 未接 |
| L2 深度测通（样例番号） | ✅ mdcx | ❌ 待 UI |
| 全源 Provider | 色花最全 | 16/24 已实现 |

---

## 6. 单源快速卡片（复制用）

### javbus
- **连接**：proxy + 年龄 Cookie  
- **取数**：`GET /{CODE}` HTML  
- **测通**：同 URL，非挑战页  
- **参考**：sehua `javbus.ts`、javbus-api REST  

### javdb
- **连接**：proxy_flare（出口敏感）  
- **取数**：搜索/详情 HTML；进阶 mdcx App API  
- **测通**：Flare + 代理  

### dmm
- **连接**：proxy  
- **取数**：`POST api.video.dmm.co.jp/graphql` + CID=`sone00001` 类  
- **测通**：GraphQL 轻量 query，**不要**只打 dmm.co.jp 首页  

### libredmm
- **连接**：proxy  
- **取数**：`/movies/{CODE}.json`  
- **测通**：JSON 200  

### theporndb
- **连接**：proxy + Bearer API Key  
- **取数**：`/jav?q=`  
- **测通**：带 Key 搜索 1 条  

（其余源见 §2 表格。）

---

## 7. 相关文档

- 测通规格：[SOURCE-PROBE.md](./SOURCE-PROBE.md)  
- 引擎设计：[DESIGN.md](./DESIGN.md) §10  
- Cursor Skill：`~/.cursor/skills/source-probe/SKILL.md`
