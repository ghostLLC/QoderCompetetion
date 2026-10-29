import JSZip from 'jszip'

import type { PackDef } from '@/data/packs'
import { renderToBlob } from '@/lib/export'
import { sanitizeFileName } from '@/lib/filename'
import { DESIGN_SIZE } from '@/lib/render'
import type { Scene } from '@/lib/scene'

/** Brand shown in ZIP entry names and the bundled readme. */
export const ZIP_APP_NAME = '斗图军火库'
/** Readme entry written next to the PNGs. */
export const ZIP_README_FILENAME = '使用说明.txt'
/** Rendering fills the first 80% of the reported progress, zipping the rest. */
const RENDER_PROGRESS_SHARE = 80

export interface ZipFileEntry {
  name: string
  blob: Blob
}

/** `斗图军火库_宿舍生存_01.png` — 1-based index, zero padded to two digits. */
export function packFileName(packName: string, index: number): string {
  return `${ZIP_APP_NAME}_${sanitizeFileName(packName)}_${String(index + 1).padStart(2, '0')}.png`
}

/** `斗图军火库_宿舍生存.zip` — the download name of the whole-pack archive. */
export function packZipFileName(packName: string): string {
  return `${ZIP_APP_NAME}_${sanitizeFileName(packName)}.zip`
}

function formatDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Plain-text readme bundled with every pack. Starts with a BOM so Windows
 * Notepad decodes the UTF-8 Chinese text correctly.
 */
export function buildReadme(
  packName: string,
  count: number,
  date: Date = new Date(),
): string {
  return [
    `\uFEFF${ZIP_APP_NAME} · ${sanitizeFileName(packName)} 整套表情包`,
    '',
    `共 ${count} 张，均为 1080×1080 PNG。`,
    '',
    '使用说明：',
    '1. 图片可直接发到微信、QQ 等聊天工具，存为表情使用。',
    '2. 每张图按当前主题和文案生成，换文案后单独下载即可。',
    '',
    '隐私说明：所有图片都在你的浏览器本地生成，照片不会上传到任何服务器。',
    `生成日期：${formatDate(date)}`,
    '',
  ].join('\n')
}

/**
 * Assembles the archive from ready-made blobs. Kept free of canvas access so
 * tests can assert the manifest in jsdom; `onGenerateProgress` receives
 * JSZip's own 0–100 percentage while the archive is written.
 */
export async function buildZipFromBlobs(
  files: ZipFileEntry[],
  readme: string,
  onGenerateProgress?: (percent: number) => void,
): Promise<Blob> {
  const zip = new JSZip()
  for (const file of files) zip.file(file.name, file.blob)
  zip.file(ZIP_README_FILENAME, readme)

  // PNGs are already compressed, so store them as-is (no second DEFLATE pass).
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (metadata) => {
    onGenerateProgress?.(Math.round(metadata.percent))
  })
  onGenerateProgress?.(100)
  return blob
}

/**
 * Renders every scene to a 1080×1080 PNG and bundles them with the readme.
 * Renders sequentially to keep peak memory low on phones. Progress is reported
 * on a 0–100 scale (rendering, then zipping). Any render failure rejects, so
 * the caller can fall back to single downloads.
 */
export async function buildPackZip(
  scenes: Scene[],
  photo: CanvasImageSource | null,
  pack: PackDef,
  onProgress: (pct: number) => void = () => {},
): Promise<Blob> {
  if (scenes.length === 0) throw new Error('没有可导出的表情包')

  onProgress(0)
  const files: ZipFileEntry[] = []
  for (const [index, scene] of scenes.entries()) {
    const blob = await renderToBlob(scene, photo, DESIGN_SIZE)
    files.push({ name: packFileName(pack.name, index), blob })
    onProgress(Math.round(((index + 1) / scenes.length) * RENDER_PROGRESS_SHARE))
  }

  const readme = buildReadme(pack.name, scenes.length)
  return buildZipFromBlobs(files, readme, (percent) => {
    const share = 100 - RENDER_PROGRESS_SHARE
    onProgress(RENDER_PROGRESS_SHARE + Math.round((percent / 100) * share))
  })
}
