# MDCS API 契约

> 版本：v1.0 · 2026-08-20  
> 后端默认端口：**9210** · 前端开发代理至同源 `/api`

---

## 1. 统一响应格式

所有 JSON API 返回：

```json
{ "ok": true, "data": { ... } }
```

或失败时：

```json
{ "ok": false, "message": "人类可读说明", "code": "error_code" }
```

- `ok`：布尔，成功与否
- `data`：成功载荷（仅 `ok: true`）
- `message`：失败说明（中文优先，可含细节）
- `code`：机器可读错误码，前端映射至 [`UI-COPY.md`](UI-COPY.md) §12

前端通过 `ApiError`（`apps/web/src/api.ts`）抛出，Toast 经 `localizeMessage` 转中文。

---

## 2. 错误码一览

| code | HTTP | 含义 |
|------|------|------|
| `bad_request` | 400 | 请求参数无效 |
| `not_found` | 404 | 路由或资源不存在 |
| `internal_error` | 500 | 服务器内部错误 |
| `kind_not_found` | 404 | 未知分区 |
| `kind_unavailable` | 404 | 分区未启用或不可用 |
| `kind_update_invalid` | 400 | 分区配置更新无效 |
| `path_not_allowed` | 400 | 路径不在白名单内 |
| `job_not_found` | 404 | 任务不存在 |
| `job_create_invalid` | 400 | 无法创建任务 |
| `scan_failed` | 500 | 扫描来源目录失败 |
| `scrape_disabled` | 400 | 在线刮削已关闭 |
| `missing_code` | 400 | 缺少番号 |
| `invalid_kind` | 400 | 分区无效 |
| `no_cache` | 404 | 无刮削缓存 |
| `config_invalid` | 400 | 配置文件格式无效 |
| `invalid_json` | — | 前端：响应非 JSON |

常量定义：`apps/server/src/api/codes.ts`  
前端映射：`apps/web/src/lib/messages.ts` → `CODE_MESSAGES`

---

## 3. 端点摘要

### 健康

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务名、版本、阶段 |

### 分区 `/api/kinds`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 整理配置 + 七路径列表 + 统计 |
| GET | `/folders?parent=` | 浏览 index/来源/输出目录（白名单） |
| GET | `/:kindId` | 单分区详情 |
| PUT | `/:kindId` | 更新分区（路径字段校验白名单） |
| POST | `/:kindId/scan` | 扫描来源目录入库 |

### 任务 `/api/jobs`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 任务列表（`status`/`mode`/`q`/`page`/`pageSize`） |
| GET | `/:id` | 任务详情 |
| POST | `/` | 创建任务 |
| POST | `/:id/pause` | 暂停 |
| POST | `/:id/resume` | 继续 |
| POST | `/:id/cancel` | 取消 |

### 文件 `/api/files`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 分页列表（`kind`/`status`/`page`） |
| POST | `/:id/retry` | 重新排队 |

### 刮削 `/api/scrape`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 单番号刮削 |
| GET | `/config` | 读取 scrape.json（含 `catalog` Provider 目录） |
| PUT | `/config` | 保存 scrape.json |
| POST | `/network/test` | 探活：`target=direct\|proxy\|flare` |
| GET | `/cache/:kind/:code` | 读取缓存元数据 |

---

## 4. 路径白名单

文件浏览与分区 `sourceRoot` / `libraryRoot` 必须落在：

- 项目 `pathRoot`
- `indexRoot`
- 各分区已配置的 `sourceRoot` / `libraryRoot`

实现：`apps/server/src/security/pathPolicy.ts`

越权请求返回 `path_not_allowed` + 中文 `message`。
