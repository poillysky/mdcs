# MissAV（miss_av）

> 单站报告 · 2026-08-24 · SONE-001

## 分类与链接核验

| 项 | 参考/初稿 | **实测结论** |
|----|-----------|--------------|
| 分组 `group` | 播放聚合 | **`general` 综合** — 导航含有码/无码/国产，非单一片种 |
| `access` | `proxy_flare` | **`proxy_adaptive`** — 冷启动须 Flare；clearance 复用后 **curl 直链** |
| 样例 | SONE-001 | E2E 25/30 字段 · NFO 27/27 必过项（除 poster/thumb 依赖封面文件） |

### 测通日志

```
冷启动 probe: probeVia=flare · ~5.2s
复用 probe:   probeVia=curl  · ~0.5s
E2E 刮削:     curl-ok missav123.com 248923b · ~5s
```

### access 判据

- 首次 `/cn/sone-001`：cookie-direct **403** → Flare 拿到 clearance
- 同会话第二次：curl 直链 **200**，无需再开 Flare
- 故标 **adaptive**，不是「每次强制 flare」

## MDCX 对齐

- 模块：`missav`（Web HTML；另有 missav_api 通道已合并规划，未单独实现）
- 路径：`/cn/{code}` 或 `/cn/search/{code}` → 详情 `/dm*/cn/{code}`
- 字段：中文 title/plot、女优、类型、片商、系列、导演、发行日、时长、封面

## 取数路径

1. `prepareProviderFetch` → 镜像/冷却/UI 参数
2. 直链 `${base}/cn/{sone001|sone-001}`
3. 失败则 `/cn/search/{CODE}` → `pickMissAvDetailHref`（排除 uncensored-leak 变体）
4. 解析 `og:*` + 详情区 `div.space-y-2`（女优/类型/片商…）

## 封面

- URL：`https://fourhoi.com/{code}/cover-n.jpg`（og:image）
- 下载须 **Referer = MissAV 详情页**（非 fourhoi origin）；已在 `imageReferer.ts` 映射
- 本环境 curl + Referer → **~151KB** 可下

## 限制

- 域名易变（missav123.com / missav.ws …），用 UI `baseUrl` + 镜像缓存
- 无评分/预告/剧照列表
- 无码泄漏版 URL 带 `-uncensored-leak` 后缀，搜索时 deliberately 降权

## 测试命令

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/miss_av.test.ts
npx tsx scripts/_missav-probe-test.ts
npx tsx scripts/e2e-sone-source.ts --id=miss_av
```

## E2E 输出

`media/片商目录/日本有码/SONE/SONE-001/_scrap/miss_av/organized/`

Fixture：`data/_debug/missav-detail-sone001.html`、`missav-search-SONE-001.html`
