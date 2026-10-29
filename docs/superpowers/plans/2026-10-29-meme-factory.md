# 斗图军火库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "斗图军火库" — a zero-backend web app that turns one photo into a full themed sticker pack, with on-device background removal, a template editor, batch ZIP export, deployed as a public Qoder Site for the 2026 Qoder competition (LifeHack track).

**Architecture:** Static React SPA (hash routing, no server). All processing is client-side: `onnxruntime-web` runs a bundled u2netp ONNX model for cutout; a shared scene model drives both the Konva interactive editor and a pure Canvas2D renderer used for thumbnails and 1080×1080 PNG export. No image data ever leaves the browser.

**Tech Stack:** React 19 + TypeScript + Vite 8, Tailwind CSS 4, Zustand 5, react-konva 19 / konva 10, onnxruntime-web 1.21.0, JSZip 3.10, idb-keyval 6, Vitest 5 + Testing Library.

**Spec:** `docs/spec-2026-10-29-meme-factory-design.md`

## Global Constraints

- App root: `apps/meme-factory/`. All `npm` commands run there unless stated.
- Node 24, npm. TypeScript `strict: true`.
- Export size: exactly 1080×1080 PNG. ZIP contains one PNG per pack cell plus `使用说明.txt`.
- Content counts: 6 templates, 6 pack themes × 10 captions, ≥20 stickers.
- UI copy in Simplified Chinese; code identifiers and comments in English.
- No external network requests at runtime: fonts, model, ORT wasm, samples, stickers are all self-hosted. No analytics. No image uploads (verifiable in DevTools network panel).
- `HashRouter` + Vite `base: './'` so deep links and subpath hosting work on a static host.
- Brand colors: alert yellow `#E8FF00`, ink `#111111`, paper `#F7F5EF`, alert red `#FF3B30`.
- Initial JS ≤ 1MB gzip; cutout assets lazy-loaded and cacheable; model file 4.6MB committed to repo.
- Use TDD for pure logic (store, layout, data, zip, serialize, image math). Canvas/DOM interactions are verified manually in a real browser via chrome-devtools MCP.
- Commit after every task. Conventional commit messages. Push at the end of each milestone (Tasks 2, 10, 13, 16, 17).
- Never start the dev server on port 5173 and leave it running unattended at the end of a task; kill it after browser verification.

---

## File Structure

```
apps/meme-factory/
  index.html
  vite.config.ts
  scripts/copy-ort.mjs          # copy ORT wasm runtime into public/ort
  public/
    models/u2netp.onnx          # committed 4.6MB model
    models/LICENSE-u2net.txt
    samples/{selfie-1,cat-1,dorm-1}.webp
    ort/                        # generated, gitignored
  src/assets/fonts/
    SmileySans-Oblique.woff2    # imported by CSS so Vite rewrites for base './'
    OFL-SmileySans.txt
  src/
    main.tsx
    App.tsx                     # routes + layout + About modal
    styles/index.css            # Tailwind + tokens + font-face
    lib/
      scene.ts                  # types, factories, empty scene
      fitText.ts                # Chinese-aware auto text fitting
      render.ts                 # Canvas2D scene renderer (export path)
      image.ts                  # validation, decode, downscale, filter bake
      serialize.ts              # scene JSON (de)serialization + version
      filename.ts               # safe filenames
      zip.ts                    # ZIP manifest + build
      storage.ts                # IndexedDB draft persistence
    data/
      templates.ts              # 6 visual templates
      stickers.ts               # 22 sticker path definitions
      packs.ts                  # 6 themes × 10 captions
    store/
      editorStore.ts            # scene + selection + undo/redo
      photoStore.ts             # original/cutout blobs + object URLs (runtime only)
      useDraftAutosave.ts       # throttled persistence hook
    features/
      cutout/onnxCutout.ts      # model download/progress/inference/compose
      upload/UploadDropzone.tsx
      editor/EditorCanvas.tsx
      editor/EditorPage.tsx     # toolbar + panels + canvas
      editor/panels/*.tsx       # Template/Text/Sticker/Background/Filter/Layers
      packs/PackPage.tsx
      packs/PackGrid.tsx
      home/HomePage.tsx
      about/AboutModal.tsx
    components/                 # Button, Badge, Modal, Layout, Logo
  tests/                        # colocated *.test.ts(x)
docs/
  build-log.md
  forum-post.md
  assets/                       # screenshots for forum post
```

Navigation: `/` (home), `/create` (upload → cutout → editor), `/packs` (batch), about modal global.

---

### Task 1: Scaffold, design tokens, quality gates

**Files:**
- Create: `apps/meme-factory/` (Vite template), `vite.config.ts`, `src/styles/index.css`, `src/App.tsx`, `src/main.tsx`, `scripts/copy-ort.mjs`, `tests/smoke.test.tsx`, `apps/meme-factory/README.md`
- Modify: `apps/meme-factory/package.json`, `tsconfig.app.json`

**Interfaces:**
- Produces: working Vite app with Tailwind tokens, `@/` alias, Vitest configured; `npm run dev|build|test` all succeed.

- [ ] **Step 1: Scaffold and install dependencies**

```bash
cd apps
npm create vite@latest meme-factory -- --template react-ts
cd meme-factory
npm install
npm install zustand react-router-dom konva react-konva@19 onnxruntime-web@1.21.0 jszip idb-keyval
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @types/node
```

- [ ] **Step 2: Configure Vite, alias, Tailwind, Vitest**

`vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
  },
})
```

Add `tests/setup.ts` with `import '@testing-library/jest-dom/vitest'`. Add `"types": ["vitest/globals"]` to `tsconfig.app.json`.

`src/styles/index.css`:

```css
@import "tailwindcss";

@font-face {
  font-family: "Smiley Sans";
  src: url("../assets/fonts/SmileySans-Oblique.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}

@theme {
  --color-alert: #e8ff00;
  --color-ink: #111111;
  --color-paper: #f7f5ef;
  --color-danger: #ff3b30;
  --font-display: "Smiley Sans", "Microsoft YaHei", sans-serif;
  --font-sans: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

html, body, #root { height: 100%; }
body { background: var(--color-paper); color: var(--color-ink); }
```

Update `package.json` scripts:

```json
{
  "dev": "node scripts/copy-ort.mjs && vite",
  "build": "node scripts/copy-ort.mjs && tsc -b && vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "preview": "vite preview"
}
```

`scripts/copy-ort.mjs`:

```js
import { cpSync, mkdirSync } from 'node:fs'
mkdirSync('public/ort', { recursive: true })
for (const f of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
  cpSync(`node_modules/onnxruntime-web/dist/${f}`, `public/ort/${f}`)
}
```

Add `public/ort/` to `apps/meme-factory/.gitignore`.

