/**
 * On-device portrait cutout: u2netp (U-2-Net portable) via onnxruntime-web WASM.
 *
 * Everything is self-hosted: the model, the ORT wasm runtime and the license all
 * live under the app's own origin. Images never leave the browser.
 */

export type CutoutProgress = { stage: 'download' | 'inference'; percent?: number }

export type RemoveBackgroundOptions = {
  onProgress?: (progress: CutoutProgress) => void
  signal?: AbortSignal
}

export const MODEL_CACHE = 'meme-arsenal-model-v1'
export const MODEL_SIZE = 320
/** Exact byte length of the self-hosted u2netp.onnx binary. */
export const MODEL_BYTES = 4_574_861

const MEAN = [0.485, 0.456, 0.406] as const
const STD = [0.229, 0.224, 0.225] as const

const modelUrl = () => new URL('models/u2netp.onnx', document.baseURI).href

const abortError = () => new DOMException('抠图已取消', 'AbortError')

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError()
}

/**
 * Reject anything that is not the exact u2netp binary: a 200 HTML SPA
 * fallback, a truncated download or a corrupt cache entry would otherwise be
 * handed to onnxruntime and fail with an opaque error.
 */
export function assertModelSize(byteLength: number): void {
  if (byteLength !== MODEL_BYTES) {
    throw new Error(
      `模型文件大小异常（期望 ${MODEL_BYTES} 字节，实际 ${byteLength} 字节），请清除缓存后重试`,
    )
  }
}

/** RGBA pixels -> CHW float32 tensor normalized with ImageNet mean/std. */
export function toCHWFloat32(rgba: Uint8ClampedArray, size: number): Float32Array {
  const pixels = size * size
  const out = new Float32Array(pixels * 3)
  for (let i = 0; i < pixels; i += 1) {
    const base = i * 4
    for (let c = 0; c < 3; c += 1) {
      out[c * pixels + i] = (rgba[base + c] / 255 - MEAN[c]) / STD[c]
    }
  }
  return out
}

/** Min-max normalize a raw mask to 0..255 alpha values. */
export function maskToAlpha(mask: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask.length)
  if (mask.length === 0) return out
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < mask.length; i += 1) {
    const v = mask[i]
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min
  if (!(span > 0)) return out
  for (let i = 0; i < mask.length; i += 1) {
    out[i] = Math.round(((mask[i] - min) / span) * 255)
  }
  return out
}

let memoryModel: ArrayBuffer | null = null
let modelPromise: Promise<ArrayBuffer> | null = null

async function readCachedModel(): Promise<ArrayBuffer | null> {
  if (memoryModel) return memoryModel
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(MODEL_CACHE)
    const hit = await cache.match(modelUrl())
    if (!hit) return null
    const buffer = await hit.arrayBuffer()
    try {
      assertModelSize(buffer.byteLength)
    } catch {
      // Corrupt or truncated cache entry: evict it so the next call re-downloads.
      memoryModel = null
      await cache.delete(modelUrl())
      return null
    }
    memoryModel = buffer
    return buffer
  } catch {
    return null
  }
}

async function writeCachedModel(buffer: ArrayBuffer): Promise<void> {
  memoryModel = buffer
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(MODEL_CACHE)
    await cache.put(
      modelUrl(),
      new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream' } }),
    )
  } catch {
    // Cache Storage can be unavailable (private mode, quota); the in-memory copy is enough.
  }
}

async function downloadModel(
  onProgress?: (progress: CutoutProgress) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  throwIfAborted(signal)
  const response = await fetch(modelUrl(), { signal })
  if (!response.ok) throw new Error(`模型下载失败（HTTP ${response.status}）`)
  const total = Number(response.headers.get('Content-Length')) || 0
  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = await response.arrayBuffer()
    assertModelSize(buffer.byteLength)
    onProgress?.({ stage: 'download', percent: 100 })
    return buffer
  }
  const chunks: Uint8Array[] = []
  let received = 0
  let lastPercent = -1
  for (;;) {
    throwIfAborted(signal)
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    if (total > 0) {
      const percent = Math.min(100, Math.round((received / total) * 100))
      if (percent !== lastPercent) {
        lastPercent = percent
        onProgress?.({ stage: 'download', percent })
      }
    }
  }
  throwIfAborted(signal)
  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  assertModelSize(merged.byteLength)
  onProgress?.({ stage: 'download', percent: 100 })
  return merged.buffer
}

