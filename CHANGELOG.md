# Changelog

## 1.0.0 — 2026-08-21

### 交付

- S0–S5 能力闭环：七路径、刮削引擎、整理/NFO/水印、监控、Webhook、预设、演员聚合、qB 钩子
- S6 打磨：Provider 探活冷却、失败文案、路径白名单、可选 API Token、Docker/Windows 启动、用户手册

### 引擎

- FAST/SLOW 双通道；字段优先级非空不回退；单源失败隔离
- 扫描增量跳过（mtime + size）；SQLite 索引加固

### UI

- MDC 风格侧栏 + 11 设置 Tab
- 任务高级覆盖、配置预设导入导出
- 封面懒加载；WS 任务增量

### 安全

- 目录白名单；`MDCS_API_TOKEN` 可选鉴权；密钥日志脱敏
