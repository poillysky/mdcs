# NJAV（njav / 123AV）

> 单站报告 · 2026-08-24 · SONE-001

## 分类与链接核验

| 项 | 参考/初稿 | **实测结论** |
|----|-----------|--------------|
| 分组 `group` | JavSP 补充源 | **`general` 综合** — 123AV 含 censored/uncensored/FC2/amateur |
| `access` | `proxy_flare` | **`proxy_adaptive`** — 冷启动 Flare；clearance 后 **curl ~0.9s** |
| 域名 | njav.tv/ja | **已迁移 123av.com/ja**（njav.tv 搜索页仅显示迁移提示） |

### 测通日志

```
probe: probeVia=curl · ~907ms · https://123av.com/ja/v/sone-001
E2E:   搜索 flare → 详情 curl · ~5.9s
封面:  icdn.123av.me · ~59KB · Referer=详情页
```

## 八项目对照

| 项 | JavSP `njav.py` | MDCS |
|----|-----------------|------|
| 爬虫 | ✅ `references/JavSP/javsp/web/njav.py` | ✅ `njav.ts` |
| 基址 | `https://njav.tv/ja` | **`https://123av.com/ja`**（实测迁移） |
| 取数 | `/search?keyword={dvdid}` → 详情 | 同；搜索挑 `/ja/v/{slug}` |
| 解析 | 旧 DOM：`detail-item` / `#player data-poster` | **新 DOM**：`watch__info-row` + icdn 封面 |
| MDCX | 无独立 njav 爬虫 | — |

## 取数路径

1. `prepareProviderFetch` → 镜像/冷却/UI 参数
2. `${base}/search?keyword={SONE-001}`（JavSP 对齐）
3. `pickNjavDetailHref` — 优先有码正片，排除 `-uncensored-leaked`
4. 解析 `h1.watch__title` + `div.watch__info-row`（コード/出演者/ジャンル/メーカー…）
5. 封面：HTML 内 `icdn.123av.me/.../cover.jpg`（非 og:image）

## 封面

- CDN：`https://icdn.123av.me/img2/s500/.../cover.jpg`
- Referer = 123AV 详情页；`imageReferer.ts` 已映射

## 限制

- **njav.tv 已废弃**，勿再作 defaultUrl
- 无 plot/rating/trailer/剧照
- 标题为日文（非中文）

## 测试命令

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/njav.test.ts
npx tsx scripts/probe-one.ts njav
npx tsx scripts/e2e-sone-source.ts --id=njav
```

## E2E 结果（SONE-001）

| 环节 | 结果 |
|------|------|
| L1 单测 | ✅ 5/5 |
| 测通 | ✅ ~907ms · curl |
| E2E 刮削 | ✅ 19/30 字段 |
| 封面 | ✅ ~59KB |
| NFO | ✅ 21/21 必过 |

输出：`media/片商目录/日本有码/SONE/SONE-001/_scrap/njav/organized/`

Fixture：`data/_debug/njav-search-SONE-001.html`、`njav-detail-sone001.html`
