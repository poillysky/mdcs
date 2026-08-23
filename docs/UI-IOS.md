# MDCS — iOS 显示与触控适配指南

> 版本：v1.0  
> 日期：2026-08-21  
> 性质：**落地指导**（Safari / 添加到主屏幕 / 独立全屏）  
> 上位契约：[`UI-DESIGN-SYSTEM.md`](UI-DESIGN-SYSTEM.md)  
> 关联：[`UI-DENSITY.md`](UI-DENSITY.md) · [`UI-PLAYBOOK.md`](UI-PLAYBOOK.md)

**冲突裁决**：色值 / 圆角 / 红线仍以 DESIGN-SYSTEM 为准；密度节奏以 DENSITY 为准。本文只约束 **iOS Safari 与 standalone 下的可读、可点、安全区与系统怪癖**。

---

## 0. 一句话目标

在 iPhone / iPad 上（含「添加到主屏幕」）：

1. **字能看清**（尤其下拉、输入、说明）  
2. **点得到**（触控热区 ≥ 44px）  
3. **不被刘海 / Home 条挡住**  
4. **不乱放大、不裁切、不露浏览器底**

---

## 1. 运行形态

| 形态 | 特征 | 注意 |
|------|------|------|
| Safari 标签页 | 有地址栏 / 底栏 | 可视高度会变；`100vh` 不可靠 |
| 添加到主屏幕 | `display-mode: standalone` 或 `navigator.standalone` | 无浏览器栏；必须吃 `safe-area-inset-*` |
| 横屏 | 左右也可能有安全区 | 侧栏 / 固定底栏要算 `--safe-left/right` |

检测与打标：

- JS：`apps/web/src/lib/displayMode.ts` → `html.is-standalone`、`html.is-ios`
- Meta：`viewport-fit=cover` + `apple-mobile-web-app-capable`（见 `index.html`）

---

## 2. 已知坑与强制规则

### 2.1 输入框 / 下拉字号小于 16px → 又小又会被放大

Safari 对 `input` / `select` / `textarea`：**计算字号 &lt; 16px 时聚焦会整页缩放**，平时也显得过小。

| 规则 | 值 |
|------|-----|
| 桌面 | 可用 13–15px（契约控件高 36） |
| **≤960px / iOS** | **不小于 16px**，`min-height` **不小于 44px** |
| 关键下拉（整理模式等） | 建议 **48px** 高，自绘箭头，`-webkit-appearance: none` |

禁止在移动端把表单控件压到 13px「为了紧凑」。

### 2.2 原生 `<select>` 在 iOS 上易被压扁

- 必须 `appearance: none` + 右侧箭头（SVG data-uri 即可）  
- `padding-right` 预留箭头区（≥ 36px）  
- 说明文字（hint）移动端 **≥ 14px**，不要 11–12px 灰字贴边

### 2.3 安全区（刘海 / 灵动岛 / Home 条）

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
}
```

**必须叠加 safe-area 的区域：**

- 侧栏上下左右 padding  
- 主内容区 top / bottom / right  
- 固定底栏（保存条、Toast、引导条）  
- 全屏 modal 贴边时

`viewport` 必须含 `viewport-fit=cover`，否则 `env(safe-area-inset-*)` 常为 0。

### 2.4 高度：用 `dvh`，不要只靠 `100vh`

iOS 地址栏显隐会改可视高度。壳层、侧栏高度：

- `min-height: 100vh` 作回退  
- **同时** `min-height: 100dvh` / `height: 100dvh`

### 2.5 触控热区

| 元素 | 最小 |
|------|------|
| 按钮 / 开关行 / 导航项 | **44×44** |
| 表格行内 `btn.sm` | 高度 ≥ 32，但可点宽度尽量 ≥ 44 |
| Chip / 关闭按钮 | 不小于 32；重要操作仍建议 44 |

### 2.6 固定层与滚动

- `position: fixed` 底栏：`bottom: calc(Npx + var(--safe-bottom))`  
- `overscroll-behavior: none` 减少 standalone 下橡皮筋露底  
- `-webkit-overflow-scrolling: touch` 用于内部滚动容器  
- 避免 `100vh` 固定底 + 键盘顶起时把主按钮顶出屏外（长表单优先页内保存，或接受滚动）

### 2.7 文字与点击反馈

```css
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
body {
  -webkit-tap-highlight-color: transparent;
}
```

禁止依赖 hover 才显示的关键操作（iOS 无稳定 hover）。

---

## 3. MDCS 落地检查清单

改 `apps/web` 涉及移动 / iOS 时：

- [ ] `index.html` 仍有 `viewport-fit=cover` 与 apple-mobile-web-app meta  
- [ ] `html` 有 `is-ios` / `is-standalone` 打标（`displayMode.ts`）  
- [ ] 移动端 `input/select/textarea` ≥ 16px / 44px  
- [ ] 自定义下拉有箭头且不被系统样式压扁  
- [ ] 侧栏、主区、Toast、保存条、引导条均叠加 safe-area  
- [ ] 壳层使用 `100dvh`  
- [ ] 关键按钮触控热区 ≥ 44px  
- [ ] 真机：Safari 与「添加到主屏幕」各验一次刘海机

---

## 4. 反例 → 正例

| 反例 | 正例 |
|------|------|
| 移动端 select `font-size: 13px` | `16px` + `min-height: 44–48px` |
| hint `12px` 挤在下拉下 | 移动端 `14px` / `line-height: 22px` |
| 固定保存条 `bottom: 24px` | `bottom: calc(24px + var(--safe-bottom))` |
| 仅用 `height: 100vh` | `100vh` + `100dvh` |
| 依赖 `:hover` 展开侧栏才有入口 | 移动端汉堡按钮 + 抽屉（`AppShell`） |
| 大卡矩阵五种模式 | 单个大号 select + 一行 hint |

---

## 5. 给 Cursor / AI 的执行口令

> 按 `docs/UI-IOS.md` 检查并修复 iOS 显示：控件 ≥16px/44px、safe-area、dvh、select 外观、固定底栏；不改动 DESIGN-SYSTEM 色值。

---

## 6. 与密度指南的关系

[`UI-DENSITY.md`](UI-DENSITY.md) 要求配置页偏紧，但 **iOS 上「紧」不能牺牲 16px 控件字号与 44px 热区**。  
桌面可紧；手机在触控与系统缩放规则上必须让步——**可读可点优先于再砍 4px**。