- [ ] **Step 3: Minimal App shell + smoke test**

`src/App.tsx` renders `<HashRouter>` with route `/` showing `斗图军火库` and tagline `别偷图了，造你自己的`. `src/main.tsx` imports `./styles/index.css` and renders `<App />`.

`tests/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import App from '@/App'

test('renders brand', () => {
  render(<App />)
  expect(screen.getByText('斗图军火库')).toBeInTheDocument()
})
```

- [ ] **Step 4: Verify**

Run: `npm run test` → 1 passed. Run: `npm run build` → succeeds. Start `npm run dev`, open `http://localhost:5173` via chrome-devtools MCP, screenshot home, then stop the server.

- [ ] **Step 5: Commit**

```bash
git add apps/meme-factory
git commit -m "feat(app): scaffold Vite React app with Tailwind, Konva, ONNX runtime"
```

---

### Task 2: Deploy smoke test to Qoder Sites (M1)

**Files:**
- Modify: `docs/build-log.md` (create), `README.md` (live link placeholder only after URL exists)

**Interfaces:**
- Produces: public Qoder Sites URL serving the scaffold; confirms hosting limits and asset serving before heavy work.

- [ ] **Step 1: Deploy scaffold**

Invoke `Skill sites:sites-building` and follow its instructions for `apps/meme-factory` (static Vite build). Then `Skill sites:sites-hosting` to publish. Use site name `meme-arsenal` if free (`check_subdomain`).

- [ ] **Step 2: Verify public URL**

Open the URL in a fresh browser tab (incognito if available). Confirm `斗图军火库` renders and `/ort/` 404 is irrelevant at this stage. Check downloaded JS size and record any platform limits surfaced by the tools.

- [ ] **Step 3: Write build log + commit**

`docs/build-log.md` entry: date, what was deployed, URL, platform limits learned, screenshots path. Commit:

```bash
git add docs/build-log.md README.md
git commit -m "docs: record M1 Qoder Sites deployment smoke test"
```

---

### Task 3: Scene model + undoable editor store (TDD)

**Files:**
- Create: `src/lib/scene.ts`, `src/store/editorStore.ts`, `tests/scene.test.ts`, `tests/editorStore.test.ts`

**Interfaces:**
- Produces:
  - `type FontId = 'smiley' | 'system'`
  - `interface PhotoFilters { brightness: number; contrast: number; saturation: number; grayscale: boolean }`
  - `type Background = { kind:'none' } | { kind:'solid'; color:string } | { kind:'gradient'; from:string; to:string; angle:number } | { kind:'pattern'; pattern:'dots'|'stripes'|'paper'; fg:string; bg:string }`
  - `interface TextBackdrop { fill:string; stroke:string; strokeWidth:number; radius:number }`
  - `type ElementBase = { id:string; x:number; y:number; rotation:number; scaleX:number; scaleY:number }`
  - `interface PhotoElement extends ElementBase { type:'photo'; width:number; height:number; flipX:boolean; frame:boolean; filters:PhotoFilters }`
  - `interface TextElement extends ElementBase { type:'text'; text:string; fontFamily:FontId; fontSize:number; fill:string; stroke:string; strokeWidth:number; backdrop:TextBackdrop|null; maxWidth:number; align:'left'|'center'|'right' }`
  - `interface StickerElement extends ElementBase { type:'sticker'; stickerId:string; fill:string; size:number }`
  - `type SceneElement = PhotoElement | TextElement | StickerElement`
  - `interface Scene { background: Background; elements: SceneElement[] }`
  - `emptyScene()`, `createPhotoElement(width,height)`, `createTextElement(text, overrides?)`, `createStickerElement(stickerId, x, y)`, `newId()`
  - `useEditorStore`: `{ scene, selectedId, past, future, commit(next), undo(), redo(), select(id), reset(scene) }`, history limit 50.

- [ ] **Step 1: Write failing store tests**

```ts
import { beforeEach, describe, expect, test } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import { createTextElement, emptyScene } from '@/lib/scene'

const store = () => useEditorStore.getState()

beforeEach(() => store().reset(emptyScene()))

test('commit pushes previous scene to past and clears future', () => {
  const s0 = store().scene
  const s1 = { ...s0, background: { kind: 'solid', color: '#fff' } as const }
  store().commit(s1)
  expect(store().scene).toBe(s1)
  expect(store().past).toHaveLength(1)
  expect(store().future).toHaveLength(0)
})

test('undo and redo restore scenes', () => {
  const s0 = store().scene
  const s1 = { ...s0, elements: [createTextElement('就这？')] }
  store().commit(s1)
  store().undo()
  expect(store().scene).toEqual(s0)
  store().redo()
  expect(store().scene).toBe(s1)
})

test('history is capped at 50', () => {
  for (let i = 0; i < 60; i++) {
    store().commit({ ...store().scene, elements: [createTextElement(`t${i}`)] })
  }
  expect(store().past).toHaveLength(50)
})
```

`tests/scene.test.ts` asserts factories produce unique ids, photo element centered at 540,540 with `frame: false`, text defaults to Smiley font with white fill and black stroke.

- [ ] **Step 2: Run tests, verify failure**

Run: `npm run test -- tests/editorStore.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement scene.ts + editorStore.ts**

Use immutable snapshots (`structuredClone` not required; scenes are treated immutably). `commit(next)` stores the previous scene in `past` with slice keeping last 50. `undo`/`redo` swap scenes and clear `selectedId`. All factories return plain objects with `newId()` = `crypto.randomUUID()` (test env has it).

- [ ] **Step 4: Run tests**

Run: `npm run test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/meme-factory/src/lib/scene.ts apps/meme-factory/src/store apps/meme-factory/tests
git commit -m "feat(core): scene model and undoable editor store"
```

---

### Task 4: Chinese-aware text fitting (TDD)

**Files:**
- Create: `src/lib/fitText.ts`, `tests/fitText.test.ts`

**Interfaces:**
- Produces: `fitText(text: string, opts: { maxWidth: number; maxLines: number; maxFontSize: number; minFontSize: number; fontFamily: string; fontWeight: number }, measure: (text: string, font: string) => number): { lines: string[]; fontSize: number }`
- Consumed by: renderer (Task 6), Konva text nodes (Task 9), pack thumbnails (Task 11).

- [ ] **Step 1: Write failing tests**

Use a fake measure where width = `text.length * fontSize * (font.includes('Smiley') ? 1 : 0.6)`.

```ts
import { fitText } from '@/lib/fitText'

const measure = (t: string, font: string) => {
  const size = Number(font.match(/(\d+)px/)![1])
  return t.length * size
}
const base = { maxWidth: 200, maxLines: 2, maxFontSize: 100, minFontSize: 24, fontFamily: 'Smiley', fontWeight: 700 }

