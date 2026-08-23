# S6 验收与运维清单

## S6.1 / S6.2 UX + 文案（已验收）

- [x] 侧栏路由：主界面 / 任务 / 记录 / 演员 / 文件 / 数据源 / 设置
- [x] 设置 11 Tab 均可进入（演员已启用）
- [x] 危险操作：move 强确认；dry-run 可见
- [x] Toast 走 `localizeMessage`，无英文裸错误主路径
- [x] 失败可恢复：记录页重试 / 网络测试 / Provider 探活

## S6.3 Provider 健壮性

- [x] `runPool` / orchestrator 单源异常隔离
- [x] `POST /api/scrape/providers/probe` 探活；失败冷却 15 分钟跳过
- [x] 未实现源为 stub，不拖死任务

## S6.4 压测

- [x] DB 索引：files(status/kind)、jobs(status/updated)、scrape_cache(scraped)
- [x] 扫描增量 `shouldSkipScanEntry`（mtime+size）
- [x] 脚本：`npm run bench:scan`（抽样万级跳过）

## S6.5 失败演练（对照 COPY）

| 场景 | 用户可见提示 | 恢复 |
|------|--------------|------|
| 后端未启动 | 无法连接后端服务 | 启动 server |
| 代理/超时 | 请求超时 / 远程站点 HTTP | 检查网络 Tab |
| Flare 挂 | FlareSolverr 不可用 | 修 Flare 或禁过盾源 |
| 磁盘满 | 磁盘空间不足 | 清理磁盘 |
| 路径越权 | 路径不在允许范围内 | 改到白名单目录 |
| Token 错误 | 未授权 | 配置 MDCS_API_TOKEN |

## S6.6 安全审计

- [x] 路径白名单 `security/pathPolicy.ts`
- [x] 可选 `MDCS_API_TOKEN`（`X-Mdcs-Token`）
- [x] `redactSecrets` 脱敏
- [x] CORS 允许 Token 头；默认局域网部署

## S6.7 性能

- [x] WS `job_update` 增量
- [x] 列表分页 + `VirtualList` 组件
- [x] 封面 `LazyCover`（loading=lazy）

## S6.8–S6.12 交付

- [x] `docs/USER.md`
- [x] Docker / Windows 启动脚本
- [x] CHANGELOG + v1.0.0
- [x] ROADMAP 附录 B 已勾
- [x] 删除未使用 LivePage
