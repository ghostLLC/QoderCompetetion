/** Reserved filename characters (Windows) plus Unicode control characters. */
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\p{Cc}]/gu
/** Dots and spaces are legal inside a name but not at either edge. */
const EDGE_DOTS_AND_SPACES = /^[.\s]+|[.\s]+$/g

/** Used when sanitizing leaves nothing meaningful behind. */
export const FALLBACK_FILENAME = '未命名'

/**
 * Makes a user-supplied string safe as a file name on every desktop OS:
 * strips reserved characters and control chars, trims leading/trailing dots
 * and spaces (which some systems silently drop) and falls back to `未命名`
 * when the result would be empty.
 */
export function sanitizeFileName(input: string): string {
  const cleaned = input.replace(INVALID_FILENAME_CHARS, '').replace(EDGE_DOTS_AND_SPACES, '')
  return cleaned || FALLBACK_FILENAME
}
