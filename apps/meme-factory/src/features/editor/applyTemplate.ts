import type { VisualTemplate } from '@/data/templates'
import { getSticker } from '@/data/stickers'
import {
  createStickerElement,
  newId,
  type Scene,
  type StickerElement,
} from '@/lib/scene'

/** Vertical presets for the main caption, per the design template contract. */
export const TEXT_ANCHOR_Y = {
  top: 170,
  center: 540,
  bottom: 910,
} as const

const ACCENT_PREFIX = 'accent-'
const CENTER_X = 540

/**
 * Applies a visual template: swaps the background, restyles/repositions the
 * main caption in place, and rebuilds the template decorations.
 *
 * Decorations are identified by their `accent-` id prefix, so re-applying a
 * template (or switching templates) never stacks duplicate stickers. User
 * elements keep their ids, stacking position and content.
 */
export function applyTemplate(
  scene: Scene,
  template: VisualTemplate,
  mainTextId: string,
): Scene {
  const { rotate, ...textStyle } = template.text

  const elements = scene.elements
    .filter((element) => !element.id.startsWith(ACCENT_PREFIX))
    .map((element) =>
      element.id === mainTextId && element.type === 'text'
        ? {
            ...element,
            ...textStyle,
            x: CENTER_X,
            y: TEXT_ANCHOR_Y[template.textAnchor],
            rotation: rotate,
          }
        : element,
    )

  const accents = template.accentStickers.map((accent): StickerElement => {
    const sticker: StickerElement = {
      ...createStickerElement(accent.stickerId, accent.x, accent.y),
      id: `${ACCENT_PREFIX}${newId()}`,
      size: accent.size,
      rotation: accent.rotation,
      fill: accent.fill ?? getSticker(accent.stickerId)?.defaultFill ?? '#111111',
    }
    return sticker
  })

  return {
    ...scene,
    background: template.background,
    elements: [...elements, ...accents],
  }
}
