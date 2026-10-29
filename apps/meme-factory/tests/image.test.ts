import { decodeImage, fitWithin, toScaledBlob, validateFile } from '@/lib/image'

const makeFile = (type: string, size: number, name = 'x') =>
  new File([new Uint8Array(size)], name, { type })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fitWithin', () => {
  test('keeps aspect and never upscales', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  test('handles portrait images', () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 })
  })
})

describe('validateFile', () => {
  test('rejects non-images and oversize', () => {
    expect(validateFile(makeFile('image/png', 10)).ok).toBe(true)
    expect(validateFile(makeFile('text/plain', 10))).toEqual({
      ok: false,
      reason: '请上传 JPG / PNG / WebP 图片',
    })
    expect(
      validateFile(new File([new Uint8Array(21 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })).ok,
    ).toBe(false)
  })

  test('accepts jpeg and webp up to the 20MB limit', () => {
    expect(validateFile(makeFile('image/jpeg', 20 * 1024 * 1024)).ok).toBe(true)
    expect(validateFile(makeFile('image/webp', 10)).ok).toBe(true)
  })
})

describe('decodeImage', () => {
  test('decodes with EXIF orientation applied', async () => {
    const bitmap = { width: 10, height: 10 } as ImageBitmap
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', createImageBitmap)
    const file = makeFile('image/jpeg', 10)

    await expect(decodeImage(file)).resolves.toBe(bitmap)
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' })
  })
})

describe('toScaledBlob', () => {
  test('downscales the longest side to 1600 and exports PNG', async () => {
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback, type) => {
        callback(new Blob(['png'], { type: type ?? 'image/png' }))
      })
    const bitmap = { width: 4000, height: 3000 } as ImageBitmap

    const blob = await toScaledBlob(bitmap)

    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1200)
    expect(toBlob.mock.calls[0][1]).toBe('image/png')
    expect(blob.type).toBe('image/png')
  })
})
