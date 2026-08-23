# 数据源测试记录（逐源）

按 UI **数据源卡片顺序**，每测完一个源写一份文档。

| # | 源 | 文档 | E2E | 更新 |
|---|-----|------|-----|------|
| 1 | **JavBus** | [javbus.md](./javbus.md) | ✅ | 2026-08-23 |
| 2 | **DMM** | [dmm.md](./dmm.md) | ✅ | 2026-08-22 |
| 3 | **LibreDMM** | [libredmm.md](./libredmm.md) | ✅ | 2026-08-22 |
| 4 | **Jav321** | [jav321.md](./jav321.md) | ✅ | 2026-08-22 |
| 5 | **Caribbean** | [carib.md](./carib.md) | ✅ | 2026-08-22 |
| 6 | **FC2 Hub** | [fc2_hub.md](./fc2_hub.md) | ⚠️ | 2026-08-22 |
| 7 | **FC2** | [fc2.md](./fc2.md) | ✅ | 2026-08-22 |
| 8 | **FC2-PPV** | [fd2ppv.md](./fd2ppv.md) | ✅ | 2026-08-22 |
| — | **AVSex** (T2) | [avsex.md](./avsex.md) | ⚠️ 封面403 | 2026-08-22 |
| — | **iQQTV** | [iqqtv.md](./iqqtv.md) | ✅ | 2026-08-23 |
| … | 见 [SOURCE-E2E-TEST-LOG.md](../SOURCE-E2E-TEST-LOG.md) | | | |

**命令**

```powershell
cd e:\MDCS\apps\server
npx tsx scripts/e2e-sone-source.ts --id=javbus
npx tsx scripts/e2e-sone-source.ts --list
```

**汇总表**：[SOURCE-E2E-TEST-LOG.md](../SOURCE-E2E-TEST-LOG.md) · **逐站规范**：[SOURCE-SINGLE-SITE-TEST.md](../SOURCE-SINGLE-SITE-TEST.md) · **全站点**：[SOURCE-MASTER-LIST.md](../SOURCE-MASTER-LIST.md) · **连接/取数**：[SOURCE-CATALOG-8REF.md](../SOURCE-CATALOG-8REF.md) · **测试策略**：[SOURCE-TEST-STRATEGY.md](../SOURCE-TEST-STRATEGY.md)
