# 斗图军火库 (MemeArsenal)

一张照片，在浏览器里造出一整套原创表情包。所有图片处理都在本机完成，照片不出浏览器。

## Tech stack

React 19 + TypeScript + Vite 8 + Tailwind CSS 4. State with Zustand, canvas with Konva / react-konva, on-device background removal with onnxruntime-web, ZIP export with JSZip, drafts in IndexedDB via idb-keyval. Tests with Vitest + Testing Library.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173 (falls back to next free port)
npm run test     # Vitest, single run
npm run build    # type-check + production build in dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

`npm run dev` and `npm run build` first run `scripts/copy-ort.mjs`, which copies the
single-thread SIMD onnxruntime-web runtime (`ort-wasm-simd-threaded.wasm` and
`ort-wasm-simd-threaded.mjs`) from `node_modules` into `public/ort/` (gitignored).

## Structure

```
src/
  main.tsx              entry, imports global styles
  App.tsx               HashRouter + routes
  styles/index.css      Tailwind import, brand tokens, font-face
  assets/fonts/         Smiley Sans (OFL-1.1)
scripts/copy-ort.mjs    self-host the ORT WASM runtime
tests/                  Vitest setup and tests
```

Runtime assets are self-hosted; the app makes no third-party requests. Vite is
configured with `base: './'` so the build works from any static subpath.

## Licenses

- Smiley Sans / 得意黑: SIL Open Font License 1.1, see `src/assets/fonts/OFL-SmileySans.txt`.
