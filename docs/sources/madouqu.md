# Madouqu（madouqu）— 测试记录

> UI 卡片：`Madouqu`  
> 最后实测：2026-08-24 16:54（单源 `proxyUrl: "null"` 直连 + E2E 全通过）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `madouqu` |
| 分组 | `chinese` |
| 连接方式 | `proxy_adaptive`（catalog 策略）；**本源实测使用单源无代理覆盖** |
| 默认 URL | https://madouqu.com |
| Provider | `apps/server/src/scrape/providers/madouqu.ts` |
| 实现状态 | ✅ 已实现 |
| MDCX | `madouqu` |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 自适应；本次实测为 **curl 直连**（`proxy=off`） |
| 搜索 | `/?s={番号}` |
| 详情 | `/video/{slug}/` |
| 解析 | 标题、`麻豆女郎`、分类、发布时间、OG 图/正文首图 |
| 封面 | 直链可下；需继承源级 `proxyUrlOverride`，否则会误走全局代理 |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `china` |
| 番号（推荐） | **MDX-0006** |
| 注意 | `MDX-0001` 在 `madouqu` 搜索虽 200，但详情直链 **404**，不适合作 E2E 样例 |
| 索引 strm | `media/本地索引/国产无码/麻豆传媒/MDX/MDX-0001.strm` |

```powershell
node --import tsx --test src/scrape/providers/madouqu.test.ts
npx tsx scripts/probe-one.ts madouqu
npx tsx scripts/e2e-sone-source.ts --id=madouqu
```

---

## L1 / 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| L1 单测 | 当前未补专属单测 |
| 测通 | ✅ `probeVia: curl` |
| 代理状态 | ✅ 单源 `proxyUrl: "null"` 后日志明确 `proxy=off` |

---

## Live / E2E — MDX-0006（2026-08-24）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | `ok=true source=madouqu tried=madouqu` |
| 2. 封面 | ✅ | `data/covers/china/MDX-0006.jpg` · **85453** bytes |
| 3. 转移 | ✅ | skip/hardlink 正常 |
| 4. 海报/水印 | ✅ | `poster.jpg` / `thumb.jpg` 已生成 |
| 5. NFO | ✅ | 已采集项 **15/15** 全通过 |

**典型字段**：title=`外送小姨子` · studio=`麻豆传媒` · actor=`张芸熙` · premiered=`2021-01-03` · cover  
**站空/未采**：plot、outline、director、runtime、rating、series、genre、trailer、website

---

## 本次修复

| 项 | 说明 |
|----|------|
| E2E fixture 取号 | 修正 `scripts/e2e-fixtures.ts`：优先使用 fixture 的 `code`，不再总被 `sourceRel` 文件名覆盖 |
| 单源直连 | `config/scrape.json` 为 `madouqu` 增加 `proxyUrl: "null"` |
| 封面下载 | 修正 `downloadCover()` → `fetchBuffer()`，让图片下载也继承源级 `proxyUrlOverride` |

---

## 已知问题

- `MDX-0001` 不适合作 `madouqu` E2E 样例：
  - 搜索页 200
  - `/video/mdx0001/` / `/video/mdx-0001/` 404
- `proxy_adaptive` 是 catalog 策略标签，不代表本次实际走代理；实际通道要看日志里的 `proxy=off/on` 与 `probeVia`

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 刮削 | ✅ |
| 端到端 | ✅ |
| 生产可用 | ✅ 直连场景可用；封面下载需保留源级无代理覆盖 |
