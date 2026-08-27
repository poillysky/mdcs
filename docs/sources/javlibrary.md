# JavLibrary — 测试记录

> UI 卡片顺序：**有码 AV 组 · #16**  
> 分组：`av`（仅日本有码）  
> 网络：`proxy_adaptive`（镜像站本环境须 Flare；官方站浏览器或可直接访问）  
> 最后实测：2026-08-24 (UTC+8)

---

## 2026-08-24 完整报告

### MDCX 对照

| 项 | MDCX | MDCS |
|----|------|------|
| 爬虫 | `javlibrary.py` | ✅ `javlibrary.ts` |
| 基址 | GitHub `javlibcom` 动态镜像 + f101w/c97k 回退 | `siteMirror` 种子 f101w/c97k/b47w |
| 取数 | JA 搜索 → 详情；可选 CN 补中文 | **CN 单次搜索**（对齐 JavSP）；单结果 301 / `div.video` 选详情 |
| 字段 | `#video_title` `#video_cast` `#video_genres` 等 | 同；评分 votes · 导演 · 发行商 |
| 片种 | 仅能有码 | `mosaic: 有码` |

### 根因与修复（本轮）

1. **探针卡死**：串行 5 域名 × curl/直连/Flare 55s → 改为只测 1 缓存镜像、Flare 优先，热 session ~4s
2. **详情链变更**：新镜像用 `./javmemberi.html`，非旧 `/?v=jav` → `pickJavlibraryDetailUrl` 支持 `div.video`
3. **三趟 Flare**：旧实现 JA+CN 三请求 → 改为 CN 搜索 + 最多 1 次详情

### 结果（SONE-001）

| 环节 | 结果 | 说明 |
|------|------|------|
| L1 单测 | ✅ **8/8** | 含 mirror 链接 fixture |
| 测通 | ✅ ~4.4s | `probeVia: flare` · 镜像 `f101w.com` |
| Live 刮削 | ✅ ~14s | 搜索 Flare ~4s + 详情 Flare ~2s |
| E2E | ✅ **26/26 必过** | 采集 24/30 · 封面 **142KB** · 无剧照 |

### 字段完整性

| 状态 | 字段 |
|------|------|
| ✅ 已采集 | title / actor / director / genre / studio / publisher / label / premiered / runtime / rating / votes / cover(DMM) / website |
| ✗ 站点无 | plot / series / set / trailer / extrafanart |
| 备注 | CN 页标题常为日文原名；无独立 synopsis |

### 分类与链接核验

| 项 | 参考/初稿 | 实测 | 最终 |
|----|-----------|------|------|
| UI 分组 | MDCX「仅能有码」 | 首页/搜索仅日本 AV 有码 meta | **`av` 有码** |
| access | 旧文档 `proxy_flare` | 镜像 curl/直连 403；测通+刮削均 `flare`；官方 `javlibrary.com` 浏览器可开 | **`proxy_adaptive`** |
| 说明 | 强制 Flare | 服务端镜像必过盾；用户本机官方站或直连时 adaptive 不锁死 Flare | `notes: 仅日本有码 · 镜像 CN 搜索` |

### 结论

**生产可用 ✅** — 有码组 meta/评分/封面（DMM 图）稳定；须 FlareSolverr 可达镜像域。登录 cookie 非必须（公开详情可刮）。

---

## 基本信息

| 项 | 值 |
|----|-----|
| ID | `javlibrary` |
| 默认 URL | https://www.javlibrary.com |
| 实测镜像 | https://www.f101w.com（`site-mirrors.json` 缓存） |
| UI 分组 | **有码 AV**（`av`） |
| access | `proxy_adaptive` |
| 样例番号 | SONE-001 |

## 浏览器 Cookie 直链试验（可选）

服务端镜像 `f101w` **即使有 `cf_clearance` 仍 403**，无法像 JavDay 那样 `cookie-direct`。

若本机浏览器已登录官方站，可尝试：

1. 浏览器打开 `https://www.javlibrary.com/cn/` → F12 → Network → 刷新 → 任选请求 → 复制 **Cookie** 请求头全文
2. 粘贴到 `config/scrape.json` → `providerSettings.javlibrary.cookie`
3. 确认 `baseUrl` 为 `https://www.javlibrary.com`
4. 验证：

```powershell
cd E:\Mdcs\apps\server
npx tsx scripts/_test-javlib-cookie-direct.ts
```

期望出现 `official-user-cookie` · `via: direct` · `ms < 1500`。若仍 403，说明 Cookie 与代理出口不匹配，继续用镜像 + Flare 即可。

---
