# ThePornDB — 测试记录

> UI 卡片顺序：**欧美组 #1**（ThePornDB · 自适应）  
> 最后实测：2026-08-24

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `theporndb` |
| 分组 | **`western`**（REST · 亦支持 JAV 番号） |
| 连接方式 | **`proxy_adaptive`** |
| UI 主站 | https://theporndb.net |
| API | https://api.theporndb.net（内部固定） |
| Provider | `apps/server/src/scrape/providers/theporndb.ts` |
| 实现状态 | ✅ 已实现 · **需 API Key**（`scrape.json` → `theporndbApiKey`） |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | REST JSON · 免 HTML 解析 |
| JAV 搜索 | `/jav?q=` |
| 欧美搜索 | `/scenes?parse=` + `/movies?parse=` 回退 |
| 本地命名 | `STUDIO.YYYY.MM.DD` → `Pure Taboo 2026-07-14` 等展开 |
| 八项目参考 | MDCX `theporndb.py` |

---

## 测试样例

| 场景 | Kind | 番号 | strm |
|------|------|------|------|
| 欧美 E2E（默认 fixture） | western | **PURETABOO.2026.07.14** | `media/_e2e/western/PURETABOO/PURETABOO.2026.07.14.strm` |
| 日番 E2E | japan_censored | SONE-001 | `--strm=media/本地索引/.../SONE-001.strm` |

```powershell
npx tsx --test src/scrape/providers/theporndb.test.ts
npx tsx scripts/e2e-sone-source.ts --id=theporndb
npx tsx scripts/e2e-sone-source.ts --id=theporndb --strm=media/本地索引/日本有码/S1 NO.1 STYLE/SONE/SONE-001.strm
```

---

## 端到端 E2E

| 样例 | 结果 |
|------|------|
| PURETABOO.2026.07.14 | ✅ NFO **20/20** |
| SONE-001（日番） | ✅ NFO **18/18** 必过 |

**输出**：`media/_e2e/western/PURETABOO.2026.07.14/_scrap/theporndb/organized/`

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 生产可用 | ✅ 欧美/JAV 元数据主源之一 |
| 前置条件 | 配置 **theporndbApiKey** |

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-24 | 欧美 `parse=` 搜索 · UI 改 theporndb.net · E2E fixture 改 western |
