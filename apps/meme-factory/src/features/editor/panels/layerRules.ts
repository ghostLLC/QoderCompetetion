import type { SceneElement } from '@/lib/scene'

/**
 * The canvas and export always read filters from the first photo element, so a
 * duplicated photo would silently ignore filter edits. Only text and stickers
 * may be duplicated.
 */
export function canDuplicateElement(type: SceneElement['type']): boolean {
  return type !== 'photo'
}
