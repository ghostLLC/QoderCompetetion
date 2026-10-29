import type { TextElement } from '@/lib/scene'

export interface TextFrame {
  lines: string[]
  fontSize: number
  blockWidth: number
  blockHeight: number
}

export interface TextNodeBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Konva text node box in element-local design units. The node is exactly the
 * measured text block, not `maxWidth`: short captions get a hugging selection
 * band, and left/right aligned text cannot extend past the block into
 * unreachable transformer anchors.
 *
 * The block already spans the exporter's fillText anchors, so all three
 * alignments resolve to the same box while Konva's `align` still offsets
 * shorter lines inside it exactly like `ctx.textAlign` does in the PNG.
 */
export function textNodeBox(
  frame: Pick<TextFrame, 'blockWidth' | 'blockHeight'>,
  align: TextElement['align'],
): TextNodeBox {
  const width = Math.max(0, frame.blockWidth)
  const height = Math.max(0, frame.blockHeight)
  const anchorX = align === 'left' ? -width / 2 : align === 'right' ? width / 2 : 0
  const x =
    align === 'left'
      ? anchorX
      : align === 'right'
        ? anchorX - width
        : anchorX - width / 2
  return { x, y: -height / 2, width, height }
}
