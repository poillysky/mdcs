# MDCS

本地 AV 刮削整理服务（前后端分离）。

## 快速启动

```cmd
start-dev.cmd
```

或：

```bash
npm install
npm run install:all
npm run dev
```

- 前端：http://127.0.0.1:3050
- 后端：http://127.0.0.1:9210
- 健康检查：http://127.0.0.1:9210/health

## 配置

| 文件 | 说明 |
|------|------|
| `config/libraries.json` | 七路径来源/输出、整理模式、服务端口 |
| `config/scrape.json` | 刮削源链、网络、字段优先级 |

首次克隆请复制 `config/scrape.example.json` → `config/scrape.json` 并按环境修改。

`index/` 目录由外部服务生成，MDCS 只读浏览，不自动创建来源/输出目录。

## 开发命令

```bash
npm run typecheck   # 前后端类型检查
npm run test        # 服务端单元测试
npm run dev:server  # 仅后端
npm run dev:web     # 仅前端
```

## 文档

见 [`docs/README.md`](docs/README.md) 与 [`docs/ROADMAP.md`](docs/ROADMAP.md)。
