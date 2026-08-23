# FC2 — 测试记录

> UI 卡片顺序：**#2 FC2 组**  
> 最后实测：2026-08-22 15:22 (UTC+8)（字段缺口清单）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `fc2` |
| 分组 | FC2 |
| 连接方式 | `proxy` |
| 默认 URL | https://adult.contents.fc2.com |
| Cookie | `adult_check=1` |
| Provider | `apps/server/src/scrape/providers/fc2.ts` |
| 实现状态 | ✅ 已实现 |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 全局代理 HTTP |
| 取数 | 官方 FC2 `article/{id}/` |
| 解析 | HTML meta + 详情块 |
| 封面 | `storage*.contents.fc2.com` sample 图 |
| 八项目参考 | 色花 · mdcx |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `fc2` |
| 番号 | **FC2-1545500**（非 PPV 编号） |
| 索引 strm | `media/本地索引/FC2/未分类/FC2/FC2-1545500.strm` |

```powershell
npx tsx scripts/e2e-sone-source.ts --id=fc2
npx tsx scripts/probe-one.ts fc2
```

---

## 刮削（2026-08-22）

| 项 | 结果 |
|----|------|
| 状态 | ✅ 通过 |
| 耗时 | **2613ms** |
| 标题 | 〈再撮OK！元妻〉【4K撮影】… |
| 片商 | ハメタロウ |
| 标签 | 人妻, ハメ撮り, 素人, 無修正, 巨乳, フェチ |
| 封面 | ✅ 8032 bytes |

---

## 字段采集

单源 **FC2-1545500**，刮削 **16/30**。

| 状态 | 字段 |
|------|------|
| ✓ 已采集 | title, num, plot, outline, premiered, studio, maker, tag, genre, poster, thumb, cover 等 |
| ✗ 未采集 | actor, runtime, rating 系列, series, trailer, website 等 |

---

## 端到端 E2E（2026-08-22）

| 步骤 | 结果 |
|------|------|
| 刮削 | ✅ 2.6s |
| 封面 | ✅ |
| 转移 | ✅ hardlink |
| NFO | ✅ **18/18 必过** |
| 水印 | ✅ **uncensored** + face crop |

**报告**：`media/_e2e/fc2/FC2-1545500/_scrap/fc2/organized/e2e-report.json`

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 测通/刮削/E2E | ✅ **全通过** |
| 生产可用 | ✅ FC2 非 PPV 官方源首选 |

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-22 | FC2-1545500 E2E 全过；16/30 字段 |
