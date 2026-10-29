import { cpSync, mkdirSync } from 'node:fs'
mkdirSync('public/ort', { recursive: true })
for (const f of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) {
  cpSync(`node_modules/onnxruntime-web/dist/${f}`, `public/ort/${f}`)
}
