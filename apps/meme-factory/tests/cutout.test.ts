import {
  assertModelSize,
  MODEL_BYTES,
  maskToAlpha,
  toCHWFloat32,
} from '@/features/cutout/onnxCutout'

test('maskToAlpha normalizes min-max', () => {
  const a = maskToAlpha(new Float32Array([0.2, 0.4, 0.6, 0.8]))
  expect(Array.from(a)).toEqual([0, 85, 170, 255])
})

test('toCHWFloat32 produces CHW normalized tensor', () => {
  const rgba = new Uint8ClampedArray([255, 0, 0, 255]) // one pixel
  const t = toCHWFloat32(rgba, 1)
  expect(t).toHaveLength(3)
  expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 3)
  expect(t[2]).toBeCloseTo((0 - 0.406) / 0.225, 3)
})

test('MODEL_BYTES matches the shipped u2netp.onnx size', () => {
  expect(MODEL_BYTES).toBe(4_574_861)
})

test('assertModelSize accepts the exact model byte length', () => {
  expect(() => assertModelSize(MODEL_BYTES)).not.toThrow()
})

test.each([4_574_860, 4_574_862])(
  'assertModelSize rejects %i bytes with a clear Chinese error',
  (byteLength) => {
    expect(() => assertModelSize(byteLength)).toThrow(/模型文件大小异常/)
  },
)
