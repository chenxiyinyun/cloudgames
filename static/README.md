# static/ — 纯静态小游戏区

这个目录与 `games/`（Vue 3 + Vite 多入口构建）**完全独立**，用于放置「零构建、可直接发布」的纯静态网页小游戏。

## 与 games/ 的分工

| | `games/` | `static/` |
|---|---|---|
| 技术栈 | Vue 3 + Vite，多入口构建 | 原生 HTML/CSS/JS，零依赖 |
| 构建 | 必须 `npm run build` | 不需要，目录原样上传即可运行 |
| 部署 | 随主站 Vite 构建产物一起发 | 整个游戏文件夹单独托管（任意静态服务 / GitHub Pages / 对象存储） |
| 适用 | 联机、需要 WebSocket 服务的游戏 | 单机、纯前端、放置/叙事/收集类 |

## 硬性约定（保证「直接发布」成立）

1. **不使用 ES Module `import`** —— 用普通 `<script>` 顺序加载 + 全局命名空间（`window.SH`）。
   原因：`file://` 协议下 `type="module"` 与 `fetch()` 会被 CORS 拦截，双击打开就白屏。
2. **数据用 `.js` 常量而非 `.json`** —— 同样是为了 `file://` 可直接运行。
3. **所有路径用相对路径** —— 不以 `/` 开头，避免子路径部署失效。
4. **存档用 `localStorage`**，并提供导出/导入 JSON 兜底。
5. **不依赖任何 CDN** —— 离线可跑，也避免国内网络加载失败。

## 目录结构

```
static/
└── <game-name>/
    ├── index.html          入口
    ├── styles/             CSS
    ├── src/
    │   ├── core/           随机数、存档、状态
    │   ├── data/           内容数据（JS 常量）
    │   ├── systems/        规则引擎（纯函数优先，可测试）
    │   └── ui/             渲染与交互
    ├── assets/             图片 / 音频
    ├── DESIGN.md           设计文档
    └── ART-LIST.md         美术素材清单
```

## 本地预览

双击 `index.html` 即可；或起个静态服务：

```bash
npx serve static/<game-name>
```
