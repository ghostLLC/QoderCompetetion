import JSZip from 'jszip'

import { PACKS } from '@/data/packs'
import { renderToBlob } from '@/lib/export'
import {
  packFileName,
  packZipFileName,
  sanitizeFileName,
  ZIP_APP_NAME,
} from '@/lib/filename'
import type { Scene } from '@/lib/scene'
import { buildPackZip, buildZipFromBlobs, ZIP_README_FILENAME } from '@/lib/zip'

vi.mock('@/lib/export', () => ({
  renderToBlob: vi.fn(async () => new Blob(['fake-png'], { type: 'image/png' })),
}))

const mockedRender = vi.mocked(renderToBlob)

function packFileNames(packName: string): string[] {
  return Array.from({ length: 10 }, (_, index) => packFileName(packName, index))
}

describe('sanitizeFileName', () => {
  test('strips invalid filename characters', () => {
    expect(sanitizeFileName('宿舍/生存')).toBe('宿舍生存')
    expect(sanitizeFileName('  a:b*c?  ')).toBe('abc')
    expect(sanitizeFileName('...')).toBe('未命名')
  })

  test('strips every reserved character and control chars', () => {
    expect(sanitizeFileName('a\\b/c:d*e?f"g<h>i|j')).toBe('abcdefghij')
    expect(sanitizeFileName('换\t行\n符\u0000')).toBe('换行符')
  })

  test('trims leading and trailing dots and spaces only', () => {
    expect(sanitizeFileName('  .主题 名称.  ')).toBe('主题 名称')
    expect(sanitizeFileName('   ')).toBe('未命名')
    expect(sanitizeFileName('')).toBe('未命名')
  })
})

describe('buildZipFromBlobs', () => {
  test('manifest contains all 10 PNGs plus the readme', async () => {
    const names = packFileNames('宿舍生存')
    const files = names.map((name, index) => ({
      name,
      blob: new Blob([`png-${index}`], { type: 'image/png' }),
    }))
    const readme = `\uFEFF${ZIP_APP_NAME}\n隐私说明：照片不会上传。\n2026-10-29\n`

    const zipBlob = await buildZipFromBlobs(files, readme)
    expect(zipBlob).toBeInstanceOf(Blob)
    expect(zipBlob.type).toBe('application/zip')

    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
    const entries = Object.values(zip.files).filter((entry) => !entry.dir)
    expect(entries).toHaveLength(11)
    for (const name of names) {
      expect(zip.file(name)).not.toBeNull()
    }
    expect(zip.file(ZIP_README_FILENAME)).not.toBeNull()
    expect(zip.file('使用说明.txt')).not.toBeNull()
    expect(names[0]).toBe('斗图军火库_宿舍生存_01.png')
    expect(names[9]).toBe('斗图军火库_宿舍生存_10.png')

    // Blob bytes survive the zip round-trip.
    expect(await zip.file(names[3])!.async('string')).toBe('png-3')

    const text = await zip.file(ZIP_README_FILENAME)!.async('string')
    expect(text.startsWith('\uFEFF')).toBe(true)
    expect(text).toContain('斗图军火库')
  })
})

describe('buildPackZip', () => {
  const scenes: Scene[] = Array.from({ length: 10 }, () => ({
    background: { kind: 'solid', color: '#ffffff' },
    elements: [],
  }))

  beforeEach(() => {
    mockedRender.mockClear()
  })

  test('sanitizes the pack name, adds the readme and reports monotonic progress', async () => {
    const pack = { ...PACKS[0]!, name: '宿舍/生存' }
    const progress: number[] = []

    const zipBlob = await buildPackZip(scenes, null, pack, (pct) => progress.push(pct))
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
    const names = Object.keys(zip.files).filter((name) => !zip.files[name]!.dir)

    expect(names).toHaveLength(11)
    expect(names).toEqual(
      expect.arrayContaining([
        '斗图军火库_宿舍生存_01.png',
        '斗图军火库_宿舍生存_10.png',
        '使用说明.txt',
      ]),
    )
    expect(zip.file('使用说明.txt')).not.toBeNull()

    const readme = await zip.file(ZIP_README_FILENAME)!.async('string')
    expect(readme.charCodeAt(0)).toBe(0xfeff)
    expect(readme).toContain('斗图军火库')
    expect(readme).toContain('不会上传')
    expect(readme).toContain('1080×1080')
    expect(readme).toMatch(/\d{4}-\d{2}-\d{2}/)

    // Every scene is rendered once, at full design resolution.
    expect(mockedRender).toHaveBeenCalledTimes(10)
    for (const [index, scene] of scenes.entries()) {
      expect(mockedRender).toHaveBeenNthCalledWith(index + 1, scene, null, 1080)
    }

    expect(progress.length).toBeGreaterThan(0)
    expect(progress.at(-1)).toBe(100)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
  })

  test('rejects when a scene cannot be rendered', async () => {
    const pack = PACKS[0]!
    const progress: number[] = []
    mockedRender.mockRejectedValueOnce(new Error('canvas unavailable'))

    await expect(
      buildPackZip(scenes, null, pack, (pct) => progress.push(pct)),
    ).rejects.toThrow('canvas unavailable')

    // Rendering stopped at the first failure; no zip progress was reported.
    expect(mockedRender).toHaveBeenCalledTimes(1)
    expect(progress).toEqual([0])
  })

  test('throws when there are no scenes to export', async () => {
    const pack = PACKS[0]!

    await expect(buildPackZip([], null, pack)).rejects.toThrow('没有可导出的表情包')
    expect(mockedRender).not.toHaveBeenCalled()
  })

  test('zip filename keeps the standard pattern', () => {
    expect(packZipFileName('宿舍生存')).toBe('斗图军火库_宿舍生存.zip')
    expect(packZipFileName('宿舍/生存')).toBe('斗图军火库_宿舍生存.zip')
  })
})
