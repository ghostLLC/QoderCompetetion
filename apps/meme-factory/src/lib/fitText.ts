/**
 * Chinese-aware text fitting for the 1080×1080 meme canvas.
 *
 * CJK text has no spaces to wrap on, so lines are broken per character. The
 * font size is searched from `maxFontSize` down to `minFontSize` (integer px
 * steps) until the wrapped text needs at most `maxLines` lines. If even the
 * minimum size overflows, the first `maxLines` lines are kept and the last one
 * is ellipsized until it fits.
 *
 * The caller supplies `measure` so the same algorithm can run against a canvas
 * context (`ctx.measureText`) or Konva. `measure` receives the exact CSS font
 * shorthand the text will be rendered with, e.g. `700 64px Smiley`.
 *
 * Font sizes are searched in whole pixels, so `maxFontSize` is rounded down and
 * `minFontSize` up; callers are expected to pass `maxFontSize >= minFontSize`.
 */

export interface FitTextOptions {
  maxWidth: number
  maxLines: number
  maxFontSize: number
  minFontSize: number
  fontFamily: string
  fontWeight: number
}

export interface FitTextResult {
  lines: string[]
  fontSize: number
}

const ELLIPSIS = '…'

function fontString(size: number, opts: FitTextOptions): string {
  return `${opts.fontWeight} ${size}px ${opts.fontFamily}`
}

/** Greedy per-character wrapping. A single glyph wider than `maxWidth` still gets its own line. */
function wrap(
  chars: string[],
  font: string,
  maxWidth: number,
  measure: (text: string, font: string) => number,
): string[] {
  if (chars.length === 0) return []

  const lines: string[] = []
  let line = ''
  for (const char of chars) {
    if (line !== '' && measure(line + char, font) > maxWidth) {
      lines.push(line)
      line = char
    } else {
      line += char
    }
  }
  lines.push(line)
  return lines
}

export function fitText(
  text: string,
  opts: FitTextOptions,
  measure: (text: string, font: string) => number,
): FitTextResult {
  const maxSize = Math.floor(opts.maxFontSize)
  const minSize = Math.ceil(opts.minFontSize)
  const chars = Array.from(text)

  for (let size = maxSize; size >= minSize; size -= 1) {
    const lines = wrap(chars, fontString(size, opts), opts.maxWidth, measure)
    if (lines.length <= opts.maxLines) return { lines, fontSize: size }
  }

  // Nothing fit: truncate at the minimum size, keeping the first `maxLines` lines.
  const font = fontString(minSize, opts)
  const kept = wrap(chars, font, opts.maxWidth, measure).slice(0, opts.maxLines)
  if (kept.length === 0) return { lines: [], fontSize: minSize }

  const lastChars = Array.from(kept[kept.length - 1] ?? '')
  while (lastChars.length > 0 && measure(lastChars.join('') + ELLIPSIS, font) > opts.maxWidth) {
    lastChars.pop()
  }
  kept[kept.length - 1] = lastChars.join('') + ELLIPSIS

  return { lines: kept, fontSize: minSize }
}
