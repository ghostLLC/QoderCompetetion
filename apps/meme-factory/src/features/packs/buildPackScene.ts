import { getSticker } from '@/data/stickers'
import type { PackDef } from '@/data/packs'
import { TEMPLATES } from '@/data/templates'
import { TEXT_ANCHOR_Y } from '@/features/editor/applyTemplate'
import {
  createStickerElement,
  createTextElement,
  newId,
  type PhotoElement,
  type Scene,
  type StickerElement,
} from '@/lib/scene'

const CENTER = 540
const ACCENT_PREFIX = 'accent-'

/**
 * Builds one scene of a themed pack: the pack template background, the user's
 * photo (copied and re-centred), the pack caption dressed in the template's
 * text style and the template's accent stickers with fresh ids.
 *
 * The input photo is never mutated; the returned photo element owns a fresh id
 * and a copy of its filters so later scene edits cannot leak back.
 */
export function buildPackScene(photo: PhotoElement, pack: PackDef, caption: string): Scene {
  const template = TEMPLATES[pack.templateId]
  const { rotate, ...textStyle } = template.text

  const photoCopy: PhotoElement = {
    ...photo,
    id: newId(),
    x: CENTER,
    y: CENTER,
    filters: { ...photo.filters },
  }

  const captionElement = {
    ...createTextElement(caption),
    ...textStyle,
    x: CENTER,
    y: TEXT_ANCHOR_Y[template.textAnchor],
    rotation: rotate,
  }

  const accents = template.accentStickers.map((accent): StickerElement => {
    const sticker = createStickerElement(accent.stickerId, accent.x, accent.y)
    return {
      ...sticker,
      id: `${ACCENT_PREFIX}${newId()}`,
      size: accent.size,
      rotation: accent.rotation,
      fill: accent.fill ?? getSticker(accent.stickerId)?.defaultFill ?? '#111111',
    }
  })

  return {
    background: template.background,
    elements: [photoCopy, captionElement, ...accents],
  }
}
