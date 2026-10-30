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

## 2026-10-29 · M2–M5 / submission（收尾与提交）

### 里程碑

- **M2 编辑器（Task 10）**：上传/抠图后进入 Konva 编辑台，模板、文字、贴纸、背景、滤镜、图层六个面板，撤销重做与 1080 PNG 导出；收尾补齐水平翻转与文字左/中/右对齐，面板控件在移动端保持 ≥44 px 触控高度。
- **M3 整套与持久化（Task 11–13）**：6 个主题 × 10 张整套生成、单格换文案、JSZip 打包（含 `使用说明.txt`，写入线上地址）；草稿自动保存到 IndexedDB，刷新可恢复。
- **M4 首页与验收（Task 14–16）**：品牌首页、示例照片、响应式底部面板、无障碍与降级路径；用 Chrome DevTools MCP 走通桌面/移动金路径，模型失败可进入相框模式继续编辑导出。
- **M5 最终部署与提交（Task 17）**：Qoder Sites 重新发布，线上地址匿名访问正常；README、论坛帖、构建日志与验收清单同步更新。

### 最终指标

- 测试：`npm run test` 共 20 个文件、**182 个测试全部通过**（最终修复波后）；`npm run build`（tsc -b + vite build）通过。
- Lighthouse（本地 dev）：首页与编辑台无障碍均为 **100**；首页 LCP **约 0.7 s**（743 ms，无节流；dev server，非生产托管），CLS 0.03。
- 体积：最终入口 JS `index-DpR1IHvO.js` 683.66 kB raw / **211.24 kB gzip**；`dist` 合计 **19 MB**；ORT 与 JSZip 是独立懒加载 chunk，不在 `index.html` 首屏引用。
- 抠图资产：改用 `onnxruntime-web/wasm` 入口后，构建不再产出 23.9 MB 的 JSEP WASM（约 24 MB 死资产），抠图实际加载的 ORT WASM + 模型合计约 17 MB。
- 最终部署：<https://meme-arsenal-h9ls3oya5li.qoder.zone>（2026-10-29 首次发布，2026-10-30 修复波后重新发布，public，匿名访问已验证）；线上首页截图 `docs/assets/final-live-home.png`。
- 验收明细：`docs/assets/qa-checklist.md`（其中真机测试为已知限制，未声称通过）。

### Qoder Sites 限制观察（M5 复查）

- **artifact 上限 50 MB**：最终静态产物（含模型与 ORT WASM）未超限；平台不执行构建，发布前需先在本地 `npm run build`。
- **新站默认私有**：发布后必须把访问策略手动切到 public，否则匿名访问返回 401。
- **平台徽标**：页面右下角注入「Made with Qoder」徽标与「隐藏水印」按钮，非应用源码。
- **无 SPA 深链回退**：直接访问深层路径返回 404；应用使用 HashRouter 规避，刷新与分享链接正常。

### 与规格的偏差

- **字号范围**：规格写 12–96 px，实际滑杆为 **24–120 px**。这是有意决定：低于 24 px 在手机上不可读，96 px 对封面主文案上限偏低；导出仍受 1080 画布与自动缩放约束。该偏差在文字面板代码注释中同样标注。
- 真机 iOS/Android 未测试（软键盘、Safari Canvas 滤镜、ZIP 下载），已在 `docs/assets/qa-checklist.md` 标为已知限制，不声称通过。

## 2026-10-30 · 最终审查修复波与重新发布

全分支审查给出 "With fixes"，据此完成一轮修复并重新发布：

- **换照片 / 重新抠图 / 全新开始**：编辑器新增「换照片」（清空当前编辑与本地草稿）和「重新抠图」（相框模式或未抠图时可用）；首页主 CTA 以 `{fresh:true}` 进入全新流程，示例替换草稿前会确认。
- **移动端选中框**：Transformer 手柄改为 16px（触屏）/10px（鼠标）+ 外扩 padding，进入编辑器不再自动选中文字，避免手柄遮挡短文案；透明背景预览显示棋盘格。
- **抠图体积**：改用 `onnxruntime-web/wasm` 入口，构建不再产出 23.9 MB JSEP WASM；`dist` 从约 43 MB 降至 **19 MB**，线上首抠实际加载模型 + 运行时约 17 MB，并新增「正在加载推理引擎」阶段。
- **整套页**：无照片时自动恢复草稿或使用内置示例生成 demo（横幅「当前是示例照片」+「换成我的照片」）；ZIP 改为先生成再点击下载；`使用说明.txt` 写入线上地址；缩略图透明背景显示棋盘格。
- **控件与可达性**：补齐照片水平翻转、文字左/中/右对齐；整套页/上传页触控目标补到 ≥44px；示例加载失败提示对比度修正；画布可聚焦后用方向键微调。
- **验证**：182 个测试、`tsc -b`、`npm run build`、oxlint 全部通过；本地与线上均重新验证「示例 → 抠图 → 编辑 → 导出」以及「整套 → ZIP（11 项，1080×1080）」；线上控制台无错误（仅 SharedArrayBuffer/COOP 提示）。
- **重新发布**：Qoder Sites action `9f5b702f-29a1-4b23-95ae-fe97f2deb67d`，publish operation `01a18b1e-88a9-7ed1-92fd-bf0317174c67` 已 committed；<https://meme-arsenal-h9ls3oya5li.qoder.zone> 匿名访问正常。
- **仍未覆盖**：真机软键盘与 Safari 实测；单标签页写入假设（跨标签草稿为 last-writer-wins）；浏览器拦截多文件下载时无法感知（文案已改为「已发起」）。

- **2026-10-30 天池作品帖已提交（审核中）**：<https://tianchi.aliyun.com/forum/post/1091458>；审核通过后公开链接通常为 `https://tianchi.aliyun.com/forum/postDetail?postId=1091458`。
