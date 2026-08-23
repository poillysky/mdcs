# 数据源测通规格（八参考项目最优合成）

> 版本：2026-08-22  
> 范围：MDCS 落地 + 跨项目复用（Cursor Skill：`source-probe`）  
> 八参考：`sehua-next-web` · `mdcx-diy` · `JavSP` · `JavSP-Web` · `javinizer-go` · `javbus-api` · `javspider_stack` · `jellyfin-jav-scraper`

## 1. 结论一句话

**测通必须走与真刮削相同的网络通道与判定标准**；「HTTP &lt; 500」或「首页 200」不算通。

## 2. 八项目能力对照

| 能力 | sehua | mdcx | MDCS | 其余 5 项 |
|------|-------|------|-------|-----------|
| 与刮削同通道 | ✅ fetchPage | ✅ AsyncWebClient | ✅ fetchPage | 多为薄 GET |
| 认 CF 挑战页 | ✅ | ✅ + bypass | ✅ | 弱/无 |
| access 分层 | ✅ proxy/flare/adaptive | 站点配置 | ✅ | 少 |
| 镜像只读探活 | ✅ skipDiscover | 弱 | ✅ | 无 |
| API/GraphQL 探针 | TPDB 等 | 部分 | TPDB + **DMM GQL** | 少 |
| 能连后再验能刮 | 弱 | ✅ 样例番号 | 可选 L2 | 无 |
| 串行防拖垮 Flare | ✅ | 分组 | ✅ probeAll | — |
| 失败冷却 | ✅ | — | ✅ 15min | — |

**主规格 = 色花 L1 + MDC 的 L2 思想 + MDCS API 特例。**

## 3. 三层模型

| 层 | 名称 | 做什么 | UI |
|----|------|--------|-----|
| L0 | 环境 | 代理 / Flare 自身通 | 网络面板 |
| L1 | 站点可达 | 同 access 拉探针；非挑战页；回写镜像 | 卡片「测通」 |
| L2 | 能力 | 样例番号跑 Provider 最小路径 | 可选「深度测通」 |

## 4. access → 通道与超时

| access | 通道 | 超时建议 |
|--------|------|----------|
| `proxy` | 代理直连（curl/undici），不盲回落 Flare | 18s |
| `proxy_flare` | 强制 Flare，**必须**把 scrape 代理注入 FS | 36s |
| `proxy_adaptive` | curl → 短 Node → Flare | 36–42s（airav 系可 42） |

硬规则：

1. Flare 目标请求带 `proxy: { url }`；调用 FS HTTP API 用直连 Agent。  
2. 探活 `strictTimeout: true`，禁止全量镜像发现。  
3. 成功记住 `resolvedBaseUrl` + `probeVia`（direct/curl/flare/api）。

## 5. 判定

**通**：有正文 + 非挑战页 +（可选）站点特征 HTML / 合法 JSON。

**不通**：空响应、挑战页、地域封锁、缺代理/Flare/API Key。  
失败 → `markProbeFailed`（默认 15 分钟），刮削调度跳过冷却源。

## 6. 探针 URL

- HTML：`probePath`；能选详情/搜索页就不要只打会变的年龄门首页。  
- **DMM**：`POST https://api.video.dmm.co.jp/graphql`（与刮削一致），不要只打 `dmm.co.jp/`。  
- **ThePornDB**：带 Key 的轻量搜索。  
- airav：跟镜像跳转；javbus：缓存失败可试 1 备用种子。

## 7. 调度与 API

```
POST /api/scrape/providers/probe
  { id?: string, timeoutSec?: number, clearCooldown?: boolean, onlyImplemented?: boolean }
→ { results: ProbeResult[], cooldown: string[] }
```

全量测通：**串行** `probeProvider`；单卡同函数。

## 8. MDCS 实现锚点

- `apps/server/src/scrape/probe.ts` — L1 主流程  
- `apps/server/src/scrape/network/download.ts` — `fetchPage`  
- `apps/server/src/scrape/providers/theporndb.ts` — `probeTheporndbApi`  
- `apps/server/src/scrape/providers/dmm.ts` — `probeDmmApi`（GraphQL）  
- `apps/web` 数据源卡片「测通」

## 9. 非目标

- javspider 磁力管理形态  
- Jellyfin 插件专有探测 UI  
- 并行全站 Flare 压测
