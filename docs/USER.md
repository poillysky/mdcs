# MDCS 用户手册

> 版本：v1.0.0  
> 适用：本地刮削整理服务（七路径）

---

## 1. 快速开始（约 15 分钟）

### 方式 A：开发机一键

```bash
# 根目录
npm run install:all
npm run dev
```

- Web：http://127.0.0.1:3050  
- API：http://127.0.0.1:9210/health  

### 方式 B：Windows 脚本

```bat
scripts\start.bat
```

### 方式 C：Docker

```bash
docker compose up -d --build
```

浏览器打开 http://127.0.0.1:9210 （生产态由后端托管前端）。

---

## 2. 七路径说明

| KindId | 含义 | 建议来源 |
|--------|------|----------|
| japan_censored | 日本有码 | inbox/有码 |
| japan_uncensored | 日本无码 | inbox/无码 |
| japan_amateur | 素人 | inbox/素人 |
| japan_gravure | 日本写真 | inbox/写真 |
| fc2 | FC2 | inbox/FC2 |
| china | 国产 | inbox/国产 |
| western | 欧美 | inbox/欧美 |

在 **设置 → 整理** 为每个分区配置 `sourceRoot`（扫描）与 `libraryRoot`（入库）。

---

## 3. 推荐工作流

1. 把视频放进对应 `sourceRoot`
2. **手动任务** → 创建「全流程」或「仅扫描」
3. 在 **刮削记录** 看字段来源与失败重试
4. 需要自动入库：开启 **设置 → 监控**（兼容模式适合 SMB）
5. 外部通知：配置 **Webhook**；下载器联动：配置 **qB 完成钩子**

---

## 4. 代理与 FlareSolverr

- **设置 → 网络**：填写 HTTP 代理、FlareSolverr 地址，点「测试连接」
- 数据源页可看各 Provider 的访问方式（直连 / 代理 / Flare）
- 点 **探活已实现源**：失败源会冷却约 15 分钟，避免拖死任务

常见提示：

| 现象 | 处理 |
|------|------|
| 无法连接后端 | 确认 9210 已启动 |
| FlareSolverr 不可用 | 检查容器/地址，或关掉过盾源 |
| 路径不在允许范围内 | 只使用已配置的来源/输出目录 |
| 磁盘空间不足 | 清理磁盘后再整理 |

---

## 5. 任务模式

| 模式 | 作用 |
|------|------|
| 仅扫描 | 入库文件表，识别番号 |
| 仅刮削 | 多源聚合元数据与封面 |
| 仅整理 | hardlink/copy/move + NFO/水印 |
| 全流程 | 扫描 → 刮削 → 整理 |
| 试运行 dry-run | 只出计划不写盘 |

创建任务可 **复用上次 / 复用预设**，并导出导入 JSON。

---

## 6. 安全提示

- 默认无鉴权，仅建议局域网使用
- 暴露到公网时设置环境变量 `MDCS_API_TOKEN`，请求头带 `X-Mdcs-Token`
- 「移动」整理会删除源文件，创建任务时有确认
- API Key / Token 不会明文写入业务日志（脱敏）

---

## 7. FAQ

**Q: 封面下不来？**  
检查下载 Tab 是否关闭海报；网络是否被墙；Amazon 跳过是否过滤了唯一候选。

**Q: 扫描很慢？**  
增量跳过已按 mtime+size；重复扫描会大量 skipped。万级目录用兼容监控即可。

**Q: 演员页为空？**  
先完成刮削，演员从本地缓存聚合。

更多设计见 `docs/DESIGN.md`，路线图见 `docs/ROADMAP.md`。
