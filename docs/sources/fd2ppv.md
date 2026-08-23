# FC2-PPV（fd2ppv）— 测试记录

> UI 卡片顺序：**#3 FC2 组**  
> 最后实测：2026-08-22 15:24 (UTC+8)（字段缺口清单）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `fd2ppv` |
| 分组 | FC2 |
| 连接方式 | `proxy_flare` |
| 默认 URL | https://fd2ppv.cc |
| Provider | `apps/server/src/scrape/providers/fd2ppv.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | FlareSolverr |
| 取数 | 详情页 `/articles/{id}` 或站点等价路径 |
| 封面 | 第三方图床（如 `xximgs.cc`） |
| 八项目参考 | 色花 |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `fc2` |
| 番号 | **FC2-PPV-3275049** |
| 索引 strm | `media/本地索引/FC2/未分类/FC2PPV/FC2-PPV-3275049.strm` |

```powershell
npx tsx scripts/e2e-sone-source.ts --id=fd2ppv
npx tsx scripts/probe-one.ts fd2ppv
```

---

## 刮削（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **~71s**（Flare） |
| 标题 | えりかちゃん初ごっくん！…（与 fc2_hub 一致） |
| 片商 | FC2 |
| 演员 | えりか, 素人, …（标签式解析） |
| 封面 | ✅ `xximgs.cc/.../3275049.webp` 2927 bytes |

---

## 字段采集

单源 **FC2-PPV-3275049**，刮削 **10/30**。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, num, actor, studio, maker, poster, thumb, cover |
| ✗ 未采集 | plot, premiered, runtime, genre, rating 系列, trailer 等 |

---

## 端到端 E2E（2026-08-22）

| 步骤 | 结果 |
|------|------|
| 刮削 | ✅ ~71s |
| 封面 | ✅ |
| 转移 | ✅ hardlink |
| NFO | ✅ **11/11 必过** |
| 水印 | ✅ uncensored + face |

**报告**：`media/_e2e/fc2/FC2-PPV-3275049/_scrap/fd2ppv/organized/e2e-report.json`

---

## 综合结论

| 维度 | 评级 |
|------|------|
| E2E | ✅ **全通过** |
| 生产可用 | ✅ PPV 番号封面补充源；**fc2_hub 封面 404 时可替代** |

---

## 与 fc2_hub 对比（同番号 FC2-PPV-3275049）

| 项 | fc2_hub | fd2ppv |
|----|---------|--------|
| 耗时 | ~125s | ~71s |
| 封面 | ❌ 404 | ✅ webp |
| 字段 | 13/30 | 10/30 |
| premiered/runtime | ✅ | — |

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-22 | FC2-PPV-3275049 E2E 全过；10/30 字段 |
