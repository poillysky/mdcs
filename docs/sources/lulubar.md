# LuluBar — 测试记录

> UI 卡片顺序：**综合组**（LuluBar · 自适应）  
> 最后实测：2026-08-24

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `lulubar` |
| 分组 | **`general`**（日/无/国产聚合） |
| 连接方式 | **`proxy_adaptive`** |
| 默认 URL | https://lulubar.co |
| Provider | `apps/server/src/scrape/providers/lulubar.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 搜索 | `/video/bysearch?search={code}` |
| 详情 | `/video/detail?id=` |
| 封面 | CDN 须单独 Flare clearance（`downloadLulubarCdnImage`） |
| 八项目参考 | MDCX lulubar |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | japan_censored |
| 番号 | **SONE-001** |
| 索引 strm | `media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm` |

```powershell
npx tsx --test src/scrape/providers/lulubar.test.ts
npx tsx scripts/e2e-sone-source.ts --id=lulubar
```

---

## 端到端 E2E（SONE-001 · 2026-08-24）

| 步骤 | 结果 |
|------|------|
| 刮削 | ✅ |
| 封面 | ✅ ~121KB |
| NFO | ✅ **20/20** 必过 |

**输出**：`media/片商目录/日本有码/SONE/SONE-001/_scrap/lulubar/organized/`

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 生产可用 | ✅ 综合聚合补充源 |

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-24 | 分组改为 general · E2E SONE-001 ✅ |