test('shrinks font until two lines fit', () => {
  const r = fitText('就这就这就这', { ...base, maxWidth: 300 }, measure)
  expect(r.lines.length).toBeLessThanOrEqual(2)
  expect(r.fontSize).toBeLessThanOrEqual(100)
  expect(r.lines.join('')).toBe('就这就这就这')
})

test('wraps by character and never exceeds max width', () => {
  const r = fitText('一二三四五六七八', { ...base, maxFontSize: 60 }, measure)
  for (const line of r.lines) expect(measure(line, `700 ${r.fontSize}px Smiley`)).toBeLessThanOrEqual(300)
})

test('truncates with ellipsis when even minimum does not fit', () => {
  const r = fitText('很长'.repeat(40), { ...base, maxWidth: 50, minFontSize: 40 }, measure)
  expect(r.lines.at(-1)!.endsWith('…')).toBe(true)
  expect(r.fontSize).toBe(40)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- tests/fitText.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Loop `size` from `maxFontSize` down to `minFontSize` (step 1); wrap characters greedily using `measure`; when wrapped lines ≤ `maxLines`, return. At min size, keep first `maxLines` lines and ellipsize the last line until it fits.

- [ ] **Step 4: Pass + commit**

Run tests → pass.

```bash
git add apps/meme-factory/src/lib/fitText.ts apps/meme-factory/tests/fitText.test.ts
git commit -m "feat(core): chinese-aware auto text fitting"
```

---

### Task 5: Content data — templates, stickers, packs (TDD)

**Files:**
- Create: `src/data/templates.ts`, `src/data/stickers.ts`, `src/data/packs.ts`, `tests/content.test.ts`

**Interfaces:**
- Produces:
  - `type TemplateId = 'classic'|'neon'|'warning'|'bubble'|'scrapbook'|'crush'`
  - `interface VisualTemplate { id: TemplateId; name: string; background: Background; text: Pick<TextElement,'fontFamily'|'fontSize'|'fill'|'stroke'|'strokeWidth'|'backdrop'|'align'> & { rotate: number }; accentStickers: Array<{ stickerId: string; x: number; y: number; size: number; rotation: number; fill?: string }> }`
  - `TEMPLATES: Record<TemplateId, VisualTemplate>`
  - `interface StickerDef { id: string; name: string; d: string; colorable: boolean; defaultFill: string }`, `STICKERS: StickerDef[]` (22 items, 100×100 viewBox)
  - `type PackId = 'dorm'|'class'|'work'|'speechless'|'beg'|'food'`
  - `interface PackDef { id: PackId; name: string; tagline: string; templateId: TemplateId; captions: string[] }`, `PACKS: PackDef[]`
  - `getSticker(id): StickerDef | undefined`

- [ ] **Step 1: Write data integrity tests**

```ts
import { PACKS } from '@/data/packs'
import { TEMPLATES } from '@/data/templates'
import { STICKERS, getSticker } from '@/data/stickers'

test('6 packs with 10 unique captions each, valid templates', () => {
  expect(PACKS).toHaveLength(6)
  for (const p of PACKS) {
    expect(p.captions).toHaveLength(10)
    expect(new Set(p.captions).size).toBe(10)
    expect(TEMPLATES[p.templateId]).toBeDefined()
    for (const c of p.captions) expect(c.length).toBeLessThanOrEqual(18)
  }
})

test('6 templates and >=20 valid stickers', () => {
  expect(Object.keys(TEMPLATES)).toHaveLength(6)
  expect(STICKERS.length).toBeGreaterThanOrEqual(20)
  for (const s of STICKERS) {
    expect(s.d.startsWith('M')).toBe(true)
    expect(new Set(STICKERS.map(x => x.id)).size).toBe(STICKERS.length)
  }
})

test('template accents reference existing stickers', () => {
  for (const t of Object.values(TEMPLATES)) {
    for (const a of t.accentStickers) expect(getSticker(a.stickerId)).toBeDefined()
  }
})
```

- [ ] **Step 2: Implement content**

Templates: `classic` (transparent bg, Smiley 96px white fill + 10px black stroke, top), `neon` (transparent bg, black text on `#E8FF00` backdrop, rotate -4, bottom), `warning` (stripes bg, black text on yellow backdrop, center), `bubble` (none bg, black text on white backdrop stroke 6 radius 32, bottom, speech-burst accent bottom-right), `scrapbook` (paper pattern bg, ink text, top, tape accents), `crush` (gradient `#ffd6e8`→`#e8d6ff`, white fill + `#ff3b8d` stroke, bottom, hearts accents).

Pack → template mapping: `dorm → scrapbook`, `class → neon`, `work → warning`, `speechless → bubble`, `beg → crush`, `food → classic`. Taglines: dorm `室友看了想打人`, class `群里发这个最安全`, work `打工人的电子嘴替`, speechless `一句顶一万句`, beg `卑微求生专用`, food `干饭人的仪式感`.

Packs and captions (use verbatim):

```ts
dorm:       起床是不可能起床的 / 断电了 我的快乐没了 / 查寝来了 快收 / 谁又用了我的洗发水 / 宿舍WiFi又双叒叕挂了 / 上铺的呼噜震天响 / 今天也是想搬出去的一天 / 快递到了 谁帮我拿 / 熄灯了 我的夜生活才开始 / 室友的闹钟永远叫不醒他
class:      收到 / 收到请回复 / 这条通知你看到了吗 / 作业借我抄抄 / 点名了 快回来 / 小组作业我一个人扛 / @全体成员 懂的都懂 / 期末范围出来了 并没有 / 群文件里的资料又过期了 / 老师说这题很简单
work:       周一 我不想起床 / 开会两小时 结论是没有结论 / DDL是第一生产力 / 摸鱼被抓 当场社死 / 工资到账 快乐三秒 / 这个需求加一下 很简单的 / 早八人 早八魂 / 咖啡续命 续到下班 / 已读不回是最后的倔强 / 加班到深夜 地铁都没了
speechless: 就这？ / 真的会谢 / 我不理解 但我大受震撼 / 离谱 太离谱了 / 你说得对 但我不想听 / 汗流浃背了吧 老弟 / 道理我都懂 但我不听 / 原来小丑是我自己 / 这波啊 这波是白给 / 沉默 震耳欲聋
beg:        求求了 让孩子过吧 / 求带 求捞 求放过 / 老师 菜菜 捞捞 / 五一调休 求你做个人 / 求求你别再@全体了 / 保佑我 期末全过 / 球球了 别卷了 / 求救 在线等 挺急的 / 给我一个不挂科的理由 / 求投喂 饿饿 饭饭
food:       饿了 但不知道吃什么 / 奶茶续命 一天三杯 / 疯狂星期四 懂的都懂 / 外卖到了 快乐到了 / 减肥 从明天开始 / 这顿我请 下次一定 / 夜宵是灵魂的慰藉 / 火锅配快乐水 绝了 / 食堂阿姨手抖了一下 / 干饭人 干饭魂
```

Stickers: `heart, broken-heart, flame, sweat, question, exclaim, star, sparkle, tear, arrow-up, arrow-down, arrow-left, arrow-right, boom, skull, crown, coin, moon, sun, cloud, lightning, dots` — 22 hand-authored 100×100 single-path SVGs, `<path d>` only, `fill` colorable.

- [ ] **Step 3: Pass + commit**

Run: `npm run test` → pass.

```bash
git add apps/meme-factory/src/data apps/meme-factory/tests/content.test.ts
git commit -m "feat(content): templates, stickers and 60 pack captions"
```

---

### Task 6: Shared scene renderer + PNG export (TDD)

**Files:**
- Create: `src/lib/render.ts`, `src/lib/image.ts` (filter baking only in this task), `tests/render.test.ts`

**Interfaces:**
- Produces:
  - `interface RenderAssets { photo: CanvasImageSource | null; photoNatural: { width: number; height: number } }`
  - `renderScene(ctx: CanvasRenderingContext2D, scene: Scene, assets: RenderAssets, size: number): void`
  - `textLayoutFor(el: TextElement, measure): { lines: string[]; fontSize: number }` (wraps `fitText` with element defaults)
  - `drawSticker(ctx, def: StickerDef, el: StickerElement)`
  - Consumed by editor thumbnails (Task 11), export (Task 10/12).

- [ ] **Step 1: Write failing renderer tests with a recording fake ctx**

```ts
import { renderScene } from '@/lib/render'
import { createTextElement, emptyScene } from '@/lib/scene'
import { TEMPLATES } from '@/data/templates'

function fakeCtx() {
  const texts: Array<{ text: string; x: number; y: number }> = []
  const ops: string[] = []
  const ctx = {
    save: () => ops.push('save'), restore: () => ops.push('restore'),
    translate: () => ops.push('translate'), rotate: () => ops.push('rotate'),
    scale: () => ops.push('scale'), drawImage: () => ops.push('drawImage'),
    fillRect: () => ops.push('fillRect'), beginPath: () => ops.push('beginPath'),
    fill: () => ops.push('fill'), stroke: () => ops.push('stroke'),
    fillText: (t: string, x: number, y: number) => texts.push({ text: t, x, y }),
    strokeText: () => ops.push('strokeText'),
    measureText: (t: string) => ({ width: t.length * 10 }),
    setTransform: () => {}, clearRect: () => {}, roundRect: () => {},
  } as unknown as CanvasRenderingContext2D
  return { ctx, texts, ops }
}

test('renders photo then text with palette background', () => {
  const scene = { ...emptyScene(), background: { kind: 'solid', color: '#fff' } as const, elements: [createTextElement('就这？')] }
  const { ctx, texts, ops } = fakeCtx()
  renderScene(ctx, scene, { photo: {} as CanvasImageSource, photoNatural: { width: 800, height: 800 } }, 1080)
  expect(ops[0]).toBe('fillRect')
  expect(texts[0].text).toBe('就这？')
})

test('applies template backdrop before text', () => {
  const t = TEMPLATES.classic
  const el = { ...createTextElement('收到', { ...t.text, backdrop: { fill: '#fff', stroke: '#000', strokeWidth: 4, radius: 20 } }) }
  const scene = { ...emptyScene(), elements: [el] }
  const { ctx, ops } = fakeCtx()
  renderScene(ctx, scene, { photo: null, photoNatural: { width: 1, height: 1 } }, 1080)
  expect(ops.indexOf('fill')).toBeGreaterThan(-1)
  expect(ops.at(-1)).toBe('restore')
})
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement renderer**

Order: clear → background (solid/gradient via `createLinearGradient` using angle; patterns drawn procedurally: dots grid, diagonal stripes, paper speckles) → elements in array order:
- photo: translate(x,y) rotate(rotation) scale(flipX?-scaleX:scaleX, scaleY) drawImage centered at natural size scaled; when `frame === true`, stroke a 12px white rounded rect around the photo bounds first (frame mode);
- text: compute layout, translate/rotate, fill backdrop rounded rect, then per line `fillText` with `strokeText` when strokeWidth > 0, `textAlign` from element, font string `${fontWeight} ${fontSize}px ${fontFamilyCss}`; use `lineHeight = 1.15`;
- sticker: Path2D from `d`, translate/scale/rotate, fill.

`image.ts` in this task adds `bakeFilters(bitmap, filters): HTMLCanvasElement` using a canvas + `ctx.filter` string, used before rendering photo when filters are non-default.

- [ ] **Step 4: Pass + commit**

```bash
git add apps/meme-factory/src/lib/render.ts apps/meme-factory/src/lib/image.ts apps/meme-factory/tests/render.test.ts
git commit -m "feat(render): shared canvas scene renderer"
```

---

### Task 7: Upload pipeline (TDD helpers + UI)

**Files:**
- Create: `src/lib/image.ts` (extend), `src/features/upload/UploadDropzone.tsx`, `tests/image.test.ts`

**Interfaces:**
- Produces:
  - `validateFile(file: File): { ok: true } | { ok: false; reason: string }` accepts `image/jpeg|png|webp`, ≤20MB.
  - `fitWithin(w: number, h: number, max: number): { width: number; height: number }` never upscales.
  - `decodeImage(file: Blob): Promise<ImageBitmap>` using `createImageBitmap(file, { imageOrientation: 'from-image' })`.
  - `toScaledBlob(bitmap, max=1600): Promise<Blob>` PNG.
  - `<UploadDropzone onPhoto(blob: Blob): void />` — click, drag/drop, `capture="environment"` on mobile, error toasts.

- [ ] **Step 1: Failing tests**

```ts
import { fitWithin, validateFile } from '@/lib/image'

test('fitWithin keeps aspect and never upscales', () => {
  expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
  expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
})

test('validateFile rejects non-images and oversize', () => {
  const make = (type: string, size: number) => new File([new Uint8Array(1)], 'x', { type })
  expect(validateFile(make('image/png', 10)).ok).toBe(true)
  expect(validateFile(make('text/plain', 10))).toEqual({ ok: false, reason: '请上传 JPG / PNG / WebP 图片' })
  expect(validateFile(new File([new Uint8Array(21 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })).ok).toBe(false)
})
```

- [ ] **Step 2: Implement + UI**

Dropzone visual: dashed ink border on paper, sticker-style "把照片拖进来" with camera icon; shows validation errors inline. Use `URL.createObjectURL` preview thumb before decode.

- [ ] **Step 3: Verify in browser + commit**

Run tests; in dev server verify drag/drop and file picker with a local image via chrome-devtools MCP `upload_file`.

```bash
git add apps/meme-factory/src/lib/image.ts apps/meme-factory/src/features/upload apps/meme-factory/tests/image.test.ts
git commit -m "feat(upload): validated photo dropzone and image pipeline"
```

---

### Task 8: On-device cutout engine (u2netp)

**Files:**
- Create: `src/features/cutout/onnxCutout.ts`, `tests/cutout.test.ts`, `scripts/fetch-model.mjs`
- Add: `public/models/u2netp.onnx` (4,574,861 bytes), `public/models/LICENSE-u2net.txt`

**Interfaces:**
- Produces: `removeBackground(image: Blob, opts: { onProgress?: (p: { stage: 'download'|'inference'; percent?: number }) => void; signal?: AbortSignal }): Promise<Blob>` returns a PNG blob with alpha.
- Internals: `toCHWFloat32(rgba: Uint8ClampedArray, size: number): Float32Array`; `maskToAlpha(mask: Float32Array): Uint8ClampedArray`.
- `preloadModel(onProgress?): Promise<void>` caches the model bytes in Cache Storage key `meme-arsenal-model-v1`.

- [ ] **Step 1: Fetch model and license**

```bash
mkdir -p public/models
curl -L -o public/models/u2netp.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
# expected size: 4574861 bytes
```

`public/models/LICENSE-u2net.txt` states U-2-Net is Apache-2.0, source `https://github.com/xuebinqin/U-2-Net`, ONNX export via rembg.

- [ ] **Step 2: Failing tests for tensor math**

```ts
import { maskToAlpha, toCHWFloat32 } from '@/features/cutout/onnxCutout'

test('maskToAlpha normalizes min-max', () => {
  const a = maskToAlpha(new Float32Array([0.2, 0.4, 0.6, 0.8]))
  expect(Array.from(a)).toEqual([0, 85, 170, 255])
})

test('toCHWFloat32 produces CHW normalized tensor', () => {
  const rgba = new Uint8ClampedArray([255, 0, 0, 255]) // one pixel
  const t = toCHWFloat32(rgba, 1)
  expect(t).toHaveLength(3)
  expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 3)
  expect(t[2]).toBeCloseTo((0 - 0.406) / 0.225, 3)
})
```

- [ ] **Step 3: Implement inference pipeline**

- Lazy `const ort = await import('onnxruntime-web')`; `ort.env.wasm.wasmPaths = new URL('ort/', document.baseURI).href`; `ort.env.wasm.numThreads = 1`.
- Download model with `fetch(new URL('models/u2netp.onnx', document.baseURI))` + reader to report percent; store in `caches.open('meme-arsenal-model-v1')`; honor `signal`; if Cache Storage is unavailable, fall back to an in-memory copy.
- Draw input into 320×320 canvas (stretch), get ImageData, `toCHWFloat32`.
- `new ort.Tensor('float32', data, [1, 3, 320, 320])`; run with `session.outputNames[0]`; session created with `executionProviders: ['wasm']`, `graphOptimizationLevel: 'all'`.
- `maskToAlpha` → put into 320×320 ImageData (RGBA where RGB=255, A=alpha) → draw scaled to source size on a canvas over the original photo → `destination-in` composite → 1px blur via `ctx.filter='blur(1px)'` when drawing the mask (feather).
- Return `canvas.toBlob('image/png')`; release session tensors.

- [ ] **Step 4: Verify quality and speed in a real browser**

Dev server + chrome-devtools MCP: upload `public/samples/selfie-1.webp` (placeholder image until Task 14 generates finals; any portrait photo works for now). Measure: model download time, inference time, visual edge quality. Acceptance: person/pet cutout has no background halo at default zoom; inference <5s desktop after download. If quality is unacceptable, switch to `isnet` quantized ONNX and repeat — keep the wrapper signature unchanged. Record result in build log later.

- [ ] **Step 5: Commit**

```bash
git add apps/meme-factory/src/features/cutout apps/meme-factory/tests/cutout.test.ts apps/meme-factory/public/models apps/meme-factory/scripts/fetch-model.mjs
git commit -m "feat(cutout): on-device u2netp background removal with progress"
```

---

### Task 9: Konva editor canvas (M2a)

**Files:**
- Create: `src/features/editor/EditorCanvas.tsx`, `src/features/editor/usePhotoAsset.ts`, `src/store/photoStore.ts`, `tests/editorCanvas.test.tsx` (store-level only)
- Modify: `src/lib/render.ts` (export `fontCss(fontFamily, size, fontWeight)` helper shared with Konva)

**Interfaces:**
- Consumes: `useEditorStore`, `fitText`, `getSticker`.
- Produces:
  - `usePhotoStore`: `{ original: Blob | null; cutout: Blob | null; photoUrl: string | null; setPhoto(original: Blob, cutout: Blob | null): void; clear(): void }` — creates/revokes object URLs; editor, packs page and draft saver read from here.
  - `<EditorCanvas />` — reads `usePhotoStore`, interactive 1080-design stage scaled to container; selection + Transformer; drag/scale/rotate; click empty deselects; Delete removes selected; Ctrl/Cmd+Z / Shift+Z undo/redo; Arrow keys nudge by 2px (Shift 10px).

- [ ] **Step 1: Implement stage**

- Stage sized to container (`ResizeObserver`), `Layer` scaled by `containerWidth / 1080`; convert pointer coords back by dividing by scale.
- Render elements in store order: `Konva.Image` (processed photo), `Konva.Text` (lines from `fitText`, joined with `\n`, font from `fontCss`), `Konva.Path` (sticker `d`).
- `Konva.Transformer` attached to selected node; `keepRatio` for photo/sticker; `boundBoxFunc` enforces min 40 design px.
- On `dragend/transformend/rotate` write changes through `commit()` (one history entry per gesture, throttled during drag via local state, commit on end).
- Click on node selects; click on stage deselects; Delete key removes; shortcuts ignore events when an input/textarea is focused.
- Photo asset: `usePhotoAsset` converts the current photo Blob to `HTMLImageElement` and applies `bakeFilters` when filters change (debounced 150ms).

- [ ] **Step 2: Store-level interaction test**

```tsx
test('selection and deletion flow', () => {
  const { scene, commit, select } = useEditorStore.getState()
  const el = createTextElement('就这？')
  commit({ ...scene, elements: [el] })
  select(el.id)
  expect(useEditorStore.getState().selectedId).toBe(el.id)
})
```

- [ ] **Step 3: Browser verification**

Dev server: verify drag, scale, rotate on desktop and 375×812 viewport; undo/redo; keyboard nudge. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add apps/meme-factory/src/features/editor apps/meme-factory/tests/editorCanvas.test.tsx
git commit -m "feat(editor): interactive konva canvas with transform and shortcuts"
```

---

### Task 10: Editor panels + create flow (M2b)

**Files:**
- Create: `src/features/editor/EditorPage.tsx`, `src/features/editor/panels/TemplatePanel.tsx`, `TextPanel.tsx`, `StickerPanel.tsx`, `BackgroundPanel.tsx`, `FilterPanel.tsx`, `LayersPanel.tsx`, `src/features/editor/applyTemplate.ts`, `src/lib/export.ts`, `tests/applyTemplate.test.ts`
- Modify: `src/App.tsx` (route `/create`), `src/store/editorStore.ts` (add `updateSelected(patch)` helper using `commit`)

**Interfaces:**
- `applyTemplate(scene, template, mainTextId): Scene` — removes all elements whose id starts with `accent-` (template decorations from a previous application), updates background, updates the main text element's style (keeps `text`), repositions it (`x=540`, `y`: top→170, center→540, bottom→910, plus template rotate), adds accents with ids `accent-${newId()}`. Applying the same template twice yields exactly `accentStickers.length` stickers.
- Consumes `usePhotoStore` from Task 9 (`{ original, cutout, photoUrl, setPhoto, clear }`) for the upload/cutout stages.
- `lib/export.ts`: `renderToBlob(scene, photoBitmap, size=1080): Promise<Blob>` (OffscreenCanvas with DOM fallback), `downloadBlob(blob, filename)`, `awaitFonts()` (loads Smiley Sans weights + `document.fonts.ready`), single-export filename `斗图军火库_单张.png`.
- `EditorPage` steps: upload → cutout with progress/cancel/skip → editor. Photo Blob goes to `usePhotoStore`. On skip/failure, `photo.frame = true` (defined in Task 3) — renderer and Konva both stroke a 12px white rounded border (frame mode).
- Panels:
  - TemplatePanel: 6 thumbnails (mini canvas renders of a sample scene) → `applyTemplate`.
  - TextPanel: textarea, font toggle, size slider (24–120), fill/stroke color inputs, position presets (↑ 顶部 / ↓ 底部 / ● 居中) that set `y`, add-text button.
  - StickerPanel: grid of 22 sticker buttons → adds sticker at center; selected sticker fill color picker.
  - BackgroundPanel: none/solid/gradient/pattern controls.
  - FilterPanel: brightness/contrast/saturation sliders + grayscale toggle.
  - LayersPanel: list elements with type icon, select, duplicate, delete, move up/down.
- Toolbar: back to home, undo/redo, template quick-switcher, "生成整套" link to `/packs`, "导出当前张" button (uses Task 12 export once available; until then disabled with tooltip "先完成整套页"? No — implement single export here via Task 6 renderer: `exportSingle(scene, photo, 1080)`; add to `lib/export.ts` in this task).

`lib/export.ts`: `renderToBlob(scene, photoBitmap, size=1080): Promise<Blob>` (OffscreenCanvas with DOM fallback), `downloadBlob(blob, filename)`, `awaitFonts()` (`document.fonts.load('700 96px "Smiley Sans"')` + `document.fonts.ready`).

- [ ] **Step 1: Failing applyTemplate test**

```ts
import { applyTemplate } from '@/features/editor/applyTemplate'
import { createTextElement, emptyScene } from '@/lib/scene'
import { TEMPLATES } from '@/data/templates'

test('applyTemplate swaps background/style, keeps text and ignores accents already present', () => {
  const el = createTextElement('收到')
  const scene = { ...emptyScene(), elements: [el] }
  const next = applyTemplate(scene, TEMPLATES.neon, el.id)
  expect(next.background).toEqual(TEMPLATES.neon.background)
  expect((next.elements.find(e => e.id === el.id) as any).text).toBe('收到')
  const again = applyTemplate(next, TEMPLATES.neon, el.id)
  expect(again.elements.filter(e => e.type === 'sticker')).toHaveLength(TEMPLATES.neon.accentStickers.length)
})
```

- [ ] **Step 2: Implement panels + flow**

Cutout stage UI: photo preview with progress bar (下载模型 42% / 正在抠图…), buttons 取消/跳过. Errors show retry + 不抠图继续. Cancel aborts fetch/session and proceeds frame mode.

Frame mode implementation: `PhotoElement.frame: boolean`; renderer draws white 12px rounded border; Konva mirrors.

- [ ] **Step 3: Browser verification golden path**

Upload → cutout → template switch → edit text → move sticker → undo → export PNG. Verify downloaded PNG is 1080×1080 and looks like the editor.

- [ ] **Step 4: Commit + push milestone**

```bash
git add apps/meme-factory/src
git commit -m "feat(editor): panels, templates, create flow and single export"
git push
```

---

### Task 11: Pack page — themed batch generation

**Files:**
- Create: `src/features/packs/PackPage.tsx`, `src/features/packs/PackGrid.tsx`, `src/features/packs/buildPackScene.ts`, `tests/buildPackScene.test.ts`
- Modify: `src/App.tsx` (route `/packs`)

**Interfaces:**
- `buildPackScene(photo: PhotoElement, pack: PackDef, caption: string): Scene` — template background + photo (copied, positioned center) + caption text (template style) + accent stickers with fresh ids.
- `PackPage`: theme cards (6) → selects a pack; reads the photo element from `useEditorStore` and the photo bitmap from `usePhotoStore`; generates `Scene[]` for 10 captions; grid of `<canvas>` thumbnails (480px renders, generated once with `renderScene`); per-cell "换文案" cycles to next caption and re-renders; button "打包下载 ZIP"; button "单张下载". If `usePhotoStore.original` is null, show "先去做一张" linking to `/create`.

- [ ] **Step 1: Failing test**

```ts
import { buildPackScene } from '@/features/packs/buildPackScene'
import { PACKS } from '@/data/packs'
import { createPhotoElement } from '@/lib/scene'

test('builds a scene with template background, photo and caption text', () => {
  const photo = createPhotoElement(800, 800)
  const scene = buildPackScene(photo, PACKS[0], PACKS[0].captions[3])
  expect(scene.background).toEqual(TEMPLATES[PACKS[0].templateId].background)
  expect(scene.elements.some(e => e.type === 'photo')).toBe(true)
  const text = scene.elements.find(e => e.type === 'text') as any
  expect(text.text).toBe(PACKS[0].captions[3])
})
```

- [ ] **Step 2: Implement UI**

Requires a photo: if `usePhotoStore.original` is null, show "先去做一张" with link to `/create`. Thumbnails render via shared renderer; revoke object URLs on regenerate. Caption cycling: keep `captionIndex` per cell in local state; next index = `(i+1) % 10`.

- [ ] **Step 3: Browser verification + commit**

```bash
git add apps/meme-factory/src/features/packs apps/meme-factory/tests/buildPackScene.test.ts
git commit -m "feat(packs): themed sticker pack generation with grid preview"
```

---

### Task 12: ZIP export

**Files:**
- Create: `src/lib/filename.ts`, `src/lib/zip.ts`, `tests/zip.test.ts`
- Modify: `src/features/packs/PackPage.tsx` (wire download)

**Interfaces:**
- `sanitizeFileName(input: string): string` strips `\\ / : * ? " < > |` and control chars, trims dots/spaces, falls back to `未命名`.
- `buildPackZip(scenes: Scene[], photo, pack: PackDef, onProgress: (pct: number) => void): Promise<Blob>` — renders each scene to PNG via `renderToBlob`, names `斗图军火库_{packName}_{01..10}.png`, adds `使用说明.txt` starting with `\uFEFF`.
- `buildZipFromBlobs(files: Array<{ name: string; blob: Blob }>, readme: string): Promise<Blob>` — pure JSZip assembly helper exported so Vitest can assert the manifest without canvas.
- UI: progress bar, cancel not supported (short operation), failure falls back to sequential downloads.

- [ ] **Step 1: Failing tests**

```ts
import { sanitizeFileName } from '@/lib/filename'

test('sanitizes invalid filename characters', () => {
  expect(sanitizeFileName('宿舍/生存')).toBe('宿舍生存')
  expect(sanitizeFileName('  a:b*c?  ')).toBe('abc')
  expect(sanitizeFileName('...')).toBe('未命名')
})
```

`tests/zip.test.ts` uses `buildZipFromBlobs` (exported pure helper) to assert entries include all 10 names + 说明.txt, and that 说明.txt contains APP_NAME.

- [ ] **Step 2: Implement + verify downloaded zip**

Download in browser, unzip via `unzip -l` and inspect one PNG dimensions with `file` or Node script. Verify 1080×1080.

- [ ] **Step 3: Commit**

```bash
git add apps/meme-factory/src/lib/filename.ts apps/meme-factory/src/lib/zip.ts apps/meme-factory/tests apps/meme-factory/src/features/packs
git commit -m "feat(export): zip pack export with progress and fallback"
```

---

### Task 13: Draft persistence (M3)

**Files:**
- Create: `src/lib/serialize.ts`, `src/lib/storage.ts`, `src/store/useDraftAutosave.ts`, `tests/serialize.test.ts`
- Modify: `src/features/home/HomePage.tsx` (resume card — Home arrives in Task 14; add resume card then), `src/features/editor/EditorPage.tsx`

**Interfaces:**
- `serializeScene(scene: Scene): string` / `parseScene(json: string): Scene | null` with `{ version: 1, scene }` envelope; invalid input returns null.
- `saveDraft({ sceneJson, photo: Blob, cutout: Blob | null }): Promise<void>`; `loadDraft(): Promise<Draft | null>`; `clearDraft()` — idb-keyval keys `draft-meta`, `draft-photo`, `draft-cutout`. Source blobs come from `usePhotoStore`; restoring a draft calls `usePhotoStore.setPhoto(original, cutout)`, `useEditorStore.reset(scene)` and navigates to `/create` (photo state lives outside the editor store, so reset does not drop it).
- `useDraftAutosave(enabled: boolean)` — throttled 1s on scene changes.

- [ ] **Step 1: Failing tests**

```ts
import { parseScene, serializeScene } from '@/lib/serialize'
import { createTextElement, emptyScene } from '@/lib/scene'

test('round-trips a scene', () => {
  const scene = { ...emptyScene(), elements: [createTextElement('收到')] }
  expect(parseScene(serializeScene(scene))).toEqual(scene)
})

test('rejects malformed payloads', () => {
  expect(parseScene('not json')).toBeNull()
  expect(parseScene(JSON.stringify({ version: 2 }))).toBeNull()
  expect(parseScene(JSON.stringify({ version: 1, scene: { background: { kind: 'none' } } }))).toBeNull()
})
```

- [ ] **Step 2: Implement + browser verify**

Reload page mid-edit; "继续上次创作" restores photo, cutout and layout. IndexedDB unavailable → silent no-op.

- [ ] **Step 3: Commit + push milestone**

```bash
git add apps/meme-factory/src/lib/serialize.ts apps/meme-factory/src/lib/storage.ts apps/meme-factory/src/store/useDraftAutosave.ts apps/meme-factory/tests/serialize.test.ts
git commit -m "feat(persistence): local draft autosave and resume"
git push
```

---

### Task 14: Home page, samples, visual identity

**Files:**
- Create: `src/features/home/HomePage.tsx`, `src/components/*` (Layout, Logo, Badge, Modal, Button), `src/features/about/AboutModal.tsx`, `public/samples/*.webp`, `scripts/optimize-samples.mjs`
- Modify: `src/App.tsx`, `src/styles/index.css` (decorative utilities), `index.html` (title/description/theme-color)

**Interfaces:**
- Home: hero headline + tagline, primary CTA 造我的表情包 (`/create`), secondary 先看看整套 (`/packs`), 3 sample cards each with "拿这个玩玩" (fetches `new URL('samples/<name>.webp', document.baseURI)` and loads the blob into `/create`), privacy badge "照片不出你的浏览器", "继续上次创作" when a draft exists, footer with About/隐私/Qoder 说明.
- About modal: what it is, privacy statement (no upload/no analytics), Qoder build note, font/model licenses (OFL, Apache-2.0).

- [ ] **Step 1: Generate sample assets**

Use ImageGen to create 3 photos (Chinese college student selfie against plain wall; orange tabby cat on plain background; two roommates making funny faces indoors). Save to `apps/meme-factory/public/samples/` as PNG, then optimize:

```bash
node scripts/optimize-samples.mjs   # sharp: resize to 900px long edge, webp q80
```

Add `sharp` as devDependency. Record license note `docs/assets/sample-licenses.md`: AI-generated, no third-party rights.

- [ ] **Step 2: Build home + About**

Apply brand tokens, chunky 3px borders, halftone/starburst decorations, Smiley Sans display type, sticker cut-out cards. Ensure no horizontal scroll at 375px. Screenshot to `docs/assets/home-desktop.png`, `docs/assets/home-mobile.png`.

- [ ] **Step 3: Browser verification + commit**

Verify sample click → create flow; resume card appears after editing then returning home.

```bash
git add apps/meme-factory/src apps/meme-factory/public/samples apps/meme-factory/scripts apps/meme-factory/index.html docs/assets
git commit -m "feat(home): brand landing with samples, privacy and about"
```

---

### Task 15: Responsive, accessibility, motion polish

**Files:**
- Modify: editor panels (`bottom sheet` on mobile, side rail on desktop), `EditorCanvas.tsx` (touch targets), `src/styles/index.css`, various components

**Interfaces:** no new APIs; behavior-only.

- [ ] **Step 1: Mobile layout pass**

At 375×812: bottom tab bar for 模板/文字/贴纸/背景/滤镜; canvas fills width with 12px margins; panel opens as bottom sheet max-height 45vh; all primary buttons ≥44px; export accessible in top toolbar. Desktop (≥1024px): left canvas + right 320px panel column.

- [ ] **Step 2: Accessibility pass**

- Focus-visible ring on all interactive elements (2px alert color, offset).
- Keyboard: Tab order logical; Enter/Space activate; Esc closes modal/sheet; Alt+↑/↓ position presets for selected text? Provide buttons suffice.
- `prefers-reduced-motion: reduce` disables decorative animation CSS.
- Contrast check: ink on paper 16:1; black on alert 17:1; muted text ≥4.5:1.
- Images have alt text; canvas wrapper has `role="img"` + aria-label describing current design; modal has `role="dialog"` + focus trap.
- Run Lighthouse via chrome-devtools MCP `lighthouse_audit` on home and editor; record scores in build log; fix critical a11y findings.

- [ ] **Step 3: Browser verify + commit**

Screenshots mobile editor, desktop editor. Commit:

```bash
git add apps/meme-factory/src
git commit -m "feat(ux): responsive editor, accessibility and reduced motion"
```

---

### Task 16: E2E QA, performance and acceptance (M4)

**Files:**
- Create: `docs/assets/qa-checklist.md`
- Modify: fixes discovered

**Interfaces:** none.

- [ ] **Step 1: Golden path desktop**

Chrome DevTools MCP: home → sample → cutout → template → text edit → sticker → undo/redo → export single → packs → generate → cycle caption → ZIP download. Confirm single PNG and ZIP PNGs are 1080×1080.

- [ ] **Step 2: Mobile viewport path**

375×812 emulation: same path with touch-like clicks; no horizontal scroll; bottom sheets usable; export works.

- [ ] **Step 3: Failure paths**

- Block `**/models/u2netp.onnx` in DevTools network → cutout shows error → "不抠图继续" produces framed photo → export still works.
- Deny IndexedDB (private mode emulation) → app works without persistence.
- Network panel: confirm zero requests carrying image data; only same-origin static assets.

- [ ] **Step 4: Performance budget**

`npm run build`; record dist size:

```bash
node -e "const fs=require('fs'),z=require('zlib');let t=0;for(const f of fs.readdirSync('dist/assets').filter(x=>x.endsWith('.js'))){const b=fs.readFileSync('dist/assets/'+f);t+=z.gzipSync(b).length;console.log(f,(b.length/1024).toFixed(0)+'KB','gz',(z.gzipSync(b).length/1024).toFixed(0)+'KB')}console.log('total gz',(t/1024).toFixed(0)+'KB')"
```

Accept: total initial JS gzip ≤1MB (model/wasm excluded, loaded lazily). Lighthouse home LCP <2.5s locally.

- [ ] **Step 5: Fix all findings, update checklist, commit + push**

```bash
git add -A
git commit -m "test(qa): e2e acceptance, fallback paths and performance budget"
git push
```

---

### Task 17: Final deployment and submission materials (M5)

**Files:**
- Create: `docs/forum-post.md`, screenshots in `docs/assets/`, update `docs/build-log.md`, `README.md`, `apps/meme-factory/README.md`

**Interfaces:** none.

- [ ] **Step 1: Final deploy**

`Skill sites:building`/`sites-hosting` with latest build; verify public URL in a fresh incognito context on desktop + mobile; verify a full golden path online (cutout + ZIP).

- [ ] **Step 2: Update README + app README**

Root README: live link, screenshots, feature list, tech notes, local run commands, repo structure, competition info. App README: dev commands, architecture summary, asset licenses.

- [ ] **Step 3: Write forum post draft** (`docs/forum-post.md`)

Title: `【LifeHack】斗图军火库——照片不出浏览器，3 分钟造出一整套表情包`

Sections (required by competition):
1. 自我介绍（占位：学校/专业/年级 由用户填写）
2. 作品是什么（一句话 + 三个亮点：本地抠图、整套生成、零注册零上传）
3. 为什么做（宿舍/班级群斗图场景、现有工具只做单张、隐私顾虑）
4. 怎么用（5 步：打开→选示例/上传→抠图→编辑→整套导出）
5. 怎么用 Qoder 做出来的（开发过程、Qoder Sites 部署、遇到的问题与解决、Qoder 使用深度）
6. 使用的 Qoder 账号：`<待用户提供>`
7. 体验链接 + GitHub 仓库

- [ ] **Step 4: Build log final entry + screenshots**

Capture: home, editor (desktop + mobile), pack grid, exported ZIP contents, Lighthouse scores. Commit all.

- [ ] **Step 5: Final self-check against spec §10 acceptance criteria**

Write results into `docs/assets/qa-checklist.md`; fix anything failing.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "docs: final deployment, forum post draft and build log"
git push
```

**User-side remaining:** fill self-intro + Qoder account, publish forum post on Tianchi, confirm real-name/student certification.

---

## Self-Review

- **Spec coverage:** upload (§4.1 Task 7), cutout (§4.2 Task 8), editor (§4.3 Tasks 3/4/6/9/10), packs (§4.4 Task 11), export (§4.5 Tasks 6/10/12), persistence (§4.6 Task 13), visual (§5 Tasks 1/14/15), architecture (§6 Tasks 1/2/10/16), performance (§6.1 Task 16), risks (Task 8 quality gate, Task 2 size limits, single-thread ORT), content (§7 Task 5/8/14), errors (§8 Tasks 7/8/12/13/16), testing (§9 Tasks 3–8/16), acceptance (§10 Task 16/17), deliverables (§11 Task 17), milestones (§12 Tasks 2/10/13/16/17). All covered.
- **Deviations from spec, deliberate:** (a) cutout uses self-hosted u2netp + onnxruntime-web instead of imgly's 285MB asset bundle, keeping first-use download at ~10MB; (b) no WebGPU provider — 320px inference on single-thread WASM meets the <5s budget and avoids COOP/COEP requirements. Both preserve the spec's user-facing behavior (local-only, progress, skip, fallback).
- **Placeholders:** none in engineering content. Forum post intentionally has user-supplied fields (self-intro, Qoder account) marked as such.
- **Type consistency:** `renderScene(ctx, scene, assets, size)`, `renderToBlob(scene, photo, size)`, `fitText(text, opts, measure)`, `buildPackScene(photo, pack, caption)`, `removeBackground(image, { onProgress, signal })`, `serializeScene/parseScene`, `sanitizeFileName`, `saveDraft/loadDraft` are used consistently across tasks.
