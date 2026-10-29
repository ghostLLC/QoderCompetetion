# 构建日志

## 2026-10-29 · M1 Qoder Sites 部署冒烟

### 部署内容

- 应用：`apps/meme-factory/`（Vite 8 + React 19 + Tailwind CSS 4 静态 SPA，HashRouter）。
- 构建：`npm run test`（1 个测试通过）与 `npm run build` 均通过；上传目录为 `apps/meme-factory/dist/`。
- 产物：7 个文件，合计 14,119,836 字节（约 13.5 MiB）。其中 `index-*.js` 258,123 B（gzip 81,287 B）、`index-*.css` 7,662 B（gzip 2,375 B）、SmileySans 字体 1,150,924 B、ONNX Runtime wasm 12,666,427 B。
- 站点名称：`斗图军火库`；站点标识（slug）：`meme-arsenal`；访问策略：public。
- 线上地址：<https://meme-arsenal-h9ls3oya5li.qoder.zone>
- 发布方式：Qoder Sites `prepare_site`（`webDirectory: "dist"`, `spa: true`）→ `publish_site`，发布状态 `published: true`。平台未执行构建，构建需在本地完成。

### 验证结果

- 在全新隔离浏览器上下文（chrome-devtools MCP，`isolatedContext=m1-fresh`）打开线上地址：页面标题与一级标题为「斗图军火库」，副标题为「别偷图了，造你自己的」。
- 控制台：无消息。
- 网络：首页 5 个请求全部 200（文档、JS、CSS、字体、favicon），无 404。
- 直接请求资源均返回正确 MIME：JS `application/javascript`、CSS `text/css`、字体 `font/woff2`、wasm `application/wasm`，且 JS/CSS 经 gzip 传输。
- 截图：`docs/assets/m1-deploy.png`（1280×800，全新 Chrome 配置独立渲染）。

### 平台限制与观察

- **新站默认私有**：发布后未登录访问返回 `401 Unauthorized`（`x-qoder-error: sites_gateway_login_required`）；需在站点访问策略中单独切换为 public，切换后匿名访问返回 200。发布与公开是两步。
- **子域名由服务端分配**：`check_subdomain` 需要已存在的 `siteId`，新站创建前无法预检；请求的 slug `meme-arsenal` 被加上服务端后缀，实际域名为 `meme-arsenal-h9ls3oya5li.qoder.zone`（`.qoder.zone`，不是 `.qoder.site`）。后续不应假定前缀完全等于 slug。
- **静态资源缓存**：HTML 与带哈希的 JS/CSS 响应均为 `cache-control: no-cache`，没有长期 immutable 缓存；每次访问会回源校验。JS/CSS 启用 gzip，字体与 wasm 未压缩。
- **安全响应头**：本次响应中未观察到 HSTS、CSP、`X-Content-Type-Options` 等安全头（仅记录实测结果）。
- **SPA 回退未生效**：虽然传入 `spa: true`，`/some/deep/route` 与不存在的 `/assets/*.js` 均返回 404（无 HTML fallback）。当前应用使用 HashRouter，因此 M1 不受影响；若后续改用 history 路由，需先重新验证深链与刷新。
- **平台注入水印**：发布页面右下角出现「Made with Qoder」徽标与「隐藏水印」按钮，并非应用源码内容。
- **包体上限**：文档限制为单文件 50 MiB、Web 内容 450 MiB、本地 ZIP 100 MiB、服务端 artifact 50 MiB；本次 14.1 MB 产物远低于上限。ONNX wasm 单文件 12.1 MiB，可正常上传与访问。
- **描述文件**：首次 `prepare_site` 返回 `descriptorStatus: pending`；发布就绪后以同一 action 重试，生成 `apps/meme-factory/.斗图军火库.qoder.site`。该文件由工具生成，请勿手改。

### 结论

M1 冒烟通过：静态 Vite 产物可发布、公开访问、资源加载正常。遗留观察：SPA 深链无回退、资源无长缓存、页面带平台水印；在进入重功能开发前无需阻塞，但最终部署（M5）时需复查。

## 2026-10-29 · Task 15 复查：Lighthouse 记录

工具：chrome-devtools MCP `lighthouse_audit`（chrome-devtools-mcp 1.9.0），本地 dev server `http://localhost:5173`，运行日期 2026-10-29。

| 页面 | 模式 / 视口 | 无障碍 | 最佳实践 | SEO |
|---|---|---:|---:|---:|
| 编辑台 `/#/create`（移动端面板展开） | snapshot / 375×812 mobile | 100 | 100 | 80* |
| 编辑台 `/#/create` | snapshot / 1440×1000 desktop | 100 | 100 | 80* |
| 首页 `/#/` | snapshot / 375×812 mobile | 100 | 100 | 83* |
| 首页 `/#/` | navigation / 375×812 mobile | 100 | 100 | 92 |

\* snapshot 模式没有 URL，SEO 分数不可比；导航模式首页 SEO 92 来自 hash 路由。

编辑台在修复后两个视口均为无障碍 100；首页在 Task 14 对比度修复后同样为 100。补充实测：375×812 下 `scrollWidth` 为 375（无横向滚动）；底部 tab 栏高 62 px（56 px 按钮 + 2 px 上边框 + 4 px 焦点环留白），展开面板底边位于 750 px（45 vh = 365.4 px），不与 tab 栏重叠。
