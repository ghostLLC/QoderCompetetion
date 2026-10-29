/** Reserved filename characters (Windows) plus Unicode control characters. */
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|\p{Cc}]/gu
/** Dots and spaces are legal inside a name but not at either edge. */
const EDGE_DOTS_AND_SPACES = /^[.\s]+|[.\s]+$/g

/** Used when sanitizing leaves nothing meaningful behind. */
export const FALLBACK_FILENAME = '未命名'

/** Brand shown in export file names and the bundled readme. */
export const ZIP_APP_NAME = '斗图军火库'

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

/** `斗图军火库_宿舍生存_01.png` — 1-based index, zero padded to two digits. */
export function packFileName(packName: string, index: number): string {
  return `${ZIP_APP_NAME}_${sanitizeFileName(packName)}_${String(index + 1).padStart(2, '0')}.png`
}

/** `斗图军火库_宿舍生存.zip` — the download name of the whole-pack archive. */
export function packZipFileName(packName: string): string {
  return `${ZIP_APP_NAME}_${sanitizeFileName(packName)}.zip`
}
