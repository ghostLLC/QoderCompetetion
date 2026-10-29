import { STICKERS } from '@/data/stickers'
import type { Background, Scene, SceneElement } from '@/lib/scene'

/** Bump when the persisted scene shape changes incompatibly. */
export const SCENE_VERSION = 1

interface SceneEnvelope {
  version: number
  scene: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const FONT_IDS = new Set(['smiley', 'system'])
const ALIGNS = new Set(['left', 'center', 'right'])
const PATTERNS = new Set(['dots', 'stripes', 'paper'])
const STICKER_IDS = new Set(STICKERS.map((sticker) => sticker.id))

/** Matches the text panel sliders so persisted values stay editable. */
const MIN_FONT_SIZE = 24
const MAX_FONT_SIZE = 120
const MAX_TEXT_WIDTH = 1080

function isPositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function isFontSize(value: unknown): value is number {
  return isFiniteNumber(value) && value >= MIN_FONT_SIZE && value <= MAX_FONT_SIZE
}

function isTextWidth(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0 && value <= MAX_TEXT_WIDTH
}

function isBackground(value: unknown): value is Background {
  if (!isRecord(value)) return false
  switch (value.kind) {
    case 'none':
      return true
    case 'solid':
      return isString(value.color)
    case 'gradient':
      return isString(value.from) && isString(value.to) && isFiniteNumber(value.angle)
    case 'pattern':
      return (
        PATTERNS.has(value.pattern as string) && isString(value.fg) && isString(value.bg)
      )
    default:
      return false
  }
}

function isBaseElement(value: Record<string, unknown>): boolean {
  return (
    isString(value.id) &&
    value.id.length > 0 &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.rotation) &&
    isFiniteNumber(value.scaleX) &&
    isFiniteNumber(value.scaleY)
  )
}

function isPhotoFilters(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.brightness) &&
    isFiniteNumber(value.contrast) &&
    isFiniteNumber(value.saturation) &&
    typeof value.grayscale === 'boolean'
  )
}

function isTextBackdrop(value: unknown): boolean {
  if (value === null) return true
  return (
    isRecord(value) &&
    isString(value.fill) &&
    isString(value.stroke) &&
    isFiniteNumber(value.strokeWidth) &&
    isFiniteNumber(value.radius)
  )
}

function isSceneElement(value: unknown): value is SceneElement {
  if (!isRecord(value) || !isBaseElement(value)) return false

  switch (value.type) {
    case 'photo':
      return (
        isPositive(value.width) &&
        isPositive(value.height) &&
        typeof value.flipX === 'boolean' &&
        typeof value.frame === 'boolean' &&
        isPhotoFilters(value.filters)
      )
    case 'text':
      return (
        isString(value.text) &&
        FONT_IDS.has(value.fontFamily as string) &&
        isFontSize(value.fontSize) &&
        isString(value.fill) &&
        isString(value.stroke) &&
        isFiniteNumber(value.strokeWidth) &&
        isTextBackdrop(value.backdrop) &&
        isTextWidth(value.maxWidth) &&
        ALIGNS.has(value.align as string)
      )
    case 'sticker':
      return (
        isString(value.stickerId) &&
        STICKER_IDS.has(value.stickerId) &&
        isString(value.fill) &&
        isPositive(value.size)
      )
    default:
      return false
  }
}

function isScene(value: unknown): value is Scene {
  if (!isRecord(value) || !isBackground(value.background) || !Array.isArray(value.elements)) {
    return false
  }

  // Duplicate ids break selection and React/Konva keys, so reject the scene
  // rather than let the editor render two indistinguishable elements.
  const ids = new Set<string>()
  for (const element of value.elements) {
    if (!isSceneElement(element)) return false
    if (ids.has(element.id)) return false
    ids.add(element.id)
  }
  return true
}

/** Wraps the scene in a versioned envelope so stale drafts can be rejected. */
export function serializeScene(scene: Scene): string {
  const envelope: SceneEnvelope = { version: SCENE_VERSION, scene }
  return JSON.stringify(envelope)
}

/** Returns null for invalid JSON, a foreign version, or a malformed scene. */
export function parseScene(json: string): Scene | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!isRecord(parsed) || parsed.version !== SCENE_VERSION) return null
  return isScene(parsed.scene) ? parsed.scene : null
}
