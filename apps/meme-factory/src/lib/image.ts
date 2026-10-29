import type { PhotoFilters } from '@/lib/scene'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 20 * 1024 * 1024

export type FileValidation = { ok: true } | { ok: false; reason: string }

export function validateFile(file: File): FileValidation {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, reason: '请上传 JPG / PNG / WebP 图片' }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: '图片超过 20MB，请压缩后再试' }
  }
  return { ok: true }
}

export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

export function toScaledBlob(bitmap: ImageBitmap, max = 1600): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('无法创建画布'))
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片导出失败'))
    }, 'image/png')
  })
}

/** Percent-based CSS filter string. Neutral values are omitted. */
function filterCss(filters: PhotoFilters): string {
  const parts: string[] = []
  if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`)
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`)
  if (filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`)
  if (filters.grayscale) parts.push('grayscale(100%)')
  return parts.join(' ')
}

/**
 * Bakes photo filters into an offscreen canvas once, so canvas/Konva drawing
 * reads a ready-to-use bitmap instead of applying `ctx.filter` per frame.
 */
export function bakeFilters(
  bitmap: CanvasImageSource,
  filters: PhotoFilters,
): HTMLCanvasElement {
  const source = bitmap as { width?: number; height?: number }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(typeof source.width === 'number' ? source.width : 1))
  canvas.height = Math.max(1, Math.round(typeof source.height === 'number' ? source.height : 1))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  const filter = filterCss(filters)
  if (filter) ctx.filter = filter
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}
