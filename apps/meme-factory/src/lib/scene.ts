export type FontId = 'smiley' | 'system'

export interface PhotoFilters {
  brightness: number
  contrast: number
  saturation: number
  grayscale: boolean
}

export type Background =
  | { kind: 'none' }
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }
  | { kind: 'pattern'; pattern: 'dots' | 'stripes' | 'paper'; fg: string; bg: string }

export interface TextBackdrop {
  fill: string
  stroke: string
  strokeWidth: number
  radius: number
}

export type ElementBase = {
  id: string
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export interface PhotoElement extends ElementBase {
  type: 'photo'
  width: number
  height: number
  flipX: boolean
  frame: boolean
  filters: PhotoFilters
}

export interface TextElement extends ElementBase {
  type: 'text'
  text: string
  fontFamily: FontId
  fontSize: number
  fill: string
  stroke: string
  strokeWidth: number
  backdrop: TextBackdrop | null
  maxWidth: number
  align: 'left' | 'center' | 'right'
}

export interface StickerElement extends ElementBase {
  type: 'sticker'
  stickerId: string
  fill: string
  size: number
}

export type SceneElement = PhotoElement | TextElement | StickerElement

export interface Scene {
  background: Background
  elements: SceneElement[]
}

/** Center of the 1080×1080 design canvas. */
const CENTER = 540

export function newId(): string {
  return crypto.randomUUID()
}

export function emptyScene(): Scene {
  return { background: { kind: 'none' }, elements: [] }
}

function elementBase(): ElementBase {
  return { id: newId(), x: CENTER, y: CENTER, rotation: 0, scaleX: 1, scaleY: 1 }
}

export function createPhotoElement(width: number, height: number): PhotoElement {
  return {
    ...elementBase(),
    type: 'photo',
    width,
    height,
    flipX: false,
    frame: false,
    filters: { brightness: 100, contrast: 100, saturation: 100, grayscale: false },
  }
}

export function createTextElement(
  text: string,
  overrides: Partial<Omit<TextElement, 'id' | 'type' | 'text'>> = {},
): TextElement {
  return {
    ...elementBase(),
    type: 'text',
    text,
    fontFamily: 'smiley',
    fontSize: 64,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 8,
    backdrop: null,
    maxWidth: 960,
    align: 'center',
    ...overrides,
  }
}

export function createStickerElement(stickerId: string, x: number, y: number): StickerElement {
  return {
    ...elementBase(),
    type: 'sticker',
    stickerId,
    fill: '#111111',
    size: 160,
    x,
    y,
  }
}
