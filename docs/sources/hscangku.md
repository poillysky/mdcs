# 黄色仓库（hscangku）— 测试记录

> UI 卡片：`Hscangku` / 黄色仓库  
> 最后实测：2026-08-24（单源 `baseUrl: https://556822.xyz` + `proxyUrl: "null"` 直连 + E2E 全通过）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `hscangku` |
| 分组 | `chinese` |
| 连接方式 | `proxy_adaptive`（catalog 策略）；**本源实测使用单源无代理 + 活镜像** |
| 默认 URL | http://hsck.net（门户跳转页） |
| 实测基址 | **https://556822.xyz**（写入 `providerSettings.hscangku.baseUrl`） |
| Provider | `apps/server/src/scrape/providers/hscangku.ts` |
| 实现状态 | ✅ 已实现 |
| MDCX | `hscangku`（`mdcx/crawlers/hscangku.py`） |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 自适应；本次实测 **curl 直连**（`proxy=off` · `probeVia: curl` · `clearance-curl-ok`） |
| 门户 | `hsck.net` 常为 JS 跳转页；正文在 `var strU="https://XXXX.space:8899/?u="+window.location...` 再 302 到活镜像 |
| 搜索 | `{mirror}/vodsearch/-------------.html?wd={番号}` |
| 详情 | `/v5/{id}-1-1.html` 或 `/vodplay/{id}-1-1.html`（**禁止**把 `/vodsearch/...` 当详情） |
| 解析 | 标题 `h3.title`；封面优先搜索卡 `data-original`，详情页 `img` 常为广告 GIF |
| 封面 | 搜索卡直链可下；需继承源级 `proxyUrlOverride` |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `china` |
| 番号（推荐） | **MDX-0006** |
| 索引 strm | `media/本地索引/国产无码/麻豆传媒/MDX/MDX-0001.strm` |

```powershell
cd e:\Mdcs\apps\server
node --import tsx --test src/scrape/providers/hscangku.test.ts
npx tsx scripts/probe-one.ts hscangku
npx tsx scripts/e2e-sone-source.ts --id=hscangku
```

---

## L1 / 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| L1 单测 | ✅ 3/3 |
| 测通 | ✅ `probeVia: curl` |
| 代理状态 | ✅ 单源 `proxyUrl: "null"` 后日志 `proxy=off` |

---

## Live / E2E — MDX-0006（2026-08-24）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | `ok=true source=hscangku` |
| 2. 封面 | ✅ | `data/covers/china/MDX-0006.jpg` · **25546** bytes（`tukaka.space` 搜索卡图） |
| 3. 转移 | ✅ | skip/hardlink 正常 |
| 4. 海报/水印 | ✅ | `poster.jpg` / `thumb.jpg` 已生成 |
| 5. NFO | ✅ | 已采集项 **9/9** 全通过 |

**典型字段**：title=`外送小姨子` · website=详情页 · cover  
**站空/未采**：plot、actor、studio、premiered、director、runtime、rating、series、genre、trailer（源站详情几乎只有标题+封面）

---

## 分类与链接核验

| 项 | 参考/初稿 | 实测 | 最终 catalog |
|----|-----------|------|--------------|
| UI 分组 | 国产 | 主打国产点播/麻豆类番号 | `group=chinese` |
| access | `proxy_adaptive` | `probeVia=curl` · 直连镜像稳定 | `access=proxy_adaptive`（不必 `proxy_flare`） |
| 差异说明 | 默认 `hsck.net` | 门户 404/跳转页；活镜像需写 `baseUrl` | `notes` 用配置覆盖 |

---

## 本次修复

| 项 | 说明 |
|----|------|
| 详情 href 过滤 | 仅接受 `/v5/{id}-1-1.html` 或 `/vodplay/{id}-1-1.html`，避免把搜索分页当详情 |
| 门户网关 | 解析 `strU` JS，跟随 302 到活镜像 |
| 单源配置 | `baseUrl: https://556822.xyz` · `proxyUrl: "null"`（全局代理对该源会 404/不稳） |
| 封面 | 优先搜索卡 `data-original`，避免详情页广告 GIF |

---

## 结论

生产可用：**✅**（须配置当前活镜像与直连；`hsck.net` 本身不能当业务基址）
