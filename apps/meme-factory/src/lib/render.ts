import { getSticker } from '@/data/stickers'
import type { StickerDef } from '@/data/stickers'
import { fitText } from '@/lib/fitText'
import type { FitTextResult } from '@/lib/fitText'
import type {
  Background,
  FontId,
  PhotoElement,
  Scene,
  StickerElement,
  TextElement,
} from '@/lib/scene'

/** Reference design canvas. Scene coordinates are always authored on this grid. */
export const DESIGN_SIZE = 1080

/** Maximum wrapped lines for auto-fitted captions (matches the design spec). */
export const TEXT_MAX_LINES = 2
/** Line height multiplier shared by the canvas renderer and the Konva editor. */
export const TEXT_LINE_HEIGHT = 1.15
/** Display face weight; Smiley Sans ships a single ~700 display weight. */
export const TEXT_FONT_WEIGHT = 700
/** Auto-fit never shrinks below this size (the editor slider's lower bound). */
export const MIN_TEXT_SIZE = 24

const FRAME_WIDTH = 12
const FRAME_RADIUS = 16
const BACKDROP_PADDING_X = 28
const BACKDROP_PADDING_Y = 16

const SYSTEM_FONT_STACK =
  'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'

const FONT_FAMILY_CSS: Record<FontId, string> = {
  smiley: '"Smiley Sans"',
  system: SYSTEM_FONT_STACK,
}

export type TextMeasure = (text: string, font: string) => number

export interface RenderAssets {
  /** Photo pixels, already filtered (`bakeFilters`) by the caller when needed. */
  photo: CanvasImageSource | null
  /** Natural pixel size of the source photo (fallback for element bounds). */
  photoNatural: { width: number; height: number }
}

type PatternBackground = Extract<Background, { kind: 'pattern' }>

/** CSS font shorthand used by both canvas and the Konva text node. */
export function fontCss(
  fontFamily: FontId,
  size: number,
  fontWeight: number = TEXT_FONT_WEIGHT,
): string {
  return `${fontWeight} ${size}px ${FONT_FAMILY_CSS[fontFamily]}`
}

/**
 * Shared caption layout: per-character wrapping and font shrinking, capped at
 * two lines. `measure` receives the exact CSS font shorthand to measure with.
 */
