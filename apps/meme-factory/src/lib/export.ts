import { bakeFilters } from '@/lib/image'
import { DESIGN_SIZE, renderScene } from '@/lib/render'
import type { PhotoElement, Scene } from '@/lib/scene'

/** User-facing filename for the single-image export. */
export const SINGLE_EXPORT_FILENAME = '斗图军火库_单张.png'

const FONT_SAMPLE = '斗图军火库就这？收到'

let fontPromise: Promise<void> | null = null

/**
 * Ensures Smiley Sans is actually loaded (not merely declared) before the
 * exporter measures text. `document.fonts.ready` alone can resolve before the
 * canvas renderer requests the face, so an explicit `load()` comes first.
 */
export async function awaitFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return

  if (!fontPromise) {
    fontPromise = Promise.all([
      document.fonts.load('700 96px "Smiley Sans"', FONT_SAMPLE),
      document.fonts.load('700 24px "Smiley Sans"', FONT_SAMPLE),
    ])
      .then(() => document.fonts.ready)
      .then(() => undefined)
      .catch(() => {
        // Fonts are best-effort: export still works with the fallback stack.
        fontPromise = null
      })
  }

  await fontPromise
}

function naturalSizeOf(source: CanvasImageSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width || 1,
      height: source.naturalHeight || source.height || 1,
    }
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { width: source.width || 1, height: source.height || 1 }
  }
  const sized = source as { width?: number; height?: number }
  return {
    width: Math.max(1, Math.round(sized.width ?? 1)),
    height: Math.max(1, Math.round(sized.height ?? 1)),
  }
}

type RenderCanvas = HTMLCanvasElement | OffscreenCanvas

function createCanvas(size: number): {
  canvas: RenderCanvas
  ctx: CanvasRenderingContext2D
} {
  // Prefer OffscreenCanvas (no layout cost); fall back to a detached DOM canvas
  // for browsers without it.
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')
    if (ctx) return { canvas, ctx: ctx as unknown as CanvasRenderingContext2D }
  }

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建导出画布')
  return { canvas, ctx }
}

function canvasToBlob(canvas: RenderCanvas): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' })
  }
  return new Promise((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('导出图片失败'))
    }, 'image/png')
  })
}

/**
 * Paints the scene at `size`×`size` (default 1080) with the shared Canvas2D
 * renderer, so the PNG is pixel-identical to the editor preview. Photo filters
 * are baked once before drawing; the scene itself is not mutated.
 */
export async function renderToBlob(
  scene: Scene,
  photoSource: CanvasImageSource | null = null,
  size: number = DESIGN_SIZE,
): Promise<Blob> {
  await awaitFonts()

  const photoElement =
    scene.elements.find((element): element is PhotoElement => element.type === 'photo') ?? null
  const photo =
    photoSource && photoElement ? bakeFilters(photoSource, photoElement.filters) : photoSource

  const { canvas, ctx } = createCanvas(size)
  renderScene(
    ctx,
    scene,
    {
      photo: photo ?? null,
      photoNatural: photoSource ? naturalSizeOf(photoSource) : { width: 1, height: 1 },
    },
    size,
  )

  return canvasToBlob(canvas)
}

/** Triggers a browser download for `blob`. Safe for object URLs of any size. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser time to start the download before revoking the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** One-shot single export: renders at 1080 and downloads the standard name. */
export async function exportSingle(
  scene: Scene,
  photoSource: CanvasImageSource | null,
  size: number = DESIGN_SIZE,
): Promise<Blob> {
  const blob = await renderToBlob(scene, photoSource, size)
  downloadBlob(blob, SINGLE_EXPORT_FILENAME)
  return blob
}