/** Fetch the model once and keep it in Cache Storage + memory. */
export async function preloadModel(
  onProgress?: (progress: CutoutProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  await loadModel(onProgress, signal)
}

async function loadModel(
  onProgress?: (progress: CutoutProgress) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  throwIfAborted(signal)
  const cached = await readCachedModel()
  if (cached) {
    onProgress?.({ stage: 'download', percent: 100 })
    return cached
  }
  if (!modelPromise) {
    modelPromise = downloadModel(onProgress, signal).then(async (buffer) => {
      await writeCachedModel(buffer)
      return buffer
    })
    modelPromise.catch(() => {
      modelPromise = null
    })
  }
  return modelPromise
}

type OrtModule = typeof import('onnxruntime-web')
type OrtSession = import('onnxruntime-web').InferenceSession

let ortPromise: Promise<OrtModule> | null = null
let sessionPromise: Promise<OrtSession> | null = null

function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = import('onnxruntime-web').then((ort) => {
      // The default ORT 1.21 browser bundle requests the JSEP runtime
      // (ort-wasm-simd-threaded.jsep.*), but this app self-hosts the standard
      // pair copied by scripts/copy-ort.mjs. Point wasmPaths at those exact
      // files; the wasm execution provider runs on the standard pair.
      const base = new URL('ort/', document.baseURI).href
      ort.env.wasm.wasmPaths = {
        wasm: new URL('ort-wasm-simd-threaded.wasm', base).href,
        mjs: new URL('ort-wasm-simd-threaded.mjs', base).href,
      }
      ort.env.wasm.numThreads = 1
      return ort
    })
    // A transient import/env failure must not poison cutout for the page lifetime.
    ortPromise.catch(() => {
      ortPromise = null
    })
  }
  return ortPromise
}

async function getSession(
  onProgress?: (progress: CutoutProgress) => void,
  signal?: AbortSignal,
): Promise<{ ort: OrtModule; session: OrtSession }> {
  const ort = await loadOrt()
  const buffer = await loadModel(onProgress, signal)
  throwIfAborted(signal)
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(new Uint8Array(buffer), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
    // Retry session creation on the next call instead of caching the rejection.
    sessionPromise.catch(() => {
      sessionPromise = null
    })
  }
  return { ort, session: await sessionPromise }
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  return [canvas, ctx]
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('抠图导出失败'))
    }, 'image/png')
  })
}

export async function removeBackground(
  image: Blob,
  opts: RemoveBackgroundOptions = {},
): Promise<Blob> {
  const { onProgress, signal } = opts
  throwIfAborted(signal)
  const bitmap = await createImageBitmap(image)
  try {
    const [sourceCanvas, sourceCtx] = makeCanvas(bitmap.width, bitmap.height)
    sourceCtx.drawImage(bitmap, 0, 0)

    const [inputCanvas, inputCtx] = makeCanvas(MODEL_SIZE, MODEL_SIZE)
    inputCtx.drawImage(bitmap, 0, 0, MODEL_SIZE, MODEL_SIZE)
    const input = inputCtx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE)
    inputCanvas.width = 0
    inputCanvas.height = 0

    const { ort, session } = await getSession(onProgress, signal)
    throwIfAborted(signal)
    onProgress?.({ stage: 'inference' })

    const tensor = new ort.Tensor('float32', toCHWFloat32(input.data, MODEL_SIZE), [
      1,
      3,
      MODEL_SIZE,
      MODEL_SIZE,
    ])
    const results = await session.run({ [session.inputNames[0]]: tensor }, [session.outputNames[0]])
    const output = results[session.outputNames[0]]
    const alpha = maskToAlpha(output.data as Float32Array)
    tensor.dispose()
    output.dispose()
    throwIfAborted(signal)

    const maskData = new ImageData(MODEL_SIZE, MODEL_SIZE)
    for (let i = 0; i < alpha.length; i += 1) {
      const base = i * 4
      maskData.data[base] = 255
      maskData.data[base + 1] = 255
      maskData.data[base + 2] = 255
      maskData.data[base + 3] = alpha[i]
    }
    const [maskCanvas, maskCtx] = makeCanvas(MODEL_SIZE, MODEL_SIZE)
    maskCtx.putImageData(maskData, 0, 0)

    sourceCtx.globalCompositeOperation = 'destination-in'
    sourceCtx.filter = 'blur(1px)'
    sourceCtx.imageSmoothingEnabled = true
    sourceCtx.imageSmoothingQuality = 'high'
    sourceCtx.drawImage(maskCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height)
    sourceCtx.filter = 'none'
    sourceCtx.globalCompositeOperation = 'source-over'

    return await canvasToPng(sourceCanvas)
  } finally {
    bitmap.close()
  }
}