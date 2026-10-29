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
        isFiniteNumber(value.width) &&
        isFiniteNumber(value.height) &&
        typeof value.flipX === 'boolean' &&
        typeof value.frame === 'boolean' &&
        isPhotoFilters(value.filters)
      )
    case 'text':
      return (
        isString(value.text) &&
        FONT_IDS.has(value.fontFamily as string) &&
        isFiniteNumber(value.fontSize) &&
        isString(value.fill) &&
        isString(value.stroke) &&
        isFiniteNumber(value.strokeWidth) &&
        isTextBackdrop(value.backdrop) &&
        isFiniteNumber(value.maxWidth) &&
        ALIGNS.has(value.align as string)
      )
    case 'sticker':
      return isString(value.stickerId) && isString(value.fill) && isFiniteNumber(value.size)
    default:
      return false
  }
}

function isScene(value: unknown): value is Scene {
  return (
    isRecord(value) &&
    isBackground(value.background) &&
    Array.isArray(value.elements) &&
    value.elements.every(isSceneElement)
  )
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
