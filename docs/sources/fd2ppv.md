# FC2-PPV（fd2ppv）— 测试记录

> UI 卡片顺序：**#3 FC2 组**  
> 最后实测：2026-08-24 15:14（凭证 + curl-impersonate 直链 **clearance-curl-ok**）

---

## 基本信息

| 项 | 值 |
|----|-----|
| id | `fd2ppv` |
| 分组 | `fc2`（实测确认） |
| 连接方式 | `proxy_adaptive`（实测 `probeVia: curl`；**不必**强制 Flare） |
| 默认 URL | https://fd2ppv.cc |
| Provider | `apps/server/src/scrape/providers/fd2ppv.ts` |
| 实现状态 | ✅ 已实现 |
| MDCX | `fc2ppvdb`（现站多为 `fc2cmadb` Inertia；本仓对 **fd2ppv.cc HTML**） |

## 连接与取数

| 项 | 说明 |
|----|------|
| 通道 | 自适应：curl/代理优先；偶发 403 才回落 Flare |
| 取数 | 详情 **`/articles/{id}`**（站内有条目时）；搜索 `/?keyword=` / `/articles/?keyword=` |
| 解析 | work-brief 标题 · work-meta 配信日/时间/销售者 · `/actresses/{数字}` 演员 · `/tags/actresses/`→genre · work-photos/`xximgs` 封面 |
| 封面 | 第三方图床 `xximgs.cc`（webp 小图，可用） |
| 八项目参考 | mdcx fc2ppvdb（字段线索）· 实测以 fd2ppv.cc 为准 |

---

## 测试样例

| 项 | 值 |
|----|-----|
| Kind | `fc2` |
| 番号（推荐） | **FC2-PPV-3275049**（站内有详情） |
| 注意 | **FC2-PPV-4962908** 在 FD2 上 **404**（Hub 有 ≠ FD2 有） |
| 索引 strm | `media/本地索引/FC2/未分类/FC2PPV/FC2-PPV-3275049.strm` |

```powershell
npx tsx --test src/scrape/providers/fd2ppv.test.ts
npx tsx scripts/probe-one.ts fd2ppv
npx tsx scripts/e2e-sone-source.ts --id=fd2ppv
```

---

## L1 / 测通（2026-08-24）

| 项 | 结果 |
|----|------|
| L1 单测 | ✅ 2/2（演员与 actress-tag 分离） |
| 测通 | ✅ ~2s · **`probeVia: curl`** |
| access 核验 | 初稿 `proxy_flare` → 实测改为 **`proxy_adaptive`** |
| group 核验 | **`fc2`** |

---

## Live / E2E — FC2-PPV-3275049（2026-08-24）

| 步骤 | 结果 | 说明 |
|------|------|------|
| 1. 刮削 | ✅ | 冷启动无凭证：curl 403 → Flare；有 `cf_clearance` 后 **curl-impersonate 直链** |
| 2. 封面 | ✅ | `xximgs.cc/.../3275049.webp` · **2927** bytes |
| 3. 转移 | ✅ | skip/hardlink |
| 4. 海报/水印 | ✅ | poster/thumb · uncensored |
| 5. NFO | ✅ | 已采集项必过 |

**典型字段**：title · studio=`至高ぷれみあ！` · actor=`えりか` · genres（素人等）· premiered/runtime · website · cover  
**站空/未采**：plot、trailer、rating、series

### 凭证直链复测（2026-08-24 15:14）

| 项 | 结果 |
|----|------|
| 磁盘凭证 | `data/meta/cf-clearance.json` · `fd2ppv.cc` · 含 `cf_clearance` |
| 启动日志 | `loaded 1 cf-clearance host(s) from disk` |
| 通道 | **`clearance-curl`**（impersonate + cookie，非 Flare） |
| 结果 | **`clearance-curl-ok`** · **102403b** · **~1832ms** · title/cover/actor 齐 |

冷启动 E2E 未打出 `loaded … from disk`，当时内存/磁盘无有效凭证，故走 `curl-first`（无 cookie）→ 403 → Flare；过盾后立即落盘。有凭证后 **不会** 再空烧 Flare。

---

## 分类与链接核验

| 项 | 参考/初稿 | 实测 | 最终 catalog |
|----|-----------|------|--------------|
| UI 分组 | FC2 | 作品为 FC2-PPV 库 | `group=fc2` |
| access | `proxy_flare` | 首页/详情 curl 可达；用户确认不过盾 | `access=proxy_adaptive` |
| 差异说明 | 旧文档过盾 | 浏览器直开业务页；probe curl | notes 对齐 |

---

## 综合结论

| 维度 | 评级 |
|------|------|
| 刮削 | ✅ |
| 端到端 | ✅ |
| 生产可用 | ✅ 作 FC2-PPV **封面/卖家/演员** 辅源；条目不全时以 hub/fc2 补 |

---

## 已知问题

- 并非所有 PPV 都有 FD2 条目（如 4962908 → 404）。
- **详情页才出 CF**：过盾后 `cf_clearance` 落盘。
  - **裸 curl.exe + cookie**：TLS 对不上，仍 403。
  - **curl-impersonate + 解盾 UA + cookie**：**已实测通过**（`clearance-curl-ok`，~1.8s / 102KB）。
  - 无 impersonate 时：`clearance-reuse` → Flare 带 cookie（跳过空烧裸 curl）。
- 封面 webp 体积很小（~3KB），画质有限。

---

## 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-24 | 复测：有 `cf_clearance` 时 **curl-impersonate 直链成功**（`clearance-curl-ok`）；冷启动无凭证才会 Flare |
| 2026-08-24 | **cf_clearance 复用**：冷启动不再误清；落盘立即写；无 impersonate 时 skip 裸 curl → Flare+cookie |
| 2026-08-24 | 自适应：curl 失败再试；access→`proxy_adaptive`；演员/标签分离；E2E 3275049 |
| 2026-08-22 | 初测 3275049 E2E；封面 xximgs |
