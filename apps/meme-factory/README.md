# 斗图军火库 · 应用

Vite + React 19 + TypeScript 单页应用。纯静态、无后端，所有图片处理在浏览器本地完成。

## 命令

```bash
npm install
npm run dev          # 开发服务器（先复制 ORT wasm 到 public/ort）
npm run test         # Vitest 单元/组件测试
npm run lint         # oxlint
npm run build        # tsc -b + vite build
npm run preview      # 预览构建产物
npm run fetch-model  # 下载 u2netp.onnx 到 public/models（已提交，可选）
```

CI/部署前请执行 `npm run test && npm run build`。

## 架构

```
src/
  App.tsx                 # HashRouter：/ 首页、/create 编辑、/packs 整套
  lib/scene.ts            # 场景模型（照片/文字/贴纸、背景、滤镜）
  lib/fitText.ts          # 中文按字符测量、自动降字号、两行、省略号
  lib/render.ts           # Canvas2D 共享渲染器（编辑器背景、缩略图、导出）
  lib/export.ts           # 字体等待、滤镜烘焙、1080 PNG 导出
  lib/zip.ts              # 整套 ZIP（JSZip 懒加载）
  lib/serialize.ts        # 草稿序列化与校验
  lib/storage.ts          # IndexedDB 草稿（idb-keyval）
  features/cutout/        # u2netp + onnxruntime-web 本地抠图
  features/editor/        # Konva 画布、面板、工具栏、创建流程
  features/packs/         # 主题整套生成、网格预览、下载
  features/home/          # 首页、示例、草稿恢复入口
  data/                   # 模板、贴纸、文案库
public/
  models/u2netp.onnx      # 4,574,861 字节，Apache-2.0
  samples/*.webp          # AI 生成示例
  ort/                    # onnxruntime-web wasm（构建时复制，已 gitignore）
src/assets/fonts/         # Smiley Sans（OFL）
```

### 抠图流程

1. 上传图片压缩到 ≤1600px（`lib/image.ts`）。
2. 320×320 拉伸绘制，读取 RGBA，转 CHW Float32，ImageNet 归一化。
3. `onnxruntime-web` 单线程 WASM 运行 u2netp，取首个输出蒙版。
4. 蒙版归一化为 alpha，将蒙版放大合成到原图，`blur(1px)` 羽化，导出 PNG。
5. 模型通过 `fetch` 下载并缓存到 Cache Storage（`meme-arsenal-model-v1`），校验字节数 4,574,861。
6. 失败/取消/跳过：编辑器使用相框模式，仍可正常导出。

### 渲染与导出

Konva 画布与导出共用 `lib/render.ts` 的排版几何（文本框、气泡内边距、相框偏移、字号拟合），导出固定 1080×1080；`awaitFonts()` 保证字体加载完成后再绘制。

## 测试

- Vitest：场景模型/撤销、中文排版、内容库完整性、渲染调用、抠图张量、上传校验、ZIP、序列化、存储、无障碍交互。
- 浏览器验收：Chrome DevTools MCP 走通桌面/移动金路径、模型失败降级、隐私网络检查；详见仓库 `docs/assets/qa-checklist.md`。

## 许可

- Smiley Sans：OFL 1.1（`src/assets/fonts/OFL-SmileySans.txt`）
- u2netp / U-2-Net：Apache-2.0（`public/models/LICENSE-u2net.txt`）
- 示例照片：AI 生成（仓库 `docs/assets/sample-licenses.md`）

## 部署

生产构建为纯静态资源，使用 Qoder Sites 发布（生成站点描述文件后由平台管理，勿手改）。`base: './'` + HashRouter 适配子路径静态托管；无服务端依赖。
