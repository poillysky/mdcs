# 小黄书（xiao_huang_shu）— 测试记录

> UI 卡片：`Xiao_huang_shu` / 小黄书  
> 最后实测：2026-08-24（单源 `proxyUrl: "null"` 直连 + E2E 全通过）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `xiao_huang_shu` |
| 分组 | `chinese` |
| 连接方式 | `proxy_adaptive`（catalog）；**本源须单源无代理**，全局代理对站点/图床均 403 |
| 默认 URL | https://xchina.co |
| Provider | `apps/server/src/scrape/providers/xiao_huang_shu.ts` |
| 实现状态 | ✅ 已实现 |
| MDCX | 无对应 crawler（色花 HTML 搜索；本仓新建） |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 自适应；本次 **curl-impersonate 直连**（`proxy=off` · `probeVia: curl`） |
| 搜索 | `/search.html?keyword={番号}`；备用 `/videos/keyword-{番号}.html` |
| 详情 | `/video/id-{hex}.html`（**须 Referer**，否则 403） |
| 解析 | 搜索卡 `.item.video`；详情 JSON-LD `VideoObject`（标题/演员/时长/发行日/封面） |
| 封面 | `upload.xchina.io`；须 **curl 直连 + Referer=xchina.co**，undici/代理会 403 |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `china` |
| 番号（推荐） | **MDX-0006**（站内标签 `MDX0006`） |
| 索引 strm | `media/本地索引/国产无码/麻豆传媒/MDX/MDX-0001.strm` |

```powershell
cd e:\Mdcs\apps\server
node --import tsx --test src/scrape/providers/xiao_huang_shu.test.ts
npx tsx scripts/probe-one.ts xiao_huang_shu
npx tsx scripts/e2e-sone-source.ts --id=xiao_huang_shu
```

---

## L1 / 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| L1 单测 | ✅ 3/3 |
| 测通 | ✅ `probeVia: curl` · ~553ms · HTTP 200 |
| 代理状态 | ✅ 单源 `proxyUrl: "null"` 后日志 `proxy=off` |

---

## Live / E2E — MDX-0006（2026-08-24）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | `ok=true source=xiao_huang_shu` |
| 2. 封面 | ✅ | `data/covers/china/MDX-0006.webp` · **53934** bytes |
| 3. 转移 | ✅ | skip/hardlink 正常 |
| 4. 海报/水印 | ✅ | `poster.webp` / `thumb.jpg` 已生成 |
| 5. NFO | ✅ | 已采集项 **17/17** 全通过 |

**典型字段**：title=`外送小姨子` · actor=`张芸熙` · studio=`麻豆官方` · premiered=`2023-04-08` · runtime · website · cover  
**站空/未采**：plot、outline、director、rating、series、genre、trailer（源站无剧情简介）

---

## 分类与链接核验

| 项 | 参考/初稿 | 实测 | 最终 catalog |
|----|-----------|------|--------------|
| UI 分组 | 国产 | 首页/样例均为华语影片+套图；非日/无/国产混聚合 | `group=chinese` |
| access | `proxy_adaptive` | `probeVia=curl` · 刮削 `curl-ok proxy=off` | `access=proxy_adaptive`（不必 `proxy_flare`） |
| 差异说明 | 文档曾写走代理 | 本环境代理对 `xchina.co` / `upload.xchina.io` **403** | 卡片 `proxyUrl=null` |

---

## 本次修复

| 项 | 说明 |
|----|------|
| 新建 Provider | 搜索卡 + JSON-LD 详情；详情请求带搜索 Referer |
| 单源直连 | `config/scrape.json`：`providerSettings.xiao_huang_shu.proxyUrl = "null"` |
| 封面 | `isXchinaCdnUrl` → curl `direct:true` + Referer `https://xchina.co/` |
| E2E 样例 | fixture `code` 用 **MDX-0006**（与 strm 文件名 MDX-0001 分离） |

---

## 结论

生产可用：**✅**（必须单源直连 + curl-impersonate；走全局代理会整站 403）
