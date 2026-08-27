# AVHeat — 测试记录

> UI 卡片顺序：**欧美组 #2**（AVHeat · 过盾）  
> 最后实测：2026-08-24 21:55 (UTC+8)

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `avheat` |
| 分组 | **`western`**（欧美 AIO 目录） |
| 连接方式 | **`proxy_flare`** |
| 默认 URL | https://avheat.shop |
| Provider | `apps/server/src/scrape/providers/avheat.ts` |
| 实现状态 | ✅ 已实现（AIO SPA · **wav** namespace，与 Avmoo/AvSox 同族） |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | **强制 FlareSolverr**（Quasar SPA；curl 仅 ~1.5KB 空壳） |
| 搜索 | `GET /cn/search/{query}` → `movie-card` + `movie-meta` 挑详情 |
| 详情 | `/cn/movies/{slug}` · `detail-label` / `detail-value` DOM |
| 识别码 | 站点格式 **`Series.YY.MM.DD`**（例 `WeLiveTogether.12.02.23` = 2012-02-23） |
| 封面 | `file.netcdn.space/storage/{studio}/movies/...` |
| 八项目参考 | MDCX `avheat.py` · AIO `window.__AIO_SITE_URLS__.wav` |

### 番号 / 搜索注意

| 输入 | AVHeat 搜索 |
|------|-------------|
| `WeLiveTogether.12.02.23` | ✅ 站点原生识别码，直接命中 |
| `Office Play` | ✅ 片名可搜（E2E 样例场景标题） |
| `RK.2012.02.23` | ❌ 本地欧美命名，站内无结果 |
| `WLT.2012.02.23` | ✅ Provider 映射为 `WeLiveTogether.12.02.23` |
| `PURETABOO.2026.07.14` | ❌ 索引稀疏，未命中 |

Provider 内 `avheatSearchQueries()` 展开站点 ID、日期与已知系列映射；`pickAvheatMoviePath()` 支持按 `movie-meta` 日期回退。

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | **`western`** |
| 番号 | **WeLiveTogether.12.02.23** |
| 索引 strm | `media/_e2e/western/WeLiveTogether/WeLiveTogether.12.02.23.strm` |

```powershell
cd apps/server
node --import tsx --test src/scrape/providers/avheat.test.ts
npx tsx scripts/e2e-sone-source.ts --id=avheat
```

Fixture dump：`apps/server/scripts/_avheat-dump/detail_office_play.html`

---

## L1 单测（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ **8/8** |
| 覆盖 | 搜索词 · 识别码匹配 · movie-meta 挑链 · 详情解析 · live dump |

---

## 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~13–16s**（`probePath: /cn`，Flare wait=5s） |
| HTTP | 200 |
| 通道 | **`probeVia: flare`** |
| URL | `https://avheat.shop/cn` |

---

## Live 刮削（2026-08-24）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~30s**（搜索+详情各一轮 Flare，wait=5s；含 session 重试） |
| 标题 | Office Play |
| 片商 | RealityKings |
| 系列 | WeLiveTogether |
| 演员 | Spencer Scott, Dani Daniels, Sammie Rhodes |
| 类型 | 彩色丝袜, 高加索人, 办公室, FFM, … |
| 发行日 | 2012-02-23 |
| 封面 | `file.netcdn.space/.../WeLiveTogether/12.02.23/b_00.jpg` |

---

## 字段采集（Live · WeLiveTogether.12.02.23）

约 **18/30**（+website；无 plot/runtime；时长字段为 `-`）。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, actor, genre, series, studio, maker, premiered, releasedate, release, cover, poster/thumb, website |
| ✗ 未采集 | plot, director, runtime, rating 系列, publisher, label, trailer |
| ○ 生成器推导 | uniqueid, source, tagline, countrycode, mpaa, customrating, year, fanart |

---

## 端到端 E2E（2026-08-24）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | flare ~30s（偶发 session 重试后成功） |
| 2. 封面下载 | ✅ | 126236 bytes · netcdn 直连 |
| 3. 整理计划 | ✅ | western kind |
| 4. 文件转移 | ✅ | skip |
| 5. 海报 | ✅ | 196045 bytes |
| 6. 剧照 | ✅ | extrafanart ×6 |
| 7. NFO | ✅ | 已采集项 **20/20 必过** |

**输出目录**

```
media/_e2e/western/WeLiveTogether.12.02.23/_scrap/avheat/organized/
```

---

## 综合结论

| 维度 | 评级 |
|------|------|
| L1 单测 | ✅ 8/8 |
| 测通 | ✅ flare |
| Live 刮削 | ✅ |
| 端到端 | ✅ **全项通过** |
| 生产可用 | ✅ 欧美 meta/封面补充源；**优先站点识别码 `Series.YY.MM.DD`** |

---

## 已知问题

- **索引覆盖有限**：Pure Taboo 等片在站内可能无结果，ThePornDB 更全。
- **本地命名 `STUDIO.YYYY.MM.DD`**：除已知映射（如 WLT→WeLiveTogether）外须手填站点 ID 或片名搜索。
- **Flare 路径**：`waitInSeconds>0` 的 AIO SPA 已跳过 clearance-curl 与 session 复用，直接 `flare fresh`（2026-08-24 网络层优化）
- **单条耗时**：E2E 约 **~60s**（搜索+详情各一轮 Flare wait=5s）

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-24 | 网络层：SPA wait 跳过 curl/session 复用，E2E ~60s，无 session 重试噪音 |
| 2026-08-24 | 首版落地：对齐 Avmoo/AvSox AIO · `avheatSearchQueries` · E2E WeLiveTogether.12.02.23 ✅ |
