# Meme Factory — Spec §10 Acceptance Checklist (Task 16B)

Date: 2026-10-29 · HEAD: `a076615` · App: `apps/meme-factory/` · Local dev: `http://localhost:5199/`

Legend: PASS = verified with the evidence listed. UNVERIFIED = not verified in this task; no pass is claimed.

| # | Spec §10 criterion | Status | Evidence |
|---|---|---|---|
| 1 | Public link opens on mobile/desktop, no login, home sample one-click | PASS | `https://meme-arsenal-h9ls3oya5li.qoder.zone` returns HTTP 200 (curl -L, 2026-10-29); local home loads with no auth and "拿这个玩玩：男大自拍" launches the sample flow in one click. Prior mobile home capture: `docs/assets/home-mobile.png` (390×844). |
| 2 | Upload → cutout (or skip) → edit → pack → export completes | PASS | 16B re-ran sample → cutout → editor → single PNG export (`已导出 1080×1080 PNG`). Pack ZIP path is covered by `tests/zip.test.ts` and `tests/buildPackScene.test.ts` (both passing) and prior artifact `docs/assets/pack-zip.png`; pack export was not re-executed in 16B. |
| 3 | Six themes, ≥8 exportable each, PNG 1080×1080, text renders correctly | PASS | `src/data/packs.ts` declares "Six themed packs x ten captions"; `tests/content.test.ts:53` asserts `PACKS` length 6; `tests/render.test.ts` (10) and `tests/buildPackScene.test.ts` (3) pass; exported PNG IHDR read as 1080×1080; visible Chinese text "就这？" rendered without offset in editor/export screenshots. No per-theme visual diff was re-run. |
| 4 | Model failure still allows edit and export (fallback) | PASS | With `public/models/u2netp.onnx` moved aside, cutout failed with "模型文件大小异常（期望 4574861 字节，实际 1344 字节）", UI offered 重试 + 不抠图继续; skip entered editor in 相框模式; single export IHDR 1080×1080. Screenshot `docs/assets/qa-fallback-frame.png` (1440×900). Model restored: 4,574,861 bytes; `git status` clean for the model. |
| 5 | Network panel confirms image data never uploaded | PASS | 78 network entries after a processed sample: all methods GET; origins only `http://localhost:5199` plus `blob:http://localhost:5199/...`; no POST/PUT/PATCH, no third-party origins. Requests were app modules, font, samples, `models/u2netp.onnx`, ORT WASM, and blob object URLs. |
| 6 | Mobile viewport core flow usable, no horizontal scroll | PASS | Prior captures: `docs/assets/home-mobile.png` 390×844, `docs/assets/qa-mobile-editor.png` 500×812. Live 500 px check (Chrome minimum window width): viewport 500, `documentElement.scrollWidth` 485, no horizontal overflow. A true 390 px live emulation was not possible with `resize_page` (Chrome clamps to 500). |
| 7 | `docs/forum-post.md` covers 5 required parts; `docs/build-log.md` records the process | PASS (draft) | `docs/forum-post.md` now covers 自我介绍 / 作品是什么 / 为什么做 / 怎么用（5 步）/ 怎么用 Qoder 做出来的 / Qoder 账号占位，`docs/build-log.md` records the M1 deployment + Lighthouse runs. Remaining user-side: fill 【请填写】 fields and publish the post on Tianchi. |

## Additional checks (outside §10)

- **IndexedDB unavailable:** UNVERIFIED in browser (overriding `indexedDB` before app boot is impractical here). Covered by unit test `tests/storage.test.ts:212` — "storage unavailable › never throws when IndexedDB is missing".
- **Hash routing:** PASS — all navigations remained `/#/`, `/#/create`, `/#/packs`.
- **Qoder attribution:** PASS — home footer shows "用 Qoder 构建 · 无账号 · 无上传" and the "用 Qoder 造出来的" section.
- **Error fallback screenshot:** `docs/assets/qa-fallback-frame.png` (frame mode, export success banner, 1080×1080).

## Test / build

- `npm run test`: 20 files, 172 tests passed.
- `npm run build`: passed (tsc + vite); entry `dist/assets/index-CsWIGt6A.js` 695.47 kB raw / 216.74 kB gzip; ORT and JSZip are separate lazy chunks (not referenced by `dist/index.html`).