export function textLayoutFor(el: TextElement, measure: TextMeasure): FitTextResult {
  return fitText(
    el.text,
    {
      maxWidth: el.maxWidth,
      maxLines: TEXT_MAX_LINES,
      maxFontSize: el.fontSize,
      minFontSize: Math.min(MIN_TEXT_SIZE, el.fontSize),
      fontFamily: FONT_FAMILY_CSS[el.fontFamily],
      fontWeight: TEXT_FONT_WEIGHT,
    },
    measure,
  )
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Mulberry32: tiny deterministic PRNG for the paper texture. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gradientEndpoints(
  size: number,
  angle: number,
): [number, number, number, number] {
  // CSS convention: 0deg points up, 90deg points right.
  const radians = toRadians(angle)
  const dx = Math.sin(radians)
  const dy = -Math.cos(radians)
  const half = ((Math.abs(dx) + Math.abs(dy)) * size) / 2
  const center = size / 2
  return [center - dx * half, center - dy * half, center + dx * half, center + dy * half]
}

function drawDots(ctx: CanvasRenderingContext2D, size: number, scale: number): void {
  const step = 54 * scale
  const radius = 5 * scale
  let row = 0
  for (let y = step / 2; y < size; y += step) {
    const offset = row % 2 === 0 ? 0 : step / 2
    for (let x = step / 2 + offset; x < size; x += step) {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    row += 1
  }
}

function drawStripes(ctx: CanvasRenderingContext2D, size: number, scale: number): void {
  const extent = size * 1.2
  const stripe = 28 * scale
  const step = 56 * scale
  ctx.translate(size / 2, size / 2)
  ctx.rotate(-Math.PI / 4)
  for (let x = -extent; x < extent; x += step) {
    ctx.fillRect(x, -extent, stripe, extent * 2)
  }
}

function drawPaper(ctx: CanvasRenderingContext2D, size: number, scale: number): void {
  const random = seededRandom(0x51ed270b)
  const count = Math.max(60, Math.round(180 * scale * scale))
  for (let i = 0; i < count; i += 1) {
    const x = random() * size
    const y = random() * size
    const radius = (0.6 + random() * 1.8) * scale
    ctx.globalAlpha = 0.18 + random() * 0.3
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawPatternBackground(
  ctx: CanvasRenderingContext2D,
  background: PatternBackground,
  size: number,
): void {
  ctx.fillStyle = background.bg
  ctx.fillRect(0, 0, size, size)

  const scale = size / DESIGN_SIZE
  ctx.save()
  ctx.fillStyle = background.fg
  if (background.pattern === 'dots') drawDots(ctx, size, scale)
  else if (background.pattern === 'stripes') drawStripes(ctx, size, scale)
  else drawPaper(ctx, size, scale)
  ctx.restore()
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  background: Background,
  size: number,
): void {
  switch (background.kind) {
    case 'none':
      return
    case 'solid':
      ctx.fillStyle = background.color
      ctx.fillRect(0, 0, size, size)
      return
    case 'gradient': {
      const [x0, y0, x1, y1] = gradientEndpoints(size, background.angle)
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
      gradient.addColorStop(0, background.from)
      gradient.addColorStop(1, background.to)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
      return
    }
    case 'pattern':
      drawPatternBackground(ctx, background, size)
  }
}

function applyElementTransform(
  ctx: CanvasRenderingContext2D,
  el: PhotoElement | TextElement,
  size: number,
): void {
  const scale = size / DESIGN_SIZE
  ctx.translate(el.x * scale, el.y * scale)
  ctx.rotate(toRadians(el.rotation))
  const flipX = el.type === 'photo' && el.flipX ? -1 : 1
  ctx.scale(el.scaleX * scale * flipX, el.scaleY * scale)
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  el: PhotoElement,
  assets: RenderAssets,
): void {
  const { photo, photoNatural } = assets
  if (!photo) return

  const naturalWidth = photoNatural.width > 0 ? photoNatural.width : 1
  const naturalHeight = photoNatural.height > 0 ? photoNatural.height : 1
  const width = el.width > 0 ? el.width : naturalWidth
  const height = el.height > 0 ? el.height : naturalHeight

  if (el.frame) {
    // 12px white frame: the stroke centre sits 6px outside the photo bounds so
    // the visible band is exactly FRAME_WIDTH wide, with nothing painted on
    // top of the photo itself.
    const inset = FRAME_WIDTH / 2
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = FRAME_WIDTH
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.roundRect(
      -width / 2 - inset,
      -height / 2 - inset,
      width + FRAME_WIDTH,
      height + FRAME_WIDTH,
      FRAME_RADIUS,
    )
    ctx.stroke()
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(photo, -width / 2, -height / 2, width, height)
}

function measureWith(ctx: CanvasRenderingContext2D): TextMeasure {
  return (text, font) => {
    ctx.font = font
    return ctx.measureText(text).width
  }
}

function drawText(ctx: CanvasRenderingContext2D, el: TextElement): void {
  const measure = measureWith(ctx)
  const layout = textLayoutFor(el, measure)
  if (layout.lines.length === 0) return

  const { lines, fontSize } = layout
  const font = fontCss(el.fontFamily, fontSize, TEXT_FONT_WEIGHT)
  const lineHeight = fontSize * TEXT_LINE_HEIGHT
  const lineWidths = lines.map((line) => measure(line, font))
  const blockWidth = Math.max(0, ...lineWidths)
  const blockHeight = lines.length * lineHeight

  if (el.backdrop) {
    const backdrop = el.backdrop
    const boxWidth = blockWidth + BACKDROP_PADDING_X * 2
    const boxHeight = blockHeight + BACKDROP_PADDING_Y * 2
    const radius = Math.max(0, Math.min(backdrop.radius, boxWidth / 2, boxHeight / 2))
    ctx.beginPath()
    ctx.roundRect(
      -blockWidth / 2 - BACKDROP_PADDING_X,
      -blockHeight / 2 - BACKDROP_PADDING_Y,
      boxWidth,
      boxHeight,
      radius,
    )
    ctx.fillStyle = backdrop.fill
    ctx.fill()
    if (backdrop.strokeWidth > 0) {
      ctx.strokeStyle = backdrop.stroke
      ctx.lineWidth = backdrop.strokeWidth
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }

  ctx.font = font
  ctx.textAlign = el.align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = el.fill
  ctx.strokeStyle = el.stroke
  ctx.lineWidth = el.strokeWidth
  ctx.lineJoin = 'round'

  const anchorX =
    el.align === 'left' ? -blockWidth / 2 : el.align === 'right' ? blockWidth / 2 : 0

  lines.forEach((line, index) => {
    const y = -blockHeight / 2 + lineHeight * (index + 0.5)
    if (el.strokeWidth > 0) ctx.strokeText(line, anchorX, y)
    ctx.fillText(line, anchorX, y)
  })
}

/**
 * Draws one SVG sticker path (100×100 viewBox) centred on the element position.
 * `size` is the output canvas size; the default matches the design canvas so
 * the helper can also be called standalone in design units.
 */
export function drawSticker(
  ctx: CanvasRenderingContext2D,
  def: StickerDef,
  el: StickerElement,
  size: number = DESIGN_SIZE,
): void {
  const scale = size / DESIGN_SIZE
  ctx.save()
  ctx.translate(el.x * scale, el.y * scale)
  ctx.rotate(toRadians(el.rotation))
  ctx.scale((el.scaleX * scale * el.size) / 100, (el.scaleY * scale * el.size) / 100)
  ctx.translate(-50, -50)
  ctx.fillStyle = el.fill
  ctx.fill(new Path2D(def.d))
  ctx.restore()
}

/**
 * Paints a whole scene. Backgrounds and elements are drawn in array order
 * (bottom to top); the scene itself is never mutated. The context is reset to
 * the identity transform first so repeated renders on one canvas are stable.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  assets: RenderAssets,
  size: number = DESIGN_SIZE,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, size, size)
  drawBackground(ctx, scene.background, size)

  for (const element of scene.elements) {
    if (element.type === 'sticker') {
      const def = getSticker(element.stickerId)
      if (def) drawSticker(ctx, def, element, size)
      continue
    }

    ctx.save()
    applyElementTransform(ctx, element, size)
    if (element.type === 'photo') drawPhoto(ctx, element, assets)
    else drawText(ctx, element)
    ctx.restore()
  }
}
